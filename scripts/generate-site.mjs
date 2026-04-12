import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
await loadEnv(root);
const analyzedDataPath = path.join(root, "data", "updates.analyzed.json");
const generatedDataPath = path.join(root, "data", "updates.generated.json");
const sampleDataPath = path.join(root, "data", "updates.sample.json");
const sourcesPath = path.join(root, "config", "sources.json");
const publicDir = path.join(root, "public");

const data = JSON.parse(await readFile(await resolveDataPath(), "utf8"));
const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
const digestItems = buildDigestDisplayItems(data);

const renderBadge = (text) => `<span class="badge">${escapeHtml(text)}</span>`;
const renderCacheBadge = (text) => `<span class="badge cache-badge">${escapeHtml(text)}</span>`;
const renderPublishedAt = (value) =>
  `<p class="published-at">一次情報の投稿日時: ${
    value ? escapeHtml(formatDate(value)) : "取得元から抽出できず"
  }</p>`;

const renderAlert = (alert) => `
  <article class="card alert-card">
    <div class="card-top">
      <div class="badge-row">
        ${renderBadge(alert.company)}
        ${renderBadge(alert.product)}
        ${renderBadge(alert.action)}
        ${renderBadge((alert.trustLevel ?? "official").toUpperCase())}
      </div>
      <a class="link" href="${escapeHtml(alert.sourceUrl)}">原文</a>
    </div>
    <h3>${escapeHtml(alert.titleJa)}</h3>
    ${renderPublishedAt(alert.publishedAt)}
    <p class="summary">${escapeHtml(alert.summaryJa)}</p>
    ${renderInsightList("どう見るか", deriveWatchAngles(alert))}
    <details class="translation">
      <summary>英語原文タイトル</summary>
      <p>${escapeHtml(alert.titleEn)}</p>
    </details>
    <div class="score-row">
      ${renderBadge(`Context UX ${alert.scores.contextUx}`)}
      ${renderBadge(`Work UX ${alert.scores.workUx}`)}
      ${renderBadge(`Workflow ${alert.scores.workflow}`)}
    </div>
    <div class="why-now">
      <strong>今見る理由</strong>
      ${renderRichText(alert.whyNow)}
    </div>
  </article>
`;

const renderDigestItem = (item) => `
  <article class="card digest-card">
    <div class="card-top">
      <div class="badge-row">
        ${renderBadge(item.company)}
        ${renderBadge(item.action)}
        ${renderBadge((item.trustLevel ?? "official").toUpperCase())}
      </div>
      ${item.sourceUrl ? `<a class="link" href="${escapeHtml(item.sourceUrl)}">原文</a>` : ""}
    </div>
    <h3>${escapeHtml(cleanDigestTitleText(item.titleJa, item.company))}</h3>
    ${renderPublishedAt(item.publishedAt)}
    <p class="summary">${escapeHtml(item.summaryJa)}</p>
    ${item.trendJa ? `<div class="why-now"><strong>見立て</strong>${renderRichText(item.trendJa)}</div>` : ""}
  </article>
`;

const renderGroupedItems = (items, renderer, options = {}) =>
  groupByCompany(items)
    .map(
      ([company, groupedItems]) => `
        <details class="company-group" ${shouldOpenGroup(groupedItems, options) ? "open" : ""}>
          <summary class="company-group-head">
            <span class="company-group-title">${escapeHtml(company)}</span>
            <span class="company-group-meta">
              <span class="subtle">${groupedItems.length}件</span>
              <span class="group-toggle">表示</span>
            </span>
          </summary>
          <div class="stack company-group-body">
            ${groupedItems.map(renderer).join("")}
          </div>
        </details>
      `
    )
    .join("");

const renderInsightList = (label, items) =>
  items?.length
    ? `
    <div class="why-now">
      <strong>${escapeHtml(label)}</strong>
      <ul class="insight-list">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `
    : "";

const renderRichText = (value) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "<p>理由は今回の更新で補完します。</p>";
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLike = lines.length > 1 && lines.every((line) => /^[-*・]/.test(line));

  if (bulletLike) {
    return `<ul class="insight-list">${lines
      .map((line) => `<li>${escapeHtml(line.replace(/^[-*・]\s*/, ""))}</li>`)
      .join("")}</ul>`;
  }

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
};

