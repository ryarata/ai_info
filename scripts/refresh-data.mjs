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
const analyzedPath = path.join(root, "data", "updates.analyzed.json");
const snapshotDir = path.join(root, "data", "snapshots");
const selectedSourceIds = parseCsvEnv(process.env.SOURCE_IDS);
const pinnedItemUrls = parsePinnedItemUrls(process.env.PINNED_SOURCE_ITEM_URLS);
const disableAlertRetention = parseBooleanEnv(process.env.DISABLE_ALERT_RETENTION);

const sources = JSON.parse(await readFile(sourcesPath, "utf8"))
  .filter((source) => source.enabled)
  .filter((source) => selectedSourceIds.size === 0 || selectedSourceIds.has(source.id));
const sampleData = JSON.parse(await readFile(samplePath, "utf8"));
const previousAnalyzed = await readJsonIfExists(analyzedPath);

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

const generated = buildGeneratedData(snapshotResults, sampleData, previousAnalyzed);
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
      return await buildFeedSnapshot(source, rawText, fetchedAt);
    }

    const html = rawText;
    const rawTitle = extractTitle(html) ?? source.label;
    const readable = extractReadableText(html);
    const normalized = normalizeText(readable);
    const title = chooseBestTitle(rawTitle, normalized, source);
    const description = extractMeaningfulDescription(html, normalized) ?? normalized.slice(0, 280);
    const publishedAt = extractPublishedAt({ html, normalizedText: normalized, source });

    const snapshot = {
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
      excerpt: normalized,
      hash: hashText(`${title}\n${description}\n${normalized.slice(0, 4000)}`)
    };

    return await enrichHtmlSnapshot(snapshot, { source, html, fetchedAt });
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

async function enrichHtmlSnapshot(snapshot, context) {
  if (context.source.id === "anthropic-claude-updates") {
    return await enrichAnthropicNewsSnapshot(snapshot, context);
  }

  return snapshot;
}

async function buildFeedSnapshot(source, xml, fetchedAt) {
  const items = extractFeedItems(xml, source.type);
  const selectedItems = selectFeedItemsForSource(items, source);
  const latest = selectedItems[0] ?? {};
  const title = latest.title || source.label;
  const description = normalizeText(stripTags(latest.description || latest.summary || ""));
  const excerptParts = selectedItems
    .slice(0, 5)
    .map((item) => `${item.title || ""} ${normalizeText(stripTags(item.description || item.summary || ""))}`.trim())
      .filter(Boolean);
  const excerpt = excerptParts.join(" ");
  const snapshot = {
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

  if (source.id === "anthropic-claude-code-changelog") {
    return await enrichClaudeCodeSnapshot(snapshot);
  }

  return snapshot;
}

function selectFeedItemsForSource(items, source) {
  const pinnedUrl = pinnedItemUrls.get(source.id);
  if (!pinnedUrl) {
    return items;
  }

  const matched = items.filter((item) => normalizeUrl(item.link) === normalizeUrl(pinnedUrl));
  return matched.length > 0 ? matched : items;
}

async function enrichClaudeCodeSnapshot(snapshot) {
  const sha = extractGitHubCommitSha(snapshot.itemUrl);
  if (!sha) {
    return snapshot;
  }

  const rawUrl = `https://raw.githubusercontent.com/anthropics/claude-code/${sha}/CHANGELOG.md`;

  try {
    const response = await fetch(rawUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
        accept: "text/plain,*/*;q=0.8",
        "cache-control": "no-cache"
      }
    });

    if (!response.ok) {
      return snapshot;
    }

    const markdown = await response.text();
    const relevantSection = extractLatestMarkdownSection(markdown);
    const normalizedSection = normalizeText(relevantSection);
    if (!normalizedSection) {
      return snapshot;
    }

    const derivedTitle = extractFirstMarkdownHeading(relevantSection) ?? snapshot.title;

    return {
      ...snapshot,
      title: derivedTitle,
      description: firstMeaningfulSentence(normalizedSection),
      excerpt: normalizedSection,
      hash: hashText(`${derivedTitle}\n${firstMeaningfulSentence(normalizedSection)}\n${normalizedSection.slice(0, 4000)}`)
    };
  } catch {
    return snapshot;
  }
}

