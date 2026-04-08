import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
await loadEnv(root);
const generatedPath = path.join(root, "data", "updates.generated.json");
const analyzedPath = path.join(root, "data", "updates.analyzed.json");
const snapshotDir = path.join(root, "data", "snapshots");

const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
const apiKey = process.env.OPENAI_API_KEY;

const generated = JSON.parse(await readFile(generatedPath, "utf8"));
const snapshotFiles = (generated.sourceHealth ?? [])
  .map((item) => item.sourceId)
  .filter(Boolean);

const snapshots = new Map();
for (const sourceId of snapshotFiles) {
  const filePath = path.join(snapshotDir, `${sourceId}.json`);
  try {
    const content = JSON.parse(await readFile(filePath, "utf8"));
    snapshots.set(sourceId, content);
  } catch {
    // Ignore missing snapshots; fallback path will handle it.
  }
}

const previousAnalyzed = await readJsonIfExists(analyzedPath);
const analysisCache = buildAnalysisCache(previousAnalyzed);
const analysisTrace = createAnalysisTrace();

let analyzed = structuredClone(generated);
let analysisMode = "fallback";

if (apiKey) {
  try {
    analyzed = await enrichGeneratedDataWithModel(generated, snapshots, analysisCache, analysisTrace, { apiKey, model });
    analysisMode = analysisCache.hasReusableEntries ? "openai_with_cache" : "openai";
  } catch (error) {
    analyzed = applyFallbackAnalysis(generated, snapshots, analysisTrace, `LLM analysis failed: ${toErrorMessage(error)}`);
    analysisMode = "fallback_after_error";
  }
} else {
  analyzed = applyFallbackAnalysis(generated, snapshots, analysisTrace, "OPENAI_API_KEY not set");
}

analyzed.generatedAt = new Date().toISOString();
analyzed.analysis = {
  mode: analysisMode,
  model: apiKey ? model : null,
  cache: finalizeAnalysisTrace(analysisTrace)
};
analyzed.summary = {
  ...(analyzed.summary ?? {}),
  urgentCount: analyzed.alerts?.length ?? 0,
  digestCount: analyzed.digest?.length ?? 0
};

await mkdir(path.dirname(analyzedPath), { recursive: true });
await writeFile(analyzedPath, JSON.stringify(analyzed, null, 2), "utf8");

console.log(`Wrote analyzed updates to ${analyzedPath} using mode=${analysisMode}`);

async function enrichGeneratedDataWithModel(base, snapshotMap, cache, trace, options) {
  const next = structuredClone(base);

  next.alerts = await Promise.all(
    (base.alerts ?? []).map(async (item) => enrichItem(item, "alert", snapshotMap, cache, trace, options))
  );
  next.digest = await Promise.all(
    (base.digest ?? []).map(async (item) => enrichItem(item, "digest", snapshotMap, cache, trace, options))
  );
  next.sourceItems = await Promise.all(
    (base.sourceItems ?? []).map(async (item) => enrichSourceItem(item, cache, trace, options))
  );

  next.weeklyThemes = await buildWeeklyThemes(base, snapshotMap, cache, trace, options);

  return next;
}