const renderSource = (source) => `
  <article class="source-item">
    <div>
      <strong>${escapeHtml(source.company)}</strong>
      <p>${escapeHtml(source.label)}</p>
    </div>
    <div class="source-meta">
      ${renderBadge(source.type)}
      ${renderBadge(source.trustLevel ?? "official")}
      ${renderBadge(`${source.pollIntervalHours}h`)}
    </div>
  </article>
`;

const renderHealth = (item) => `
  <article class="card health-card ${item.status === "ok" ? "" : "health-error"}">
    <div class="card-top">
      <div class="badge-row">
        ${renderBadge(item.company)}
        ${renderBadge(item.status === "ok" ? "取得成功" : "取得失敗")}
        ${renderBadge(item.trustLevel ?? "official")}
      </div>
      <span class="subtle">${escapeHtml(formatDate(item.fetchedAt))}</span>
    </div>
    <h3>${escapeHtml(item.label)}</h3>
    ${renderPublishedAt(item.publishedAt)}
    <p class="summary">${
      item.status === "ok"
        ? item.changed
          ? "前回取得との差分を検出しました。"
          : "現時点では大きな差分はありません。"
        : `取得エラー: ${escapeHtml(item.error ?? "unknown")}`
    }</p>
  </article>
`;

const renderSourceItem = (item) => `
  <article class="card source-result-card ${item.status === "ok" ? "" : "health-error"}">
    <div class="card-top">
      <div class="badge-row">
        ${renderBadge(item.company)}
        ${renderBadge(item.label)}
        ${renderBadge(item.classification)}
        ${renderBadge((item.trustLevel ?? "official").toUpperCase())}
      </div>
      <a class="link" href="${escapeHtml(item.sourceUrl)}">原文</a>
    </div>
    <h3>${escapeHtml(item.title ?? item.label)}</h3>
    ${renderPublishedAt(item.publishedAt)}
    ${renderCacheInfo(item.sourceId)}
    <p class="summary">${escapeHtml(item.description ?? "抽出本文なし")}</p>
    <details class="translation">
      <summary>抽出本文を見る</summary>
      <p class="summary">長文の本文はブラウザの自動翻訳で読む前提にします。</p>
      <div class="translation-block">
        <strong>抽出本文:</strong>
        <p class="translation-long">${escapeHtml(item.excerpt ?? item.description ?? "抽出本文なし")}</p>
      </div>
    </details>
    <div class="why-now">
      <strong>今回の分類</strong>
      <p>${escapeHtml(item.classificationReason ?? "分類理由なし")}</p>
    </div>
  </article>
`;

const renderCacheInfo = (sourceId) => {
  const cacheInfo = data.analysis?.cache?.bySource?.[sourceId];
  if (!cacheInfo) {
    return "";
  }

  const labels = [
    cacheInfo.alert ? `Alert ${formatCacheStatus(cacheInfo.alert)}` : null,
    cacheInfo.digest ? `Digest ${formatCacheStatus(cacheInfo.digest)}` : null
  ].filter(Boolean);

  if (labels.length === 0) {
    return "";
  }

  const reasons = [
    cacheInfo.alert === "regenerated" && cacheInfo.alertReason
      ? `Alert: ${formatCacheReason(cacheInfo.alertReason, cacheInfo.alertReasonDetail)}`
      : null,
    cacheInfo.digest === "regenerated" && cacheInfo.digestReason
      ? `Digest: ${formatCacheReason(cacheInfo.digestReason, cacheInfo.digestReasonDetail)}`
      : null
  ].filter(Boolean);

  return `
    <div class="cache-row">${labels.map(renderCacheBadge).join("")}</div>
    ${reasons.length > 0 ? `<p class="cache-reason">${escapeHtml(reasons.join(" / "))}</p>` : ""}
  `;
};