async function enrichAnthropicNewsSnapshot(snapshot, context) {
  const latestArticle = extractAnthropicLatestArticle(snapshot.url, context.html);
  if (!latestArticle?.url) {
    return snapshot;
  }

  try {
    const response = await fetch(latestArticle.url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ja;q=0.8",
        "cache-control": "no-cache"
      }
    });

    if (!response.ok) {
      return {
        ...snapshot,
        itemUrl: latestArticle.url,
        publishedAt: latestArticle.publishedAt ?? snapshot.publishedAt
      };
    }

    const articleHtml = await response.text();
    const articleReadable = extractReadableText(articleHtml);
    const articleNormalized = normalizeText(articleReadable);
    const rawArticleTitle =
      extractHeading(articleHtml, "h1") ??
      extractTitle(articleHtml) ??
      latestArticle.title ??
      snapshot.title;
    const articleTitle = chooseBestTitle(rawArticleTitle, articleNormalized, context.source);
    const articleDescription =
      extractAnthropicArticleDescription(articleHtml, articleNormalized) ??
      latestArticle.summary ??
      snapshot.description;
    const articlePublishedAt =
      latestArticle.publishedAt ??
      extractPublishedAt({ html: articleHtml, normalizedText: articleNormalized, source: context.source }) ??
      snapshot.publishedAt;

    return {
      ...snapshot,
      title: articleTitle,
      description: articleDescription,
      publishedAt: articlePublishedAt,
      itemUrl: latestArticle.url,
      excerpt: articleNormalized,
      hash: hashText(`${articleTitle}\n${articleDescription}\n${articleNormalized.slice(0, 4000)}`)
    };
  } catch {
    return {
      ...snapshot,
      itemUrl: latestArticle.url,
      publishedAt: latestArticle.publishedAt ?? snapshot.publishedAt
    };
  }
}