async function enrichItem(item, kind, snapshotMap, cache, trace, options) {
  const sourceId = item.sourceId ?? item.id.replace(/-(alert|digest)$/, "");
  const snapshot = snapshotMap.get(sourceId);

  if (!snapshot || snapshot.status !== "ok") {
    markItemAnalysis(trace, sourceId, kind, "skipped_no_snapshot");
    return item;
  }

  const cached = getCachedAnalysisForItem(sourceId, kind, snapshot, cache);
  if (cached.hit) {
    markItemAnalysis(trace, sourceId, kind, "cache_hit");
    return {
      ...item,
      titleJa: cached.value.titleJa ?? item.titleJa,
      summaryJa: cached.value.summaryJa ?? item.summaryJa,
      whyNow: cached.value.whyNow ?? item.whyNow,
      action: kind === "alert" ? item.action : cached.value.action ?? item.action,
      scores: cached.value.scores ?? item.scores,
      publishedAt: item.publishedAt ?? snapshot.publishedAt ?? null,
      trustLevel: cached.value.trustLevel ?? findTrustLevel(baseLikeItem(item), snapshot)
    };
  }
  markItemAnalysis(trace, sourceId, kind, "regenerated", cached.reason);

  const schema = {
    name: `${kind}_analysis`,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title_ja: { type: "string" },
        summary_ja: { type: "string" },
        why_now: { type: "string" },
        action: { type: "string", enum: ["今すぐ試す", "今週理解", "監視", "定点観測"] },
        scores: {
          type: "object",
          additionalProperties: false,
          properties: {
            contextUx: { type: "integer", minimum: 1, maximum: 5 },
            workUx: { type: "integer", minimum: 1, maximum: 5 },
            workflow: { type: "integer", minimum: 1, maximum: 5 }
          },
          required: ["contextUx", "workUx", "workflow"]
        }
      },
      required: ["title_ja", "summary_ja", "why_now", "action", "scores"]
    }
  };

  const trustLevel = findTrustLevel(baseLikeItem(item), snapshot);
  const trustInstruction =
    trustLevel === "secondary"
      ? [
          "This source is secondary, not official.",
          "Be conservative.",
          "Do not overstate certainty.",
          "If needed, indicate that the update is being reported by a secondary source."
        ].join("\n")
      : "This source is official. You may summarize it more directly while staying factual.";

  const prompt = [
    "You analyze first-party AI product updates for a single Japanese-speaking user.",
    "Summarize in natural Japanese.",
    "Prioritize context UX, work UX, workflow compression, and practical impact.",
    "Do not invent facts not supported by the provided source text.",
    "If the source text is generic, still produce the best concise summary possible from it.",
    "Return scores from 1 to 5 for contextUx, workUx, and workflow.",
    trustInstruction,
    `Kind: ${kind}`,
    `Company: ${item.company}`,
    `Product label: ${item.product ?? item.company}`,
    `Trust level: ${trustLevel}`,
    `Current English title: ${item.titleEn ?? ""}`,
    `Existing fallback title in Japanese: ${item.titleJa ?? ""}`,
    `Current fallback summary in Japanese: ${item.summaryJa ?? ""}`,
    `Current fallback reason: ${item.whyNow ?? ""}`,
    `Source description: ${snapshot.description ?? ""}`,
    `Source excerpt: ${snapshot.excerpt ?? ""}`
  ].join("\n");

  const result = await callOpenAIJson(prompt, schema, options);
  return {
    ...item,
    titleJa: result.title_ja || item.titleJa,
    summaryJa: result.summary_ja || item.summaryJa,
    whyNow: result.why_now || item.whyNow,
    action: result.action || item.action,
    scores: result.scores || item.scores,
    publishedAt: item.publishedAt ?? snapshot.publishedAt ?? null,
    trustLevel
  };
}

async function buildWeeklyThemes(base, snapshotMap, cache, trace, options) {
  const okSnapshots = [...snapshotMap.values()]
    .filter((snapshot) => snapshot.status === "ok")
    .map((snapshot) => ({
      company: snapshot.company,
      label: snapshot.label,
      title: snapshot.title,
      description: snapshot.description,
      excerpt: snapshot.excerpt.slice(0, 800)
    }));

  if (okSnapshots.length === 0) {
    trace.weeklyThemes = { status: "skipped_no_snapshot" };
    return base.weeklyThemes ?? [];
  }

  if (cache.weeklyThemesFingerprint && cache.weeklyThemesFingerprint === fingerprintWeeklyThemes(okSnapshots)) {
    trace.weeklyThemes = { status: "cache_hit" };
    return cache.weeklyThemes;
  }

  const schema = {
    name: "weekly_themes",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        themes: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            },
            required: ["title", "body"]
          }
        }
      },
      required: ["themes"]
    }
  };

  const prompt = [
    "You are creating a weekly strategic memo in Japanese for a single user.",
    "Use only the source-derived information provided.",
    "Focus on what may matter for work style, context UX, workflow, and practical usage constraints over the next 3 to 6 months.",
    "Write concise Japanese.",
    `Source updates: ${JSON.stringify(okSnapshots)}`
  ].join("\n");

  const result = await callOpenAIJson(prompt, schema, options);
  trace.weeklyThemes = { status: "regenerated" };
  return result.themes?.length ? result.themes : base.weeklyThemes ?? [];
}

