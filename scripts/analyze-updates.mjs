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

const summaryModel = process.env.OPENAI_SUMMARY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5";
const forcedRegenSourceIds = parseCsvEnv(process.env.FORCE_REGEN_SOURCE_IDS);
const apiKey = process.env.OPENAI_API_KEY;

const generated = JSON.parse(await readFile(generatedPath, "utf8"));
const snapshotFiles = (generated.sourceHealth ?? []).map((item) => item.sourceId).filter(Boolean);
const snapshots = new Map();

for (const sourceId of snapshotFiles) {
  const filePath = path.join(snapshotDir, `${sourceId}.json`);
  try {
    snapshots.set(sourceId, JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    // Missing snapshot falls back later.
  }
}

const previousAnalyzed = await readJsonIfExists(analyzedPath);
const analysisCache = buildAnalysisCache(previousAnalyzed);
const analysisTrace = createAnalysisTrace();

let analyzed = structuredClone(generated);
let analysisMode = "fallback";

if (apiKey) {
  try {
    analyzed = await enrichGeneratedDataWithModel(generated, snapshots, analysisCache, analysisTrace, {
      apiKey,
      summaryModel
    });
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
  summaryModel: apiKey ? summaryModel : null,
  translationModel: null,
  forcedRegenSourceIds: [...forcedRegenSourceIds],
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

  next.alerts = [];
  for (const item of base.alerts ?? []) {
    next.alerts.push(await enrichItemSafely(item, "alert", snapshotMap, cache, trace, options));
  }

  next.digest = [];
  for (const item of base.digest ?? []) {
    next.digest.push(await enrichItemSafely(item, "digest", snapshotMap, cache, trace, options));
  }

  next.sourceItems = (base.sourceItems ?? []).map((item) => ({ ...item }));
  return next;
}

async function enrichItemSafely(item, kind, snapshotMap, cache, trace, options) {
  try {
    return await enrichItem(item, kind, snapshotMap, cache, trace, options);
  } catch (error) {
    const sourceId = item?.sourceId ?? item?.id?.replace(/-(alert|digest)$/, "");
    if (sourceId) {
      markItemAnalysis(trace, sourceId, kind, "fallback", toErrorMessage(error));
    }
    return {
      ...item,
      publishedAt: item.publishedAt ?? snapshotMap.get(sourceId)?.publishedAt ?? null,
      trustLevel: findTrustLevel(item, snapshotMap.get(sourceId)),
      trendJa: kind === "digest" ? item.trendJa ?? deriveFallbackTrend(item) : undefined
    };
  }
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
      trendJa: kind === "digest" ? cached.value.trendJa ?? item.trendJa : undefined,
      watchAngles: cached.value.watchAngles ?? item.watchAngles,
      action: kind === "alert" ? item.action : cached.value.action ?? item.action,
      scores: cached.value.scores ?? item.scores,
      publishedAt: item.publishedAt ?? snapshot.publishedAt ?? null,
      trustLevel: cached.value.trustLevel ?? findTrustLevel(item, snapshot)
    };
  }

  markItemAnalysis(trace, sourceId, kind, "regenerated", cached.reason);

  const trustLevel = findTrustLevel(item, snapshot);
  const trustInstruction =
    trustLevel === "secondary"
      ? [
          "This source is secondary, not official.",
          "Be conservative.",
          "Avoid overclaiming.",
          "Explicitly leave uncertainty when evidence is weak."
        ].join("\n")
      : "This source is official. You may summarize directly, but stay factual.";

  const schema = kind === "alert" ? buildAlertSchema() : buildDigestSchema();
  const prompt = kind === "alert" ? buildAlertPrompt(item, snapshot, trustLevel, trustInstruction) : buildDigestPrompt(item, snapshot, trustLevel, trustInstruction);

  const result = await callOpenAIJson(prompt, schema, {
    apiKey: options.apiKey,
    model: options.summaryModel
  });

  return {
    ...item,
    titleJa: result.title_ja || item.titleJa,
    summaryJa: result.summary_ja || item.summaryJa,
    whyNow: kind === "alert" ? result.why_now || item.whyNow : undefined,
    trendJa: kind === "digest" ? result.trend_ja || item.trendJa || deriveFallbackTrend(item) : undefined,
    watchAngles: kind === "alert" ? result.watch_angles?.length ? result.watch_angles : item.watchAngles : item.watchAngles,
    action: result.action || item.action,
    scores: result.scores || item.scores,
    publishedAt: item.publishedAt ?? snapshot.publishedAt ?? null,
    trustLevel
  };
}

function buildAlertSchema() {
  return {
    name: "alert_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title_ja: { type: "string" },
        summary_ja: { type: "string" },
        why_now: { type: "string" },
        watch_angles: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string" }
        },
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
      required: ["title_ja", "summary_ja", "why_now", "watch_angles", "action", "scores"]
    }
  };
}

function buildDigestSchema() {
  return {
    name: "digest_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title_ja: { type: "string" },
        summary_ja: { type: "string" },
        trend_ja: { type: "string" },
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
      required: ["title_ja", "summary_ja", "trend_ja", "action", "scores"]
    }
  };
}