function buildGeneratedData(snapshotResults, sampleData, previousAnalyzed) {
  const generatedAt = new Date().toISOString();
  const changedItems = snapshotResults.filter((item) => item.change.changed && item.current.status === "ok");
  const failedItems = snapshotResults.filter((item) => item.current.status === "error");

  const rankedItems = rankChangedItems(changedItems);
  const alertCandidates = rankedItems.filter(shouldPromoteToAlert);
  const retainedAlertCandidates = disableAlertRetention ? [] : findRetainedAlertCandidates(snapshotResults, previousAnalyzed);
  const finalAlertCandidates = mergeAlertCandidates(alertCandidates, retainedAlertCandidates);
  const alerts = finalAlertCandidates.slice(0, 2).map((candidate, index) => toAlert(candidate.item, index, candidate.retained));
  const usedSampleAlerts = alerts.length === 0;

  const retainedAlertIds = new Set(finalAlertCandidates.filter((candidate) => candidate.retained).map((candidate) => candidate.item.source.id));
  const alertIds = new Set(finalAlertCandidates.slice(0, 2).map((candidate) => candidate.item.source.id));
  const digest = rankedItems
    .filter((item) => !alertIds.has(item.source.id))
    .map(toDigest);
  const usedFallbackDigest = digest.length === 0;

  if (digest.length === 0) {
    for (const item of snapshotResults.filter((entry) => entry.current.status === "ok").slice(0, 2)) {
      digest.push(toDigest(item));
    }
  }

  const finalAlerts = alerts.length > 0 ? alerts : sampleData.alerts;
  const finalDigest = digest.length > 0 ? digest : sampleData.digest;
  const weeklyThemes = buildThemes(snapshotResults, failedItems);
  const finalThemes = weeklyThemes.length > 0 ? weeklyThemes : sampleData.weeklyThemes;
  const finalAlertIds = new Set((finalAlerts ?? []).map((item) => item.sourceId));
  const finalDigestIds = new Set((finalDigest ?? []).map((item) => item.sourceId));

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
    sourceItems: snapshotResults.map((item) =>
      toSourceItem(item, {
        finalAlertIds,
        finalDigestIds,
        retainedAlertIds,
        usedSampleAlerts,
        usedFallbackDigest
      })
    ),
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

function toSourceItem(item, options) {
  const { finalAlertIds, finalDigestIds, retainedAlertIds, usedSampleAlerts, usedFallbackDigest } = options;

  if (item.current.status !== "ok") {
    return {
      sourceId: item.source.id,
      company: item.source.company,
      label: item.source.label,
      trustLevel: item.source.trustLevel ?? "official",
      status: "error",
      fetchedAt: item.current.fetchedAt,
      publishedAt: item.current.publishedAt ?? null,
      title: item.current.title,
      description: item.current.description,
      sourceUrl: item.current.itemUrl ?? item.source.url,
      classification: "取得失敗",
      classificationReason: `取得エラー: ${item.current.error ?? "unknown"}`
    };
  }

  let classification = "非選定";
  let classificationReason = item.change.changed
    ? "差分は検出されたが、今回の表示優先度では本文表示対象になりませんでした。"
    : "取得は成功しましたが、今回の差分判定では新規の強い更新は検出されませんでした。";

  if (finalAlertIds.has(item.source.id)) {
    classification = usedSampleAlerts ? "アラート表示(サンプル維持)" : "アラート表示";
    classificationReason = usedSampleAlerts
      ? "今回の実行では新規アラート候補がなかったため、サンプルアラートを継続表示しています。"
      : retainedAlertIds.has(item.source.id)
        ? "初回にアラート判定された同一記事のため、今回もアラート表示を維持しています。"
        : "今回の実行で重要度が高い更新としてアラートに分類されました。";
  } else if (finalDigestIds.has(item.source.id)) {
    classification = usedFallbackDigest && !item.change.changed ? "Digest表示(定点観測)" : "Digest表示";
    classificationReason =
      usedFallbackDigest && !item.change.changed
        ? "差分候補が少なかったため、定点観測用にDigestへ掲載しています。"
        : "今回の実行で非緊急だが追うべき更新としてDigestに分類されました。";
  }

  return {
    sourceId: item.source.id,
    company: item.source.company,
    label: item.source.label,
    trustLevel: item.source.trustLevel ?? "official",
    status: "ok",
    fetchedAt: item.current.fetchedAt,
    publishedAt: item.current.publishedAt ?? null,
    title: item.current.title,
    description: item.current.description,
    excerpt: item.current.excerpt,
    sourceUrl: item.current.itemUrl ?? item.source.url,
    changed: item.change.changed,
    classification,
    classificationReason
  };
}

function toAlert(item, index, retained = false) {
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
    publishedAt: item.current.publishedAt ?? null,
    retainedFromPreviousAlert: retained
  };
}

function findRetainedAlertCandidates(snapshotResults, previousAnalyzed) {
  const currentBySource = new Map(
    snapshotResults
      .filter((item) => item.current.status === "ok")
      .map((item) => [item.source.id, item])
  );

  return (previousAnalyzed?.alerts ?? [])
    .map((previousAlert) => {
      const currentItem = currentBySource.get(previousAlert?.sourceId);
      if (!currentItem) {
        return null;
      }

      const previousIdentity = buildArticleIdentity({
        sourceId: previousAlert.sourceId,
        title: previousAlert.titleEn ?? "",
        publishedAt: previousAlert.publishedAt ?? null
      });
      const currentIdentity = buildArticleIdentity({
        sourceId: currentItem.source.id,
        title: cleanTitle(currentItem.current.title, currentItem.source.company),
        publishedAt: currentItem.current.publishedAt ?? null
      });

      if (!previousIdentity || previousIdentity !== currentIdentity) {
        return null;
      }

      return {
        item: currentItem,
        retained: true
      };
    })
    .filter(Boolean);
}

function mergeAlertCandidates(alertCandidates, retainedAlertCandidates) {
  const merged = [];
  const seen = new Set();

  for (const item of alertCandidates) {
    const key = buildArticleIdentity({
      sourceId: item.source.id,
      title: cleanTitle(item.current.title, item.source.company),
      publishedAt: item.current.publishedAt ?? null
    });
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ item, retained: false });
  }

  for (const candidate of retainedAlertCandidates) {
    const key = buildArticleIdentity({
      sourceId: candidate.item.source.id,
      title: cleanTitle(candidate.item.current.title, candidate.item.source.company),
      publishedAt: candidate.item.current.publishedAt ?? null
    });
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(candidate);
  }

  return merged;
}

