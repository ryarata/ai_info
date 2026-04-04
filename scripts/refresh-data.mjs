import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
await loadEnv(root);
const sourcesPath = path.join(root, "config", "sources.json");
const samplePath = path.join(root, "data", "updates.sample.json");
const generatedPath = path.join(root, "data", "updates.generated.json");
const snapshotDir = path.join(root, "data", "snapshots");

const sources = JSON.parse(await readFile(sourcesPath, "utf8")).filter((source) => source.enabled);
const sampleData = JSON.parse(await readFile(samplePath, "utf8"));

await mkdir(snapshotDir, { recursive: true });

const snapshotResults = [];
for (const source of sources) {
  const snapshotPath = path.join(snapshotDir, `${source.id}.json`);
  const previous = await readJsonIfExists(snapshotPath);
  const current = await fetchSourceSnapshot(source);
  const change = describeChange(previous, current);

  const persisted = {
    ...current,
    previousHash: previous?.hash ?? null,
    changed: change.changed,
    changedAt: change.changed ? current.fetchedAt : previous?.changedAt ?? null,
    changeSummary: change.summary
  };

  await writeFile(snapshotPath, JSON.stringify(persisted, null, 2), "utf8");
  snapshotResults.push({ source, previous, current: persisted, change });
}

const generated = buildGeneratedData(snapshotResults, sampleData);
await writeFile(generatedPath, JSON.stringify(generated, null, 2), "utf8");

console.log(`Refreshed ${snapshotResults.length} sources and wrote ${generatedPath}`);

async function fetchSourceSnapshot(source) {
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(source.url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ja;q=0.8",
        "cache-control": "no-cache"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rawText = await response.text();
    if (source.type === "atom" || source.type === "rss") {
      return buildFeedSnapshot(source, rawText, fetchedAt);
    }

    const html = rawText;
    const rawTitle = extractTitle(html) ?? source.label;
    const readable = extractReadableText(html);
    const normalized = normalizeText(readable);
    const title = chooseBestTitle(rawTitle, normalized, source);
    const description = extractMeaningfulDescription(html, normalized) ?? normalized.slice(0, 280);
    const publishedAt = extractPublishedAt({ html, normalizedText: normalized, source });

    return {
      id: source.id,
      sourceId: source.id,
      company: source.company,
      label: source.label,
      url: source.url,
      trustLevel: source.trustLevel ?? "official",
      fetchedAt,
      status: "ok",
      title,
      description,
      publishedAt,
      excerpt: normalized.slice(0, 1600),
      hash: hashText(`${title}\n${description}\n${normalized.slice(0, 4000)}`)
    };
  } catch (error) {
    return {
      id: source.id,
      sourceId: source.id,
      company: source.company,
      label: source.label,
      url: source.url,
      trustLevel: source.trustLevel ?? "official",
      fetchedAt,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      title: source.label,
      description: `${source.company} の取得に失敗しました。次回再試行します。`,
      excerpt: "",
      hash: previousLikeHash(source.id, fetchedAt)
    };
  }
}

function buildFeedSnapshot(source, xml, fetchedAt) {
  const items = extractFeedItems(xml, source.type);
  const latest = items[0] ?? {};
  const title = latest.title || source.label;
  const description = normalizeText(stripTags(latest.description || latest.summary || ""));
  const excerptParts = items
    .slice(0, 5)
    .map((item) => `${item.title || ""} ${normalizeText(stripTags(item.description || item.summary || ""))}`.trim())
    .filter(Boolean);
  const excerpt = excerptParts.join(" ").slice(0, 2000);

  return {
    id: source.id,
    sourceId: source.id,
    company: source.company,
    label: source.label,
    url: source.url,
    trustLevel: source.trustLevel ?? "official",
    fetchedAt,
    status: "ok",
    title,
    description: description || title,
    publishedAt: normalizeDateString(latest.pubDate),
    itemUrl: latest.link || source.url,
    excerpt,
    hash: hashText(`${title}\n${description}\n${excerpt}`)
  };
}