const html = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Update Intel</title>
    <meta name="theme-color" content="#2e5b4b" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Personal dashboard</p>
          <h1>AI Update Intel</h1>
          <p class="subtle">更新日時: ${escapeHtml(formatDate(data.generatedAt))}</p>
        </div>
      </header>

      <section class="hero-grid">
        <article class="metric-card">
          <span>緊急アラート</span>
          <strong>${data.summary.urgentCount}</strong>
        </article>
        <article class="metric-card">
          <span>今日のDigest</span>
          <strong>${digestItems.length}</strong>
        </article>
        <article class="metric-card">
          <span>監視企業</span>
          <strong>${data.summary.monitoredCompanies}</strong>
        </article>
        <article class="metric-card">
          <span>アクティブソース</span>
          <strong>${data.summary.activeSources}</strong>
        </article>
      </section>

      <section class="section-block">
        <div class="section-head">
          <h2>今回の分析キャッシュ</h2>
          <span class="subtle">再利用された項目と再生成された項目</span>
        </div>
        <article class="card">
          <div class="badge-row">
            ${renderCacheBadge(`Alert cache ${data.analysis?.cache?.summary?.alertCacheHits ?? 0}`)}
            ${renderCacheBadge(`Alert regen ${data.analysis?.cache?.summary?.alertRegenerated ?? 0}`)}
            ${renderCacheBadge(`Digest cache ${data.analysis?.cache?.summary?.digestCacheHits ?? 0}`)}
            ${renderCacheBadge(`Digest regen ${data.analysis?.cache?.summary?.digestRegenerated ?? 0}`)}
          </div>
        </article>
      </section>

      <section class="section-block">
        <div class="section-head">
          <h2>今すぐ確認したい更新</h2>
          <span class="subtle">スマホで最優先表示</span>
        </div>
        ${renderGroupedItems(data.alerts, renderAlert, { defaultOpen: true })}
      </section>

      <section class="section-block">
        <div class="section-head">
          <h2>今日のDigest</h2>
          <span class="subtle">各社ごとに今日押さえる更新を1枚で確認</span>
        </div>
        ${renderGroupedItems(digestItems, renderDigestItem, { defaultOpen: false })}
      </section>

      <section class="section-block">
        <div class="section-head">
          <h2>監視ソース</h2>
          <span class="subtle">低コスト運用向け最小構成</span>
        </div>
        <div class="source-list">
          ${sources.map(renderSource).join("")}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <h2>取得できた内容と分類</h2>
          <span class="subtle">取得結果をすべて表示し、今回の採否を明示</span>
        </div>
        ${renderGroupedItems(data.sourceItems ?? [], renderSourceItem, { defaultOpen: true })}
      </section>

      <section class="section-block">
        <div class="section-head">
          <h2>取得状況</h2>
          <span class="subtle">定期実行のヘルスチェック</span>
        </div>
        <div class="stack">
          ${(data.sourceHealth ?? []).map(renderHealth).join("")}
        </div>
      </section>
    </main>
  </body>