function buildArticleIdentity({ sourceId, title, publishedAt }) {
  const normalizedSourceId = String(sourceId ?? "").trim();
  const normalizedTitle = normalizeFingerprintText(title);
  const normalizedPublishedAt = normalizeIdentityDate(publishedAt);
  if (!normalizedSourceId || !normalizedTitle || !normalizedPublishedAt) {
    return null;
  }

  return `${normalizedSourceId}@@${normalizedTitle}@@${normalizedPublishedAt}`;
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
    extractLatestEntryDate(normalizedText, source),
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

function extractLatestEntryDate(normalizedText, source) {
  const text = cleanExcerpt(normalizedText);

  const fullDate = extractFirstFullDate(text);
  if (fullDate) {
    return fullDate;
  }

  const contextualDate = extractDateUsingMonthYearContext(text);
  if (contextualDate) {
    return contextualDate;
  }

  // Some pages list recent items as "Mar 17" under a current-year heading or section.
  if (source.company === "OpenAI" || source.company === "Google") {
    const partialDate = extractPartialMonthDate(text);
    if (partialDate) {
      return partialDate;
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

function extractHeading(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? normalizeText(stripTags(match[1])) : null;
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

function extractGitHubCommitSha(url) {
  if (!url) {
    return null;
  }

  const match = url.match(/\/commit\/([0-9a-f]{7,40})/i);
  return match ? match[1] : null;
}

function extractLatestMarkdownSection(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let start = lines.findIndex((line) => /^##\s+/.test(line.trim()));
  if (start === -1) {
    start = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  }
  if (start === -1) {
    return normalized.slice(0, 2000);
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i].trim())) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join("\n").trim();
}

function extractFirstMarkdownHeading(markdown) {
  const match = markdown.match(/^#{1,3}\s+(.+)$/m);
  return match ? normalizeText(match[1]) : null;
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

function extractAnthropicLatestArticle(baseUrl, html) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)];
  const deduped = new Map();

  for (const match of links) {
    const href = resolveUrl(baseUrl, match[1]);
    if (!href || !isLikelyAnthropicArticleUrl(baseUrl, href)) {
      continue;
    }

    const index = match.index ?? 0;
    const context = html.slice(index, index + 1800);
    const contextText = normalizeText(stripTags(context));
    const publishedAt = normalizeDateString(
      extractFirstFullDate(contextText) ??
      extractDateFromText(contextText, { company: "Anthropic", id: "anthropic-claude-updates" })
    );
    const title = extractAnthropicContextTitle(context);
    const summary = extractAnthropicContextSummary(context);
    if (!publishedAt || (!title && !summary)) {
      continue;
    }

    const previous = deduped.get(href);
    const candidate = { url: href, title, summary, publishedAt };
    if (!previous || scoreAnthropicArticleCandidate(candidate) > scoreAnthropicArticleCandidate(previous)) {
      deduped.set(href, candidate);
    }
  }

  const candidates = [...deduped.values()]
    .filter((entry) => entry.publishedAt && (entry.title || entry.summary));

  candidates.sort((left, right) => {
    const timeLeft = Date.parse(left.publishedAt ?? "") || 0;
    const timeRight = Date.parse(right.publishedAt ?? "") || 0;
    return timeRight - timeLeft;
  });

  return candidates[0] ?? null;
}

function resolveUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyAnthropicArticleUrl(baseUrl, href) {
  try {
    const base = new URL(baseUrl);
    const target = new URL(href);
    if (target.origin !== base.origin) {
      return false;
    }

    const pathName = target.pathname.replace(/\/+$/, "") || "/";
    if (pathName === "/" || pathName === "/news") {
      return false;
    }

    return !/\.(svg|png|jpg|jpeg|webp|gif|pdf)$/i.test(pathName);
  } catch {
    return false;
  }
}

function extractAnthropicAnchorTitle(texts) {
  const candidates = texts
    .map((text) => normalizeText(text))
    .filter((text) => {
      if (!text || looksLikeNavigationNoise(text)) {
        return false;
      }

      if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/i.test(text)) {
        return false;
      }

      if (/^(Announcements|Product|Policy|Research)\b/i.test(text)) {
        return false;
      }

      return text.length >= 6 && text.length <= 120;
    })
    .sort((left, right) => left.length - right.length);

  return candidates[0] ?? null;
}

function extractAnthropicAnchorSummary(texts) {
  for (const text of texts) {
    const cleaned = normalizeText(text);
    const summary = cleaned.replace(
      /^(Announcements|Product|Policy|Research)\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+/,
      ""
    );
    if (summary !== cleaned && summary.length >= 40) {
      return summary;
    }
  }

  return null;
}

function extractAnthropicContextTitle(context) {
  const candidates = [
    captureTagText(context, "h1"),
    captureTagText(context, "h2"),
    captureTagText(context, "h3"),
    captureAttribute(context, "alt")
  ]
    .map((text) => normalizeText(text))
    .filter((text) => {
      if (!text || looksLikeNavigationNoise(text)) {
        return false;
      }

      return text.length >= 6 && text.length <= 140;
    })
    .sort((left, right) => left.length - right.length);

  return candidates[0] ?? null;
}

function extractAnthropicContextSummary(context) {
  const paragraph = captureTagText(context, "p");
  const cleaned = normalizeText(paragraph);
  return cleaned && cleaned.length >= 40 ? cleaned : null;
}

function scoreAnthropicArticleCandidate(candidate) {
  return Number(Boolean(candidate.title)) * 2 + Number(Boolean(candidate.summary));
}

function extractAnthropicArticleDescription(html, normalizedText) {
  const heading = extractHeading(html, "h1");
  const subheading = extractHeading(html, "h2");
  const lead = firstMeaningfulSentence(normalizedText);
  const candidates = [
    extractMetaDescription(html),
    subheading,
    lead
  ];

  for (const candidate of candidates) {
    const cleaned = normalizeText(candidate);
    if (!cleaned || cleaned === heading || looksLikeNavigationNoise(cleaned)) {
      continue;
    }

    return cleaned;
  }

  return null;
}

function captureTagText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripTags(match[1]) : null;
}

function captureAttribute(html, attributeName) {
  const match = html.match(new RegExp(`\\b${attributeName}=["']([^"']+)["']`, "i"));
  return match ? match[1] : null;
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

function parseCsvEnv(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseBooleanEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function parsePinnedItemUrls(value) {
  const map = new Map();
  const entries = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const sourceId = entry.slice(0, separatorIndex).trim();
    const url = entry.slice(separatorIndex + 1).trim();
    if (sourceId && url) {
      map.set(sourceId, url);
    }
  }

  return map;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return String(value ?? "").trim().replace(/\/+$/, "");
  }
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

function extractFirstFullDate(text) {
  const match = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i);
  return match ? match[0] : null;
}

function extractDateUsingMonthYearContext(text) {
  const headingMatch = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December),\s+(\d{4})\b/i);
  if (!headingMatch) {
    return null;
  }

  const headingMonth = headingMatch[1];
  const year = headingMatch[2];
  const afterHeading = text.slice(headingMatch.index + headingMatch[0].length, headingMatch.index + headingMatch[0].length + 240);
  const monthDayMatch = afterHeading.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\b/);
  if (!monthDayMatch) {
    return null;
  }

  const monthName = expandShortMonth(monthDayMatch[1]);
  if (!monthName) {
    return null;
  }

  if (!sameMonthName(monthName, headingMonth)) {
    return `${monthName} ${monthDayMatch[2]}, ${year}`;
  }

  return `${headingMonth} ${monthDayMatch[2]}, ${year}`;
}

function extractPartialMonthDate(text) {
  const match = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\b/);
  if (!match) {
    return null;
  }

  const currentYear = new Date().getUTCFullYear();
  const monthName = expandShortMonth(match[1]);
  return monthName ? `${monthName} ${match[2]}, ${currentYear}` : null;
}

function expandShortMonth(value) {
  const map = {
    jan: "January",
    feb: "February",
    mar: "March",
    apr: "April",
    may: "May",
    jun: "June",
    jul: "July",
    aug: "August",
    sep: "September",
    sept: "September",
    oct: "October",
    nov: "November",
    dec: "December"
  };

  return map[value.toLowerCase()] ?? null;
}

function sameMonthName(left, right) {
  return left.slice(0, 3).toLowerCase() === right.slice(0, 3).toLowerCase();
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