function buildGeneratedData(snapshotResults, sampleData) {
  const generatedAt = new Date().toISOString();
  const changedItems = snapshotResults.filter((item) => item.change.changed && item.current.status === "ok");
  const failedItems = snapshotResults.filter((item) => item.current.status === "error");

  const rankedItems = rankChangedItems(changedItems);
  const alertCandidates = rankedItems.filter(shouldPromoteToAlert);
  const alerts = alertCandidates.slice(0, 2).map((item, index) => toAlert(item, index));

  const alertIds = new Set(alertCandidates.slice(0, 2).map((item) => item.source.id));
  const digest = rankedItems
    .filter((item) => !alertIds.has(item.source.id))
    .map(toDigest);

  if (digest.length === 0) {
    for (const item of snapshotResults.filter((entry) => entry.current.status === "ok").slice(0, 2)) {
      digest.push(toDigest(item));
    }
  }

  const finalAlerts = alerts.length > 0 ? alerts : sampleData.alerts;
  const finalDigest = digest.length > 0 ? digest : sampleData.digest;
  const weeklyThemes = buildThemes(snapshotResults, failedItems);
  const finalThemes = weeklyThemes.length > 0 ? weeklyThemes : sampleData.weeklyThemes;

  return {
    generatedAt,
    summary: {
      urgentCount: finalAlerts.length,
      digestCount: finalDigest.length,
      monitoredCompanies: new Set(snapshotResults.map((item) => item.source.company)).size,
      activeSources: snapshotResults.length
    },
    alerts: finalAlerts,
    digest: finalDigest,
    weeklyThemes: finalThemes,
    sourceHealth: snapshotResults.map((item) => ({
      sourceId: item.source.id,
      company: item.source.company,
      label: item.source.label,
      trustLevel: item.source.trustLevel ?? "official",
      status: item.current.status,
      fetchedAt: item.current.fetchedAt,
      publishedAt: item.current.publishedAt ?? null,
      changed: item.change.changed,
      error: item.current.error ?? null
    }))
  };
}

function toAlert(item, index) {
  const scoreBase = scoreFromSource(item);
  const meaningfulTitle = cleanTitle(item.current.title, item.source.company);
  return {
    id: `${item.source.id}-alert`,
    sourceId: item.source.id,
    company: item.source.company,
    product: item.source.label,
    action: index === 0 ? "今すぐ試す" : "今週理解",
    titleEn: meaningfulTitle,
    titleJa: `${item.source.company} の更新を検知: ${translateTitle(meaningfulTitle)}`,
    summaryJa: summarizeForJapanese(item.current.description, item.current.excerpt, item.source.company),
    whyNow: explainWhyNow(item),
    scores: scoreBase,
    sourceUrl: item.current.itemUrl ?? item.source.url,
    publishedAt: item.current.publishedAt ?? null
  };
}

function toDigest(item) {
  const meaningfulTitle = cleanTitle(item.current.title, item.source.company);
  return {
    id: `${item.source.id}-digest`,
    sourceId: item.source.id,
    company: item.source.company,
    titleJa: `${item.source.company} の一次情報更新: ${translateTitle(meaningfulTitle)}`,
    summaryJa: summarizeForJapanese(item.current.description, item.current.excerpt, item.source.company),
    action: item.change.changed ? "監視" : "定点観測",
    publishedAt: item.current.publishedAt ?? null
  };
}

function buildThemes(snapshotResults, failedItems) {
  const themes = [];

  const changedCount = snapshotResults.filter((item) => item.change.changed && item.current.status === "ok").length;
  if (changedCount > 0) {
    themes.push({
      title: "一次情報の差分を自動検知できる状態に入った",
      body: `${changedCount} 件のソース更新を検出しました。今後はこの差分をもとに、日本語要約と重要度判定の精度を上げていく段階です。`
    });
  }

  const okCompanies = [...new Set(snapshotResults.filter((item) => item.current.status === "ok").map((item) => item.source.company))];
  if (okCompanies.length > 0) {
    themes.push({
      title: "主要監視先の定点観測を開始",
      body: `${okCompanies.join("、")} の一次情報をもとに、スマホで読める個人用ダッシュボードを更新できる基盤ができています。`
    });
  }

  if (failedItems.length > 0) {
    themes.push({
      title: "一部ソースは取得失敗時のフォールバックを保持",
      body: `${failedItems.length} 件のソースで取得失敗がありました。低コスト構成を保ちながら、再試行と通知経路の設計を次段で整える必要があります。`
    });
  }

  return themes.slice(0, 3);
}