async function enrichSourceItem(item, cache, trace, options) {
  if (!item || item.status !== "ok") {
    if (item?.sourceId) {
      markSourceTranslation(trace, item.sourceId, "skipped_non_ok");
    }
    return item;
  }

  const cached = getCachedTranslationForSourceItem(item, cache);
  if (cached.hit) {
    markSourceTranslation(trace, item.sourceId, "cache_hit");
    return {
      ...item,
      translated: cached.value
    };
  }
  markSourceTranslation(trace, item.sourceId, "regenerated", cached.reason);

  const schema = {
    name: "source_item_translation_header",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title_ja: { type: "string" },
        description_ja: { type: "string" }
      },
      required: ["title_ja", "description_ja"]
    }
  };

  const prompt = [
    "You translate extracted AI product source text into natural Japanese for a single user.",
    "Translate faithfully.",
    "Do not add interpretation, scoring, recommendations, or extra facts.",
    "If the source text is noisy or partial, preserve that uncertainty rather than filling gaps.",
    `Company: ${item.company}`,
    `Source label: ${item.label}`,
    `Original title: ${item.title ?? ""}`,
    `Original description: ${item.description ?? ""}`
  ].join("\n");

  const result = await callOpenAIJson(prompt, schema, options);
  const excerptJa = await translateLongExcerpt(item, options);
  return {
    ...item,
    translated: {
      titleJa: result.title_ja || "",
      descriptionJa: result.description_ja || "",
      excerptJa
    }
  };
}

async function translateLongExcerpt(item, options) {
  const originalExcerpt = String(item.excerpt ?? "").trim();
  if (!originalExcerpt) {
    return "";
  }

  const chunks = splitTextForTranslation(originalExcerpt, 1800);
  const translatedChunks = [];

  for (const [index, chunk] of chunks.entries()) {
    const schema = {
      name: "source_excerpt_translation_chunk",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          excerpt_ja: { type: "string" }
        },
        required: ["excerpt_ja"]
      }
    };

    const prompt = [
      "You translate extracted AI product source text into natural Japanese for a single user.",
      "Translate faithfully.",
      "Do not add interpretation, scoring, recommendations, headings, or extra facts.",
      "Translate only the provided excerpt chunk.",
      "Keep the order and meaning intact.",
      `Company: ${item.company}`,
      `Source label: ${item.label}`,
      `Chunk: ${index + 1}/${chunks.length}`,
      `Original excerpt chunk: ${chunk}`
    ].join("\n");

    const result = await callOpenAIJson(prompt, schema, options);
    translatedChunks.push(result.excerpt_ja || "");
  }

  return translatedChunks.join("\n\n").trim();
}

