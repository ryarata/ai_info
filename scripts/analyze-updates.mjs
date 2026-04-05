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

let analyzed = structuredClone(generated);
let analysisMode = "fallback";

if (apiKey) {
  try {
    analyzed = await enrichGeneratedDataWithModel(generated, snapshots, { apiKey, model });
    analysisMode = "openai";
  } catch (error) {
    analyzed = applyFallbackAnalysis(generated, snapshots, `LLM analysis failed: ${toErrorMessage(error)}`);
    analysisMode = "fallback_after_error";
  }
} else {
  analyzed = applyFallbackAnalysis(generated, snapshots, "OPENAI_API_KEY not set");
}

analyzed.generatedAt = new Date().toISOString();
analyzed.analysis = {
  mode: analysisMode,
  model: apiKey ? model : null
};
analyzed.summary = {
  ...(analyzed.summary ?? {}),
  urgentCount: analyzed.alerts?.length ?? 0,
  digestCount: analyzed.digest?.length ?? 0
};

await mkdir(path.dirname(analyzedPath), { recursive: true });
await writeFile(analyzedPath, JSON.stringify(analyzed, null, 2), "utf8");

console.log(`Wrote analyzed updates to ${analyzedPath} using mode=${analysisMode}`);

async function enrichGeneratedDataWithModel(base, snapshotMap, options) {
  const next = structuredClone(base);

  next.alerts = await Promise.all(
    (base.alerts ?? []).map(async (item) => enrichItem(item, "alert", snapshotMap, options))
  );
  next.digest = await Promise.all(
    (base.digest ?? []).map(async (item) => enrichItem(item, "digest", snapshotMap, options))
  );
  next.sourceItems = await Promise.all(
    (base.sourceItems ?? []).map(async (item) => enrichSourceItem(item, options))
  );

  next.weeklyThemes = await buildWeeklyThemes(base, snapshotMap, options);

  return next;
}

async function enrichItem(item, kind, snapshotMap, options) {
  const sourceId = item.sourceId ?? item.id.replace(/-(alert|digest)$/, "");
  const snapshot = snapshotMap.get(sourceId);

  if (!snapshot || snapshot.status !== "ok") {
    return item;
  }

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

async function buildWeeklyThemes(base, snapshotMap, options) {
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
    return base.weeklyThemes ?? [];
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
  return result.themes?.length ? result.themes : base.weeklyThemes ?? [];
}

async function enrichSourceItem(item, options) {
  if (!item || item.status !== "ok") {
    return item;
  }

  const schema = {
    name: "source_item_translation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title_ja: { type: "string" },
        description_ja: { type: "string" },
        excerpt_ja: { type: "string" }
      },
      required: ["title_ja", "description_ja", "excerpt_ja"]
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
    `Original description: ${item.description ?? ""}`,
    `Original excerpt: ${String(item.excerpt ?? "").slice(0, 2400)}`
  ].join("\n");

  const result = await callOpenAIJson(prompt, schema, options);

  return {
    ...item,
    translated: {
      titleJa: result.title_ja || "",
      descriptionJa: result.description_ja || "",
      excerptJa: result.excerpt_ja || ""
    }
  };
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

function applyFallbackAnalysis(base, snapshotMap, reason) {
  const next = structuredClone(base);

  next.alerts = (base.alerts ?? []).map((item) => ({
    ...item,
    whyNow: item.whyNow ?? "分析理由は次回更新で補完します。",
    publishedAt: item.publishedAt ?? snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, ""))?.publishedAt ?? null,
    trustLevel: findTrustLevel(baseLikeItem(item), snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, "")))
  }));

  next.digest = (base.digest ?? []).map((item) => ({
    ...item,
    publishedAt: item.publishedAt ?? snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, ""))?.publishedAt ?? null,
    trustLevel: findTrustLevel(baseLikeItem(item), snapshotMap.get(item.sourceId ?? item.id.replace(/-(alert|digest)$/, "")))
  }));
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

  next.weeklyThemes = [
    ...(base.weeklyThemes ?? [])
  ];

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