function describeChange(previous, current) {
  if (!previous || previous.status !== "ok") {
    return { changed: current.status === "ok", summary: "初回取得" };
  }

  if (current.status !== "ok") {
    return { changed: false, summary: "取得失敗のため変更判定を保留" };
  }

  const changed = previous.hash !== current.hash;
  return {
    changed,
    summary: changed ? "タイトルまたは説明文に差分あり" : "目立つ差分なし"
  };
}

function scoreFromSource(item) {
  const company = item.source.company.toLowerCase();
  const title = `${item.current.title} ${item.current.description} ${item.current.excerpt}`.toLowerCase();

  const contextUx = /(context|memory|workspace|project)/.test(title) ? 5 : 2;
  const workUx = /(workflow|workspace|collaboration|project)/.test(title) ? 4 : 2;
  const workflow = /(task|workflow|agent|project)/.test(title) ? 4 : 2;

  if (company.includes("anthropic")) {
    return { contextUx: Math.max(contextUx, 4), workUx, workflow };
  }

  return { contextUx, workUx, workflow };
}

function rankChangedItems(items) {
  return [...items].sort((left, right) => {
    const trustLeft = trustWeight(left.source.trustLevel);
    const trustRight = trustWeight(right.source.trustLevel);
    if (trustLeft !== trustRight) {
      return trustRight - trustLeft;
    }

    const scoreLeft = totalHeuristicScore(scoreFromSource(left));
    const scoreRight = totalHeuristicScore(scoreFromSource(right));
    if (scoreLeft !== scoreRight) {
      return scoreRight - scoreLeft;
    }

    return (left.source.priority === "high" ? 1 : 0) < (right.source.priority === "high" ? 1 : 0) ? 1 : -1;
  });
}

function shouldPromoteToAlert(item) {
  const scores = scoreFromSource(item);
  const highSignal =
    scores.contextUx >= 5 ||
    scores.workUx >= 5 ||
    scores.workflow >= 5 ||
    totalHeuristicScore(scores) >= 12;

  if ((item.source.trustLevel ?? "official") === "secondary") {
    return highSignal && scores.contextUx >= 4;
  }

  return totalHeuristicScore(scores) >= 8;
}

function totalHeuristicScore(scores) {
  return (scores.contextUx ?? 0) + (scores.workUx ?? 0) + (scores.workflow ?? 0);
}

function trustWeight(trustLevel) {
  return trustLevel === "official" ? 2 : 1;
}

function explainWhyNow(item) {
  if (item.current.status !== "ok") {
    return "取得失敗のため要確認ですが、次回更新で再評価します。";
  }

  const text = `${item.current.title} ${item.current.description} ${item.current.excerpt}`.toLowerCase();
  if (/(context|memory|workspace|project)/.test(text)) {
    return "コンテキストUXや継続作業のやり方に関わる可能性が高く、あなたの優先度に直結するためです。";
  }
  if (/(limit|pricing|tier|performance)/.test(text)) {
    return "性能そのものより、現実的な継続利用のしやすさに影響する可能性があるためです。";
  }
  return "一次情報に変化があり、今後の作業体験の変化につながる可能性があるためです。";
}