async function callOpenAIJson(prompt, schema, options) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          strict: schema.strict,
          schema: schema.schema
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API HTTP ${response.status}`);
  }

  const body = await response.json();
  const rawText = extractResponseText(body);
  if (!rawText) {
    throw new Error("OpenAI API returned no text output");
  }

  return JSON.parse(rawText);
}

function extractResponseText(body) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  for (const outputItem of body.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return contentItem.text.trim();
      }
      if (typeof contentItem.output_text === "string" && contentItem.output_text.trim()) {
        return contentItem.output_text.trim();
      }
    }
  }

  return null;
}

function applyFallbackAnalysis(base, snapshotMap, trace, reason) {
  const next = structuredClone(base);

  next.alerts = (base.alerts ?? []).map((item) => ({
    ...item,
    whyNow: item.whyNow ?? "分析理由は次回更新で補完します。",
    publishedAt: item.publishedAt ?? snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, ""))?.publishedAt ?? null,
    trustLevel: findTrustLevel(baseLikeItem(item), snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, "")))
  }));
  for (const item of next.alerts) {
    if (item?.sourceId) {
      markItemAnalysis(trace, item.sourceId, "alert", "fallback");
    }
  }

  next.digest = (base.digest ?? []).map((item) => ({
    ...item,
    publishedAt: item.publishedAt ?? snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, ""))?.publishedAt ?? null,
    trustLevel: findTrustLevel(baseLikeItem(item), snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, "")))
  }));
  for (const item of next.digest) {
    if (item?.sourceId) {
      markItemAnalysis(trace, item.sourceId, "digest", "fallback");
    }
  }
  next.sourceItems = (base.sourceItems ?? []).map((item) => ({
    ...item,
    translated:
      item?.status === "ok"
        ? {
            titleJa: item.title ?? "",
            descriptionJa: item.description ?? "",
            excerptJa: item.excerpt ?? ""
          }
        : undefined
  }));
  for (const item of next.sourceItems) {
    if (item?.sourceId) {
      markSourceTranslation(trace, item.sourceId, item?.status === "ok" ? "fallback" : "skipped_non_ok");
    }
  }

  next.weeklyThemes = [
    ...(base.weeklyThemes ?? [])
  ];
  trace.weeklyThemes = { status: "fallback" };

  next.analysisFallback = {
    reason
  };

  for (const item of next.alerts) {
    const sourceId = item.sourceId ?? item.id.replace(/-(alert|digest)$/, "");
    const snapshot = snapshotMap.get(sourceId);
    if (snapshot?.status === "ok") {
      item.summaryJa = item.summaryJa || `${item.company} の一次情報更新を確認しました。`;
    }
  }

  return next;
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function findTrustLevel(item, snapshot) {
  return item.trustLevel ?? snapshot?.trustLevel ?? "official";
}

function baseLikeItem(item) {
  return item ?? {};
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function buildAnalysisCache(previousAnalyzed) {
  const sourceItems = new Map();
  const itemAnalyses = new Map();

  for (const item of previousAnalyzed?.sourceItems ?? []) {
    if (item?.sourceId) {
      sourceItems.set(item.sourceId, item);
    }
  }

  for (const item of previousAnalyzed?.alerts ?? []) {
    if (item?.sourceId) {
      itemAnalyses.set(`alert:${item.sourceId}`, item);
    }
  }

  for (const item of previousAnalyzed?.digest ?? []) {
    if (item?.sourceId && !itemAnalyses.has(`digest:${item.sourceId}`)) {
      itemAnalyses.set(`digest:${item.sourceId}`, item);
    }
  }

  const okSnapshots = (previousAnalyzed?.sourceItems ?? [])
    .filter((item) => item?.status === "ok")
    .map((item) => ({
      company: item.company,
      label: item.label,
      title: item.title,
      description: item.description,
      excerpt: String(item.excerpt ?? "").slice(0, 800)
    }));

  return {
    hasReusableEntries: sourceItems.size > 0 || itemAnalyses.size > 0,
    sourceItems,
    itemAnalyses,
    weeklyThemes: previousAnalyzed?.weeklyThemes ?? [],
    weeklyThemesFingerprint: okSnapshots.length > 0 ? fingerprintWeeklyThemes(okSnapshots) : null
  };
}

function getCachedTranslationForSourceItem(item, cache) {
  const previous = cache.sourceItems.get(item.sourceId);
  if (!previous?.translated) {
    return { hit: false, reason: "no_previous_translation" };
  }

  const fingerprintDiff = diffSourceIdentity(sourceIdentityPartsFromSourceItem(previous), sourceIdentityPartsFromSourceItem(item));
  if (fingerprintDiff) {
    return { hit: false, reason: fingerprintDiff };
  }

  return { hit: true, value: previous.translated };
}

function getCachedAnalysisForItem(sourceId, kind, snapshot, cache) {
  const previousSourceItem = cache.sourceItems.get(sourceId);
  if (!previousSourceItem) {
    return { hit: false, reason: "no_previous_source_item" };
  }

  const fingerprintDiff = diffSourceIdentity(
    sourceIdentityPartsFromSourceItem(previousSourceItem),
    sourceIdentityPartsFromSnapshot(snapshot)
  );
  if (fingerprintDiff) {
    return { hit: false, reason: fingerprintDiff };
  }

  const matched =
    cache.itemAnalyses.get(`${kind}:${sourceId}`) ??
    cache.itemAnalyses.get(`alert:${sourceId}`) ??
    cache.itemAnalyses.get(`digest:${sourceId}`) ??
    null;

  if (!matched) {
    return { hit: false, reason: `no_previous_${kind}_analysis` };
  }

  return { hit: true, value: matched };
}

function sourceFingerprintFromSnapshot(snapshot) {
  return Object.values(sourceIdentityPartsFromSnapshot(snapshot)).join("\n@@\n");
}

function sourceFingerprintFromSourceItem(item) {
  return Object.values(sourceIdentityPartsFromSourceItem(item)).join("\n@@\n");
}

function fingerprintWeeklyThemes(okSnapshots) {
  return JSON.stringify(okSnapshots);
}

function sourceIdentityPartsFromSnapshot(snapshot) {
  return {
    title: normalizeFingerprintText(snapshot?.title ?? ""),
    publishedAt: normalizeIdentityDate(snapshot?.publishedAt ?? "")
  };
}

function sourceIdentityPartsFromSourceItem(item) {
  return {
    title: normalizeFingerprintText(item?.title ?? ""),
    publishedAt: normalizeIdentityDate(item?.publishedAt ?? "")
  };
}

function diffSourceIdentity(previous, current) {
  for (const key of ["title", "publishedAt"]) {
    if ((previous?.[key] ?? "") !== (current?.[key] ?? "")) {
      return `${key}_changed`;
    }
  }

  return null;
}

function normalizeFingerprintText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentityDate(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return text;
  }

  return new Date(parsed).toISOString();
}

function createAnalysisTrace() {
  return {
    sourceItems: new Map(),
    itemAnalyses: new Map(),
    weeklyThemes: null
  };
}

function markSourceTranslation(trace, sourceId, status, reason = null) {
  const current = trace.sourceItems.get(sourceId) ?? {};
  trace.sourceItems.set(sourceId, {
    ...current,
    translation: status,
    translationReason: reason ?? current.translationReason ?? null
  });
}

function markItemAnalysis(trace, sourceId, kind, status, reason = null) {
  const current = trace.itemAnalyses.get(sourceId) ?? {};
  trace.itemAnalyses.set(sourceId, {
    ...current,
    [kind]: status,
    [`${kind}Reason`]: reason ?? current[`${kind}Reason`] ?? null
  });
}

function finalizeAnalysisTrace(trace) {
  const bySource = {};
  const sourceIds = new Set([...trace.sourceItems.keys(), ...trace.itemAnalyses.keys()]);

  for (const sourceId of sourceIds) {
    bySource[sourceId] = {
      ...(trace.sourceItems.get(sourceId) ?? {}),
      ...(trace.itemAnalyses.get(sourceId) ?? {})
    };
  }

  const entries = Object.values(bySource);
  return {
    summary: {
      translationCacheHits: entries.filter((entry) => entry.translation === "cache_hit").length,
      translationRegenerated: entries.filter((entry) => entry.translation === "regenerated").length,
      alertCacheHits: entries.filter((entry) => entry.alert === "cache_hit").length,
      alertRegenerated: entries.filter((entry) => entry.alert === "regenerated").length,
      digestCacheHits: entries.filter((entry) => entry.digest === "cache_hit").length,
      digestRegenerated: entries.filter((entry) => entry.digest === "regenerated").length,
      weeklyThemes: trace.weeklyThemes?.status ?? "unknown"
    },
    bySource
  };
}

function splitTextForTranslation(text, maxChunkLength) {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxChunkLength) {
    return [normalized];
  }

  const chunks = [];
  let remaining = normalized;

  while (remaining.length > maxChunkLength) {
    let splitIndex = Math.max(
      remaining.lastIndexOf(". ", maxChunkLength),
      remaining.lastIndexOf("! ", maxChunkLength),
      remaining.lastIndexOf("? ", maxChunkLength),
      remaining.lastIndexOf("。", maxChunkLength),
      remaining.lastIndexOf("！", maxChunkLength),
      remaining.lastIndexOf("？", maxChunkLength)
    );

    if (splitIndex < Math.floor(maxChunkLength * 0.6)) {
      splitIndex = remaining.lastIndexOf(" ", maxChunkLength);
    }

    if (splitIndex < Math.floor(maxChunkLength * 0.4)) {
      splitIndex = maxChunkLength;
    }

    const endIndex = splitIndex === maxChunkLength ? splitIndex : splitIndex + 1;
    chunks.push(remaining.slice(0, endIndex).trim());
    remaining = remaining.slice(endIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}