</html>`;

const css = `:root {
  --bg: #f4f1ea;
  --panel: #fffdf8;
  --ink: #1f1b16;
  --muted: #6f675e;
  --line: #ddd3c8;
  --line-strong: #b7aa9c;
  --accent: #2e5b4b;
  --alert: #fff4e7;
  --shadow: 0 12px 32px rgba(46, 34, 22, 0.08);
  --radius: 18px;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", "Hiragino Sans", sans-serif;
  background: linear-gradient(180deg, #f7f2ea 0%, #efe7dc 100%);
  color: var(--ink);
}
.app-shell {
  width: min(760px, calc(100vw - 24px));
  margin: 0 auto;
  padding: 18px 0 40px;
}
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  padding: 8px 4px 18px;
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
h1 {
  margin: 0;
  font-size: clamp(28px, 8vw, 42px);
  line-height: 1.05;
}
.subtle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.hero-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.metric-card, .card, .source-item {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.metric-card {
  padding: 16px;
}
.metric-card span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
}
.section-block {
  margin-top: 18px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: end;
  margin-bottom: 10px;
}
.section-head h2 {
  margin: 0;
  font-size: 17px;
}
.stack {
  display: grid;
  gap: 12px;
}
.company-group + .company-group {
  margin-top: 14px;
}
.company-group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 253, 248, 0.9);
  cursor: pointer;
}
.company-group-head::-webkit-details-marker {
  display: none;
}
.company-group-title {
  font-size: 16px;
  font-weight: 600;
}
.company-group-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.group-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #f8f4ee;
  color: var(--muted);
  font-size: 11px;
}
.company-group[open] .group-toggle::after {
  content: "中";
}
.company-group:not([open]) .group-toggle::after {
  content: "開";
}
.company-group-body {
  margin-top: 10px;
}
.card {
  padding: 16px;
}
.alert-card {
  background: linear-gradient(180deg, var(--alert) 0%, var(--panel) 100%);
}
.health-card {
  background: linear-gradient(180deg, #f5f7f2 0%, var(--panel) 100%);
}
.health-error {
  background: linear-gradient(180deg, #fff1ee 0%, var(--panel) 100%);
}
.card-top, .badge-row, .source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.badge-row {
  justify-content: start;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #f8f4ee;
  color: var(--muted);
  font-size: 11px;
}
.cache-badge {
  background: #eef6f2;
  color: var(--accent);
  border-color: #cfe2d8;
}
.badge:nth-child(4) {
  letter-spacing: 0.03em;
}
.link {
  color: var(--accent);
  font-size: 13px;
  text-decoration: none;
}
h3 {
  margin: 12px 0 8px;
  font-size: 18px;
  line-height: 1.4;
}
.summary {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
  font-size: 14px;
}
.published-at {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  line-height: 1.5;
}
.translation {
  margin-top: 12px;
}
.translation summary {
  cursor: pointer;
  color: var(--accent);
  font-size: 13px;
}
.translation p, .why-now p {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.7;
  font-size: 14px;
}
.translation-block {
  margin-top: 10px;
}
.cache-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 10px;
}
.cache-reason {
  margin: -2px 0 10px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.translation-long {
  white-space: pre-wrap;
  max-height: 48vh;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fbf7f1;
}
.score-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.why-now {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.why-now strong {
  font-size: 13px;
}
.insight-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--ink);
}
.insight-list li + li {
  margin-top: 6px;
}
.source-list {
  display: grid;
  gap: 10px;
}
.source-item {
  padding: 14px 16px;
}
.source-item strong {
  display: block;
}
.source-item p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.source-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  .topbar, .section-head {
    flex-direction: column;
    align-items: stretch;
  }
  .hero-grid {
    grid-template-columns: 1fr 1fr;
  }
}
`;

const manifest = {
  name: "AI Update Intel",
  short_name: "AI Intel",
  start_url: "./index.html",
  display: "standalone",
  background_color: "#f7f2ea",
  theme_color: "#2e5b4b",
  lang: "ja"
};

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, "index.html"), html, "utf8");
await writeFile(path.join(publicDir, "styles.css"), css, "utf8");
await writeFile(path.join(publicDir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2), "utf8");

console.log(`Generated site in ${publicDir}`);

async function resolveDataPath() {
  try {
    await readFile(analyzedDataPath, "utf8");
    return analyzedDataPath;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  try {
    await readFile(generatedDataPath, "utf8");
    return generatedDataPath;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return sampleDataPath;
    }
    throw error;
  }
}

function buildDigestDisplayItems(currentData) {
  const digestByCompany = new Map((currentData.digest ?? []).map((item) => [item.company ?? "Unknown", item]));

  for (const [company, items] of groupByCompany(currentData.sourceItems ?? [])) {
    if (digestByCompany.has(company)) {
      continue;
    }

    const representative = pickDigestSourceItem(items);
    if (!representative) {
      continue;
    }

    digestByCompany.set(company, {
      id: `${representative.sourceId}-company-digest`,
      sourceId: representative.sourceId,
      company,
      titleJa:
        representative.status === "ok"
          ? buildDigestTitle(company, representative)
          : `${company} の今日のDigest: 一次情報の取得失敗`,
      summaryJa:
        representative.status === "ok"
          ? buildDigestSummary(company, representative)
          : `${company} の主要ソースは今回の実行で取得できませんでした。更新有無の判断は保留です。`,
      trendJa:
        representative.status === "ok"
          ? buildDigestTrend(company, representative)
          : "まずは次回の取得成功を待って、更新有無の判断を再開します。",
      action: representative.changed ? "監視" : "定点観測",
      trustLevel: representative.trustLevel ?? "official",
      publishedAt: representative.publishedAt ?? null,
      sourceUrl: representative.sourceUrl
    });
  }

  return [...digestByCompany.values()];
}

function pickDigestSourceItem(items) {
  return [...items].sort((left, right) => compareDigestSourceItems(left, right))[0] ?? null;
}

function compareDigestSourceItems(left, right) {
  const leftScore = digestSourceScore(left);
  const rightScore = digestSourceScore(right);
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
  const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;
  return rightTime - leftTime;
}

function digestSourceScore(item) {
  let score = item.status === "ok" ? 100 : 0;
  if (item.changed) {
    score += 20;
  }
  if ((item.trustLevel ?? "official") === "official") {
    score += 10;
  }
  return score;
}

function deriveWatchAngles(alert) {
  const explicit = Array.isArray(alert.watchAngles) ? alert.watchAngles.filter(Boolean) : [];
  if (explicit.length > 0) {
    return explicit;
  }

  const text = String(alert.whyNow ?? "").trim();
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.replace(/^[-*・]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildDigestTitle(company, representative) {
  const translatedTitle = firstNonEmpty(
    representative.translated?.titleJa,
    representative.title,
    representative.label
  );
  const cleanedTitle = cleanDigestTitleText(translatedTitle, company);
  return cleanedTitle || `${company} の更新`;
}

function buildDigestSummary(company, representative) {
  const translated = firstNonEmpty(
    representative.translated?.descriptionJa,
    representative.description
  );
  const text = String(translated ?? "").trim();

  if (!text) {
    return `${company} の一次情報を取得しました。詳細は原文と抽出本文訳を確認してください。`;
  }

  if (looksJapaneseText(text)) {
    return text;
  }

  return `${company} の一次情報を取得しました。詳細は抽出本文訳を確認してください。`;
}

function buildDigestTrend(company, representative) {
  if (representative.changed) {
    return "この更新を起点に、数週間は関連機能の拡張や運用面の追従が続く前提で見ておくと良さそうです。";
  }

  if ((representative.trustLevel ?? "official") !== "official") {
    return "二次情報なので、まずは公式側で同種の更新が出るかを待ちながら温度感だけ追うのが良さそうです。";
  }

  if (representative.publishedAt) {
    return "直近の大きな差分は見えないため、当面は定点観測を続けつつ次の明確な仕様変化を待つ段階です。";
  }

  return "まだ鮮明な変化点は読みにくいため、取得精度を見ながら次回以降の更新を待つのがよさそうです。";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function groupByCompany(items = []) {
  const groups = new Map();
  for (const item of items) {
    const company = item.company ?? "Unknown";
    if (!groups.has(company)) {
      groups.set(company, []);
    }
    groups.get(company).push(item);
  }
  return [...groups.entries()];
}

function shouldOpenGroup(items, options) {
  if (options.defaultOpen) {
    return true;
  }
  return items.length === 1 && (items[0].trustLevel ?? "official") === "official";
}

function formatCacheStatus(status) {
  const labels = {
    cache_hit: "cache",
    regenerated: "regen",
    fallback: "fallback",
    skipped_no_snapshot: "skip",
    skipped_non_ok: "skip",
    unknown: "unknown"
  };

  return labels[status] ?? status;
}

function formatCacheReason(reason, detail) {
  const labels = {
    no_previous_translation: "前回翻訳が未保存",
    no_previous_source_item: "前回 source item が未保存",
    no_previous_alert_analysis: "前回 Alert 分析が未保存",
    no_previous_digest_analysis: "前回 Digest 分析が未保存",
    title_changed: "title が変化",
    description_changed: "description が変化",
    excerpt_changed: "excerpt が変化",
    publishedAt_changed: "publishedAt が変化",
    sourceUrl_changed: "sourceUrl が変化"
  };

  const label = labels[reason] ?? reason;
  if (!detail?.previous && !detail?.current) {
    return label;
  }

  return `${label} (prev: ${detail.previous ?? ""} / current: ${detail.current ?? ""})`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function cleanDigestTitleText(value, company) {
  return String(value ?? "")
    .replace(new RegExp(`^${escapeRegExp(company)}\\s*の今日のDigest[:：]?\\s*`, "i"), "")
    .replace(/^changelog\s*[:|：-]?\s*/i, "変更履歴: ")
    .replace(/\s+\|\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksJapaneseText(text) {
  return /[ぁ-んァ-ン一-龠々ー]/.test(String(text ?? ""));
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