function translateTitle(title) {
  return title
    .replace(/^changelog\s*[:\-]?\s*/i, "")
    .replace(/\s+\|\s+/g, " - ")
    .replace(/\s+—\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function summarizeForJapanese(description, excerpt, company) {
  const summary = pickSummarySource(description, excerpt, company).slice(0, 160);
  return summary
    ? `${company} の一次情報から抽出した要点: ${summary}`
    : `${company} の一次情報に更新がありました。詳細確認用の要約生成は次段で改善します。`;
}

function pickSummarySource(description, excerpt, company) {
  const sourceSpecific = extractSourceSpecificSummary(excerpt, company);
  if (sourceSpecific) {
    return sourceSpecific;
  }

  const desc = normalizeText(description);
  if (desc && !looksLikeNavigationNoise(desc)) {
    return desc;
  }
  return firstMeaningfulSentence(excerpt);
}

function extractTitle(html) {
  return matchTagContent(html, "title") ?? matchMetaContent(html, "property", "og:title");
}

function extractMeaningfulDescription(html, normalizedText) {
  const metaDescription = extractMetaDescription(html);
  if (metaDescription && !looksLikeNavigationNoise(metaDescription)) {
    return metaDescription;
  }

  const firstLine = firstMeaningfulSentence(cleanExcerpt(normalizedText));
  return firstLine || null;
}

function extractPublishedAt({ html, normalizedText, source }) {
  const candidates = [
    extractHtmlDatetime(html, "relative-time"),
    extractHtmlDatetime(html, "time"),
    extractGenericDatetimeAttribute(html),
    extractJsonLdDate(html, "datePublished"),
    extractJsonLdDate(html, "dateCreated"),
    extractJsonLdDate(html, "dateModified"),
    matchMetaContent(html, "property", "article:published_time"),
    matchMetaContent(html, "property", "article:modified_time"),
    matchMetaContent(html, "name", "date"),
    extractDateFromText(normalizedText, source)
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeDateString(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return null;
}

function extractHtmlDatetime(html, tagName) {
  const match = html.match(
    new RegExp(`<${tagName}[^>]*datetime=["']([^"']+)["'][^>]*>`, "i")
  );
  return match ? match[1] : null;
}

function extractGenericDatetimeAttribute(html) {
  const match = html.match(/\bdatetime=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractFeedItems(xml, type) {
  if (type === "rss") {
    const matches = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
    return matches.map((match) => {
      const block = match[1];
      return {
        title: extractXmlTag(block, "title"),
        description: extractXmlTag(block, "description"),
        content: extractXmlTag(block, "content:encoded"),
        link: extractXmlTag(block, "link"),
        pubDate: extractXmlTag(block, "pubDate")
      };
    });
  }

  return [...xml.matchAll(/<entry\b[\s\S]*?>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const block = match[1];
    return {
      title: extractXmlTag(block, "title"),
      summary: extractXmlTag(block, "summary"),
      description: extractXmlTag(block, "content"),
      link: extractAtomLink(block),
      pubDate: extractXmlTag(block, "updated")
    };
  });
}

function extractXmlTag(xml, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(pattern);
  return match ? normalizeText(stripTags(stripCdata(match[1]))) : "";
}

function extractAtomLink(xml) {
  const match = xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return match ? match[1] : "";
}

function extractJsonLdDate(html, fieldName) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const content = stripCdata(match[1]).trim();
    if (!content) {
      continue;
    }

    try {
      const parsed = JSON.parse(content);
      const date = findDateField(parsed, fieldName);
      if (date) {
        return date;
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return null;
}

function extractMetaDescription(html) {
  return (
    matchMetaContent(html, "name", "description") ??
    matchMetaContent(html, "property", "og:description")
  );
}

function matchTagContent(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match ? stripTags(match[1]).trim() : null;
}

function matchMetaContent(html, attrName, attrValue) {
  const pattern = new RegExp(
    `<meta[^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*>`,
    "i"
  );

  const match = html.match(pattern) ?? html.match(reversePattern);
  return match ? stripTags(match[1]).trim() : null;
}

function extractReadableText(html) {
  const preferred = extractPreferredContainer(html);
  const target = preferred ?? html;

  return target
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, "$&\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function extractPreferredContainer(html) {
  const candidates = [
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match && match[1] && stripTags(match[1]).trim().length > 200) {
      return match[1];
    }
  }

  return null;
}

function stripTags(text) {
  return text.replace(/<[^>]+>/g, " ");
}

function stripCdata(text) {
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "");
}

function normalizeText(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\u00A0]/g, " ")
    .replace(/Slide \d+ of \d+/gi, " ")
    .replace(/Try in Gemini/gi, " ")
    .replace(/Try in Google AI Studio/gi, " ")
    .replace(/Your browser does not support the video tag\.?/gi, " ")
    .replace(/Skip to main content/gi, " ")
    .replace(/Skip to footer/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(title, company) {
  return normalizeText(title)
    .replace(new RegExp(`\\s*[|\\\\-–—]+\\s*${escapeRegExp(company)}\\s*$`, "i"), "")
    .replace(/\s*[|\\\\-–—]+\s*(OpenAI Help Center|Google DeepMind|Anthropic)\s*$/i, "")
    .trim();
}

function chooseBestTitle(rawTitle, normalizedText, source) {
  const cleaned = cleanTitle(rawTitle, source.company);
  if (!isGenericTitle(cleaned, source)) {
    return cleaned;
  }

  const derived = deriveTitleFromExcerpt(normalizedText, source);
  return derived || cleaned || source.label;
}

function deriveTitleFromExcerpt(normalizedText, source) {
  const cleaned = cleanExcerpt(normalizedText);

  if (source.company === "Anthropic") {
    const anthroMatch = cleaned.match(/Newsroom .*? (?:What )?([A-Z0-9][^.?!]{12,120}?)(?: Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |\.)/);
    if (anthroMatch?.[1]) {
      return anthroMatch[1].trim().replace(/^\d[\d,]*\s+/, "");
    }
  }

  if (source.company === "Google") {
    const googleMatch = cleaned.match(/Gemini 3 ([A-Z][^.?!]{15,90})/);
    if (googleMatch?.[1]) {
      return `Gemini 3: ${googleMatch[1].trim().replace(/\s+Gemini 3.*$/, "")}`;
    }
  }

  if (source.company === "OpenAI") {
    const changelogMatch = cleaned.match(/([A-Z0-9][^.?!]{20,140})/);
    if (changelogMatch?.[1]) {
      return changelogMatch[1].trim();
    }
  }

  return firstMeaningfulSentence(cleaned).slice(0, 90);
}

function isGenericTitle(title, source) {
  const lowered = normalizeText(title).toLowerCase();
  const generic = [
    "newsroom",
    "newsroom anthropic",
    "api changelog",
    "changelog",
    "chatgpt release notes",
    "gemini 3",
    source.label.toLowerCase()
  ];

  return generic.includes(lowered);
}

function firstMeaningfulSentence(text) {
  const normalized = cleanExcerpt(text);
  const parts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (!looksLikeNavigationNoise(part) && part.length > 40) {
      return part;
    }
  }

  return normalized.slice(0, 160);
}

function cleanExcerpt(text) {
  return normalizeText(text)
    .replace(/Explore our next generation AI systems/gi, " ")
    .replace(/Explore models/gi, " ")
    .replace(/Learn, build, and plan anything/gi, " ")
    .replace(/Create and edit detailed images/gi, " ")
    .replace(/Talk, create and control audio/gi, " ")
    .replace(/Generate cinematic video with audio/gi, " ")
    .replace(/Generate high-quality images from text/gi, " ")
    .replace(/Generate high fidelity music and audio/gi, " ")
    .replace(/Press inquires .*? Download press kit/gi, " ")
    .replace(/Newsroom Press inquires .*? Download press kit/gi, "Newsroom ")
    .replace(/Announcements\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/g, " ")
    .replace(/Product\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSourceSpecificSummary(excerpt, company) {
  const cleaned = cleanExcerpt(excerpt);

  if (company === "Anthropic") {
    const match = cleaned.match(/Newsroom .*? [A-Z0-9][^.?!]{10,120}? [A-Z][a-z]{2} \d{1,2}, \d{4} (.{40,220}?\.)/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  if (company === "Google") {
    const match = cleaned.match(/Gemini 3 (.{30,180}?\.)/);
    if (match?.[1]) {
      return match[1]
        .replace(/Gemini 3\.1 Flash-Lite.*$/i, "")
        .replace(/Learn more.*$/i, "")
        .trim();
    }
  }

  return null;
}

function looksLikeNavigationNoise(text) {
  const lowered = normalizeText(text).toLowerCase();
  const patterns = [
    "skip to main content",
    "skip to footer",
    "explore models",
    "learn, build, and plan anything",
    "download on the",
    "openai help center",
    "press inquiries",
    "support@",
    "cookies"
  ];

  return patterns.some((pattern) => lowered.includes(pattern));
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function previousLikeHash(id, fetchedAt) {
  return hashText(`${id}:${fetchedAt}`);
}

function extractDateFromText(text, source) {
  const normalized = cleanExcerpt(text);
  const lines = normalized
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const prioritizedLines =
    source.company === "Anthropic" || source.id.includes("claude-code")
      ? lines
      : [normalized, ...lines];

  for (const line of prioritizedLines) {
    const monthDate = line.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i);
    if (monthDate) {
      return monthDate[0];
    }

    const isoDate = line.match(/\b\d{4}-\d{2}-\d{2}(?:[tT ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/);
    if (isoDate) {
      return isoDate[0];
    }
  }

  return null;
}

function normalizeDateString(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function findDateField(value, fieldName) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findDateField(entry, fieldName);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof value[fieldName] === "string") {
    return value[fieldName];
  }

  for (const nested of Object.values(value)) {
    const found = findDateField(nested, fieldName);
    if (found) {
      return found;
    }
  }

  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readJsonIfExists(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