function buildAlertPrompt(item, snapshot, trustLevel, trustInstruction) {
  return [
    "You analyze first-party AI product updates for a single Japanese-speaking user.",
    "Return concise, natural Japanese for an alert card.",
    "The alert is for updates that may change how the user should work now.",
    "Prioritize context UX, work UX, workflow compression, reliability, and immediate operational meaning.",
    "Do not invent facts not supported by the source text.",
    "title_ja should be an alert headline in Japanese.",
    "summary_ja should explain the actual change in 2-4 Japanese sentences.",
    "why_now should say why the user should look now.",
    "watch_angles should be concrete Japanese checkpoints for inspection.",
    trustInstruction,
    `Company: ${item.company}`,
    `Product label: ${item.product ?? item.company}`,
    `Trust level: ${trustLevel}`,
    `Current English title: ${item.titleEn ?? ""}`,
    `Current fallback title in Japanese: ${item.titleJa ?? ""}`,
    `Current fallback summary in Japanese: ${item.summaryJa ?? ""}`,
    `Current fallback why_now in Japanese: ${item.whyNow ?? ""}`,
    `Source description: ${snapshot.description ?? ""}`,
    `Source excerpt: ${snapshot.excerpt ?? ""}`
  ].join("\n");
}

function buildDigestPrompt(item, snapshot, trustLevel, trustInstruction) {
  return [
    "You analyze first-party AI product updates for a single Japanese-speaking user.",
    "Return concise, natural Japanese for a digest card.",
    "The digest is for calm catch-up reading, not urgent alerts.",
    "summary_ja should explain what changed and what it means at a practical level.",
    "trend_ja should be one short Japanese sentence about the likely near-term direction or what to keep watching.",
    "Avoid generic hype and avoid copying the source wording too literally.",
    "Do not invent facts not supported by the source text.",
    trustInstruction,
    `Company: ${item.company}`,
    `Trust level: ${trustLevel}`,
    `Current fallback title in Japanese: ${item.titleJa ?? ""}`,
    `Current fallback summary in Japanese: ${item.summaryJa ?? ""}`,
    `Source description: ${snapshot.description ?? ""}`,
    `Source excerpt: ${snapshot.excerpt ?? ""}`
  ].join("\n");
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
    whyNow: item.whyNow ?? "今回の更新での追加分析は次回実行で補完します。",
    watchAngles: item.watchAngles ?? [],
    publishedAt: item.publishedAt ?? snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, ""))?.publishedAt ?? null,
    trustLevel: findTrustLevel(item, snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, "")))
  }));

  next.digest = (base.digest ?? []).map((item) => ({
    ...item,
    trendJa: item.trendJa ?? deriveFallbackTrend(item),
    publishedAt: item.publishedAt ?? snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, ""))?.publishedAt ?? null,
    trustLevel: findTrustLevel(item, snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, "")))
  }));

  next.sourceItems = (base.sourceItems ?? []).map((item) => ({ ...item }));
  next.analysisFallback = { reason };

  for (const item of next.alerts) {
    if (item?.sourceId) {
      markItemAnalysis(trace, item.sourceId, "alert", "fallback");
    }
  }
  for (const item of next.digest) {
    if (item?.sourceId) {
      markItemAnalysis(trace, item.sourceId, "digest", "fallback");
    }
  }

  return next;
}

function deriveFallbackTrend(item) {
  if (item?.action === "監視") {
    return "まずは次の更新や関連発表が続くかを数週間追うのが良さそうです。";
  }
  return "大きな変化はまだ限定的なので、定点観測を続けながら次の動きを待つ段階です。";
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function findTrustLevel(item, snapshot) {
  return item?.trustLevel ?? snapshot?.trustLevel ?? "official";
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
    if (item?.sourceId) {
      itemAnalyses.set(`digest:${item.sourceId}`, item);
    }
  }

  return {
    hasReusableEntries: sourceItems.size > 0 || itemAnalyses.size > 0,
    sourceItems,
    itemAnalyses
  };
}

function getCachedAnalysisForItem(sourceId, kind, snapshot, cache) {
  if (forcedRegenSourceIds.has(sourceId)) {
    return { hit: false, reason: { code: "forced_regen_requested" } };
  }

  const previousSourceItem = cache.sourceItems.get(sourceId);
  if (!previousSourceItem) {
    return { hit: false, reason: { code: "no_previous_source_item" } };
  }

  const fingerprintDiff = diffSourceIdentity(
    sourceIdentityPartsFromSourceItem(previousSourceItem),
    sourceIdentityPartsFromSnapshot(snapshot)
  );
  if (fingerprintDiff) {
    return { hit: false, reason: fingerprintDiff };
  }

  const matched = cache.itemAnalyses.get(`${kind}:${sourceId}`) ?? null;
  if (!matched) {
    return { hit: false, reason: { code: `no_previous_${kind}_analysis` } };
  }

  return { hit: true, value: matched };
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
      return {
        code: `${key}_changed`,
        detail: {
          previous: previous?.[key] ?? "",
          current: current?.[key] ?? ""
        }
      };
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

function parseCsvEnv(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function createAnalysisTrace() {
  return {
    itemAnalyses: new Map()
  };
}

function markItemAnalysis(trace, sourceId, kind, status, reason = null) {
  const current = trace.itemAnalyses.get(sourceId) ?? {};
  trace.itemAnalyses.set(sourceId, {
    ...current,
    [kind]: status,
    [`${kind}Reason`]: reason?.code ?? reason ?? current[`${kind}Reason`] ?? null,
    [`${kind}ReasonDetail`]: reason?.detail ?? current[`${kind}ReasonDetail`] ?? null
  });
}

function finalizeAnalysisTrace(trace) {
  const bySource = {};
  for (const [sourceId, value] of trace.itemAnalyses.entries()) {
    bySource[sourceId] = { ...value };
  }
  const entries = Object.values(bySource);
  return {
    summary: {
      translationCacheHits: 0,
      translationRegenerated: 0,
      alertCacheHits: entries.filter((entry) => entry.alert === "cache_hit").length,
      alertRegenerated: entries.filter((entry) => entry.alert === "regenerated").length,
      digestCacheHits: entries.filter((entry) => entry.digest === "cache_hit").length,
      digestRegenerated: entries.filter((entry) => entry.digest === "regenerated").length
    },
    bySource
  };
}
