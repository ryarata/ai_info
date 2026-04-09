# AI Update Service Context

## Purpose

This document captures both the original product intent and the current implementation state of
the personal AI update intelligence service.

It exists so future work can resume with the right context, without losing:

- why this product is being built
- what the user cares about most
- how updates should be evaluated
- what has already been implemented
- what is still intentionally unresolved

## Core Problem

The pace of progress in generative AI and AI agent products has become fast enough that ad hoc
catch-up is no longer sufficient.

The immediate trigger for this product was the user's experience of starting to use
`claude cowork` only recently and feeling regret about not adopting it during the roughly two
months after release. The user believes this happened because:

- understanding of the path from earlier AI systems to modern generative AI was still shallow
- the underlying approaches and product ideas were not sufficiently understood
- important changes were recognized only after they had already become materially useful

The product should reduce this type of regret.

## Product Direction

This is not meant to be a general AI news summarizer.

It should act as a personal system for:

- preventing important misses
- quickly understanding first-party updates
- detecting updates that change how work should be done
- separating immediate action from medium-term strategic interpretation
- translating important English-language source material into easy-to-read Japanese

The user especially wants a system that ingests first-party information such as release notes,
official blogs, product update pages, and other primary sources, then interprets them through a
personal decision-making lens.

## Primary Monitoring Scope

The highest-priority targets are frontier AI platform companies whose updates are likely to define
future product and workflow standards:

- OpenAI
- Anthropic
- xAI / Grok
- Google
- leading Chinese AI companies

The product currently starts narrower in implementation, but this is still the intended strategic
scope.

## What Must Not Be Missed

The single most important category is:

- major updates to existing services

New services still matter, but they are secondary to meaningful updates in already important
products.

## Practical Assumptions Added During Discussion

### 1. This is a personal-only product

Implications:

- generic onboarding or explanatory marketing UI is unnecessary
- the interface should feel like a personal operational tool
- optimize for speed, density, and personal utility over broad discoverability

### 2. Translation support is essential

Implications:

- outputs should default to natural Japanese
- important source excerpts should be translated or summarized in Japanese
- readability should improve without losing fidelity to the source

### 3. Smartphone-first consumption is strongly preferred

Implications:

- mobile reading flow is the primary UX assumption
- desktop is secondary
- the product should optimize for quick reading, triage, and low-friction follow-up on mobile

### 4. The product should be web-based and easy to check regularly

Implications:

- the delivery model should be web-first
- the product should be fast to reopen on mobile
- the user may still rely on periodic manual checking rather than interruptive delivery

### 5. Server cost should be minimized

Implications:

- prefer static or mostly static delivery where practical
- prefer scheduled jobs over always-on servers
- keep hosting, persistence, and operations lightweight

## Key Product Thesis

The service should optimize for:

- "What changed that should alter how I work now?"
- "What changed that matters for the next 3 to 6 months?"
- "What would I regret learning too late?"
- "Can I understand the update quickly in Japanese on my phone?"

The core value is not broad coverage. The core value is strong interpretation.

## User Priorities By Evaluation Axis

The original discussion produced ten possible evaluation axes, but the user clarified that they
should not be treated equally.

### 1. Performance leap

Priority: high, but primarily for strategic interpretation rather than immediate action.

Implications:

- track performance progress carefully
- emphasize likely future implications such as capacity, inference cost, pricing pressure, and UX
  shifts
- do not over-prioritize raw performance as an interruptive alert unless it also changes workflow

### 2. Expansion of capabilities

Priority: low for this product's initial scope.

Implications:

- include as supplementary information
- do not center this in the first version
- may become its own specialized media product later

### 3. Expansion of the user base

Priority: low.

Implications:

- capture, but keep low-weight in ranking

### 4. Pricing change

Priority: medium.

Implications:

- interpret as operational viability rather than price alone
- focus on limits, plan utility, and usable cost-performance

### 5. UX change

Priority: highest.

Implications:

- especially important when the update changes how context is handled
- context-related UX changes should trigger immediate attention and likely immediate adoption
- context UX should be treated as the strongest signal in the system

### 6. Developer impact

Priority: medium to high.

Implications:

- interpret as foundational or platform impact
- use it to identify shifts likely to shape the broader ecosystem

### 7. Workflow replaceability

Priority: high, but often inferred rather than explicitly stated.

Implications:

- treat this as an interpretation layer, not only a literal release-note claim
- estimate whether the user's workflow becomes shorter, smoother, or easier to resume

### 8. Signal of standardization

Priority: low.

Implications:

- major players will often be copied anyway
- standardization itself is less useful than understanding the source change directly

### 9. Need for continued use

Priority: low to medium.

Implications:

- keep as secondary metadata rather than a top-level score driver

### 10. Relevance to the user

Priority: derived from all of the above.

Implications:

- personalization should come from the user's stated weighting and decision style
- the product should not judge importance through an average-user lens

## Refined Core Axes For The Product

The ten original axes should be reduced into a practical scoring model for the initial version.

### A. Context UX change

Highest priority.

Examples:

- long-term memory
- cross-session context continuity
- project-level knowledge organization
- improved handling of large multi-file or multi-document contexts
- resumable working state

### B. Work UX change

Very high priority.

Examples:

- movement from simple chat toward workspace-style interaction
- support for long-running tasks
- improved collaboration surfaces
- lower friction in review, iteration, and correction

### C. Workflow compression

High priority.

Examples:

- fewer back-and-forth loops
- lower handoff cost
- fewer prompt reconstruction steps
- AI becomes more effective across a full task arc, not only a single response

### D. Medium-term impact of performance progress

High strategic priority.

Examples:

- performance gains that may relax limits over time
- efficiency improvements that affect infrastructure pressure
- quality changes likely to unlock future UX improvements

### E. Operational viability change

Medium priority.

Examples:

- usable rate limits improve
- plan economics improve
- practical sustained use becomes easier

### F. Foundational or platform impact

Medium priority.

Examples:

- APIs or developer primitives shift what downstream products can be built
- an update changes the substrate other teams will likely depend on

## Recommended Weighting

- Context UX change: 5
- Work UX change: 4
- Workflow compression: 4
- Medium-term performance impact: 3
- Operational viability change: 2
- Foundational or platform impact: 2
- Capability expansion: 1
- User base expansion: 1
- Standardization signal: 1
- Continued-use need: 1

## Strong-Alert Conditions

An update should trigger immediate high-priority handling if any of the following is very strong:

- context UX change
- work UX change
- workflow compression

These are the updates most likely to produce "I wish I had started using this earlier" regret.

## Output Model

The service separates outputs into two tracks.

### Immediate alerts

For updates that should change current behavior soon:

- context UX change
- work UX change
- workflow compression
- clear "try now" recommendations

### Periodic reports

For updates that matter more as interpretation than immediate action:

- performance progression
- pricing and limit shifts
- foundational ecosystem changes
- likely effects over the next 3 to 6 months

## Product Identity

The service is a blend of:

- release-note intelligence
- regret prevention
- first-party update interpretation
- workflow-change detection
- strategic AI trend briefing
- translation-assisted mobile intelligence

## Current Product Shape

The implementation is now a static-first personal web application with scheduled generation.

Current shape:

- smartphone-first reading experience
- Japanese summaries in the UI
- first-party sources where possible
- explicit `official` vs `secondary` source distinction
- low-cost deployment via GitHub Pages
- scheduled refresh and redeploy via GitHub Actions

This means the product is no longer only a design concept. It already exists as a working personal
tool with automated updates.

## Current Technical Direction

The product currently follows this low-cost architecture:

- static site output generated into `public/`
- scheduled fetch, analysis, and build pipeline
- JSON-based storage for generated artifacts and snapshots
- OpenAI API used for Japanese analysis and interpretation
- GitHub Pages used as the delivery surface
- GitHub Actions used for refresh and deployment

This intentionally avoids always-on backend infrastructure.

## Current Source Strategy

The intended philosophy remains primary-source first, but implementation now distinguishes between:

- `official`
- `secondary`

### Why the split exists

Some vendors, especially OpenAI, block direct machine access to certain official pages from this
environment. That means the product must preserve truthfulness without pretending every important
source is equally available.

### Current active monitored sources

- OpenAI API changelog route on developers.openai.com: official and fetchable
- OpenAI ChatGPT release notes help route: configured, but currently blocked by `403`
- OpenAI status history feed: official and fetchable
- OpenAI TestingCatalog ChatGPT RSS: secondary support source
- Anthropic Claude updates: official
- Anthropic Claude Code changelog docs: official
- Google Gemini updates: official
- Google Gemini API release notes on `ai.google.dev`: official
- Google Gemini app release notes on `gemini.google`: official
- Grok release notes on `grok.com`: official
- xAI developer release notes on `docs.x.ai`: official

### Latest source-selection changes

Recent source-review decisions that should be preserved:

- Qwen was removed from active monitoring for now
- reason: the currently tested Qwen surface appears to update progressively in a way that is not a
  good fit for this fetch path, so extraction quality was not reliable enough
- Gemini app monitoring now prefers `https://gemini.google/release-notes/` over the older
  `blog.google` Gemini page because the release-note structure is much more extraction-friendly
- xAI developer release notes now use source-specific extraction to isolate only the latest release
  block rather than the full page

Implication:

- the system should prefer sources that expose stable latest-item structure over pages that are
  visually rich but extraction-hostile
- experimental sources that do not produce trustworthy latest-item extraction should be removed
  rather than kept as noisy placeholders

### Current trust behavior

- official sources rank above secondary sources
- secondary items are clearly labeled in the UI
- secondary items are summarized more conservatively
- secondary items are much harder to promote to immediate alerts

This is an important design choice and should be preserved unless a better OpenAI official source
path is found.

## OpenAI Access Constraint

The current implementation discovered that several public OpenAI update routes return `403` from
this execution environment, while other OpenAI-owned routes remain accessible.

Observed behavior:

- `platform.openai.com/docs/changelog`: blocked
- `developers.openai.com/api/docs/changelog`: accessible
- `help.openai.com/ja-jp/articles/6825453-chatgpt-release-notes`: blocked
- product release-note or help-style routes: blocked
- `status.openai.com/history.atom`: accessible
- `openai.com/sitemap.xml`: accessible

Interpretation:

- OpenAI is not fully unreachable
- certain route families appear protected by bot or access controls
- the issue is not a general code failure, but route-specific fetch restrictions

Implication:

- OpenAI monitoring currently combines official status data with a clearly marked secondary source
- future work may revisit official acquisition methods, but current behavior is intentional

## Current Pipeline

The implemented pipeline is:

1. fetch monitored sources
2. store normalized snapshots in `data/snapshots/`
3. detect changed or meaningful items
4. generate `data/updates.generated.json`
5. analyze updates into Japanese summaries and structured interpretation
6. generate `data/updates.analyzed.json`
7. build the mobile-oriented static site in `public/`
8. deploy to GitHub Pages

## Current Script Responsibilities

Important implemented scripts:

- `scripts/load-env.mjs`: loads `.env`
- `scripts/refresh-data.mjs`: source fetching, snapshotting, and generated update creation
- `scripts/analyze-updates.mjs`: OpenAI-powered Japanese analysis and interpretation
- `scripts/generate-site.mjs`: builds the static site assets
- `scripts/serve-preview.mjs`: local preview server

Current package flow:

- `npm run refresh` runs fetch -> analyze -> build

## Current Analysis Behavior

The product now supports LLM-assisted analysis using OpenAI.

### Environment model behavior

- `.env` is supported locally
- `OPENAI_API_KEY` is required for OpenAI-powered analysis
- `OPENAI_MODEL` defaults to `gpt-4.1`

### Output behavior

When analysis runs successfully, the product generates:

- Japanese titles
- Japanese summaries
- short reasoning for why an update matters
- simple score fields
- weekly-theme style interpretation

If no API key is available, the pipeline can still fall back, but the intended production mode is
OpenAI-powered analysis.

## Current UI Behavior

The generated site already includes several design choices that reflect the user's priorities.

### Reading experience

- smartphone-first layout
- Japanese-first reading flow
- company-grouped alert and digest views
- collapsible company sections to reduce mobile scrolling

### Trust and prioritization

- `OFFICIAL` and `SECONDARY` badges are visible
- official items are favored in ranking
- secondary items are less likely to become alerts

### Delivery details

- alert sections default open
- digest sections are more compressed
- basic PWA-style assets exist
- the top-of-page generated timestamp is rendered in JST rather than server-local or UTC time
- no browser push or on-open notification behavior is currently enabled

### Latest notification-removal state

The notification feature was not just deprioritized conceptually. It was actively removed from the
current shipped UI and generated assets.

Current intended behavior:

- there is no notification button in the top-right of the dashboard
- there is no browser-side on-open notification logic
- there is no generated `public/sw.js`
- GitHub Pages remains the delivery target without any push registration path

Reason:

- the user decided the notification feature was not important enough to justify the added runtime,
  storage, and security complexity

## Latest Review-Driven Product Decisions

The most recent review clarified an important product requirement:

- the system must not hide what it successfully fetched
- the user wants to inspect both accepted and rejected items
- classification should be visible as a judgment layer on top of fetched content, not a black box

This is not a minor UI preference. It is now part of the product philosophy.

### Why this matters

Earlier behavior made it too hard to answer:

- what content was actually fetched
- whether a source was successfully parsed
- whether a source was excluded because of ranking or because extraction failed
- whether a model-level interpretation problem was actually an extraction problem

The user explicitly wants the product to support review of the system's own judgment.

Implication:

- every active source should expose its fetched result when possible
- the UI should clearly distinguish fetch success, extraction result, and final classification
- the product should make it easy to inspect what the system saw before deciding importance

## Latest Transparency Layer Added

The product now includes an explicit per-source review surface for all active monitored sources.

Current intended behavior:

- every source is shown in a dedicated "fetched content and classification" section
- each source card shows the extracted title
- each source card shows the extracted description or source-derived summary text
- each source card shows the latest extracted source datetime when available
- each source card shows a classification label
- each source card shows a short explanation for why it was classified that way

Current classification states include:

- alert display
- digest display
- digest display for steady-state monitoring
- not selected
- fetch failed
- sample alert retained

This transparency layer exists so the user can evaluate:

- whether extraction quality is good enough
- whether ranking logic is correct
- whether model analysis is over- or under-interpreting the source

## Latest Translation Inspection Layer Added

The user requested the ability to inspect not only summaries and classifications, but also a direct
Japanese reading layer for the extracted source content itself.

Current intended behavior:

- each successfully fetched source card includes a collapsible translation section
- the translation section shows:
  - translated title
  - translated extracted description
  - translated extracted excerpt
- the translation should be faithful and should not add interpretation
- the translation layer exists to help the user personally judge what the source means

Important product principle:

- translated extracted source content is distinct from analysis
- translation should preserve ambiguity and noisiness where the source is noisy
- analysis and prioritization should remain separate from raw translation

This is now an intentional design principle and should be preserved.

## Latest Claude Code Changelog Fix

An important issue was discovered during review:

- the Claude Code changelog source was previously only surfacing the commit feed title such as
  `chore: Update CHANGELOG.md`
- this exposed the fact that the system knew a changelog file changed, but not what changed in the
  changelog itself

This was considered insufficient.

### Current intended behavior

The Claude Code changelog source now uses a hybrid strategy:

- latest commit datetime still comes from the official commit Atom feed
- the commit SHA is extracted from the latest feed entry link
- the system then fetches the corresponding `CHANGELOG.md` raw file at that exact commit
- the system extracts the latest changelog section from the markdown body
- the extracted markdown section becomes the source title, description, and excerpt basis

This preserves:

- official upstream provenance
- reliable latest-change datetime
- direct mapping to the changelog-changing commit
- real update content rather than only commit metadata

This is an important implementation improvement and should not be reverted.

## Current Interpretation Of Selection Output

The latest review also clarified how to interpret the current `alert` and `digest` sections.

Important current caveat:

- when no new alert candidates are detected, the generated layer can still retain sample alert
  content
- this means the top-of-page alert section may not always be a direct reflection of newly fetched
  items from the current run

Because of this, the per-source transparency section is now especially important.

Implication:

- when reviewing whether the system is making good judgments, the user should inspect per-source
  fetched content and classification reasons, not only the top-level alert cards

Future work may reduce or remove sample-data fallback behavior, but for now the context document
should preserve that this was identified as a real source of confusion.

## Recent Changes To Preserve

The implementation changed materially during the most recent round of work and the next chat
should assume these are intentional, current behaviors.

### 1. Primary-source post datetime is now part of the product

The UI and data pipeline now attempt to show the post datetime for each content item.

Important behavior:

- `publishedAt` is stored in snapshots, generated updates, analyzed updates, and rendered HTML
- the system should prioritize the datetime of the latest update item on the page, not only the
  page-level publication date
- feed-based sources already use the latest entry date directly
- if a source exposes no usable date, the UI currently shows that the datetime could not be
  extracted rather than pretending certainty

Current observed examples from the latest successful run:

- OpenAI API changelog latest entry date is being interpreted as `2026-03-17`
- Anthropic Claude product updates latest visible item date is being interpreted as `2026-03-18`
- Claude Code changelog latest commit date is being interpreted as `2026-04-04`

### 2. OpenAI API changelog source was migrated

The old official OpenAI changelog route on `platform.openai.com` is still blocked, but the
developers site route is now reachable and should be treated as the primary official source.

Current intended source:

- `https://developers.openai.com/api/docs/changelog`

This means future work should not assume the OpenAI API changelog is fundamentally inaccessible.
The previous blockage was route-specific.

### 3. Claude Code changelog monitoring now uses a file-history feed

Monitoring Claude Code changelog through the docs route was not sufficient for reliable datetime
extraction. The implementation now monitors the official `CHANGELOG.md` commit Atom feed instead.

Current intended source:

- `https://github.com/anthropics/claude-code/commits/main/CHANGELOG.md.atom`

This is intentional because it provides:

- official upstream data
- reliable latest-change detection
- reliable latest commit datetime
- direct links to the commit that changed the changelog

### 4. Current monitored-source count and shape

The configured monitored source count is now `11`.

Current enabled sources are:

- OpenAI API changelog on developers.openai.com
- OpenAI status history Atom feed
- OpenAI TestingCatalog ChatGPT RSS
- Anthropic Claude product updates
- Anthropic Claude Code changelog Atom feed
- OpenAI ChatGPT release notes help page
- Google Gemini updates
- Google Gemini API release notes
- Google Gemini app release notes
- Grok release notes
- xAI developer release notes

### 5. The analyzed layer now preserves publishedAt

An earlier bug allowed `publishedAt` to exist in generated data but be dropped from analyzed alert
items. That has been fixed. Future work should preserve this behavior and avoid reintroducing a
loss of datetime metadata between pipeline stages.

### 6. All-source inspection is now part of the product

The system no longer treats fetched-but-unselected content as invisible implementation detail.

Current intended behavior:

- all active sources should be reviewable in the UI when fetch succeeds
- the UI should show classification labels and reasons alongside the extracted content
- this inspection layer is a first-class tool for tuning extraction and ranking quality

### 7. Source-content translation is now available for review

Each successful source item now supports a collapsible Japanese translation view for the extracted
content itself.

This should remain separate from:

- priority judgment
- summary interpretation
- strategic meaning generation

### 8. Claude Code changelog now fetches actual changelog content

The official feed remains the trigger and datetime source, but the content shown to the user now
comes from the raw `CHANGELOG.md` file at the matching commit SHA.

This change was made because commit titles alone were not enough for meaningful product review.

## Current Operational Priorities

The next chat should treat the following as the highest-signal unresolved priorities.

### Priority 1. Improve source-specific extraction quality where dates or titles are still weak

The generic extraction path is now better than before, but some sources still need tailored logic.

Highest-value targets:

- Google Gemini updates: still often has `publishedAt: null`
- Grok release notes: may require source-specific extraction or may remain partially JS-dependent
- Google Gemini API release notes on `ai.google.dev`: currently still failing in this execution
  environment even though the route is useful conceptually
- OpenAI API changelog: latest-entry date now works, but title extraction and item-level targeting
  may still be improved
- Anthropic news: title derivation is still imperfect in some cases

### Priority 2. Revisit blocked official OpenAI help routes

The ChatGPT release notes help page is configured but still returns `403` from this environment.

Implication:

- the source should remain configured and visible in health/status
- future work can explore alternate official acquisition methods
- the system should remain truthful and never claim successful extraction where the route is still
  blocked

### Priority 3. Keep "latest update item date" as the default interpretation rule

This is now a product decision, not only a parser detail.

Future modifications should preserve:

- latest entry date beats page-level date when both are available
- feed entries should map to latest item dates
- the UI should expose uncertainty when no trustworthy date exists

### Priority 4. Tune alert selection using real usage, not only heuristics

The user has now started to interact with the working product.

Implication:

- prioritize practical tuning based on what the user actually finds useful or noisy
- especially watch whether official but operationally minor updates are being over-promoted
- preserve the original emphasis on context UX, work UX, and workflow compression

### Priority 5. Continue reducing black-box behavior

The latest review established that the system should be auditable by the user.

Implication:

- prefer visible reasoning over hidden filtering
- make it easy to compare extracted raw content, translation, and final classification
- use this transparency to decide whether future improvements should target parsing, prompting, or
  scoring

## Latest Verified State

The latest known successful refresh before this handoff produced:

- `activeSources = 11`
- `urgentCount = 2`
- `digestCount = 2`
- `analysis.mode = openai_with_cache`
- official OpenAI API changelog fetchable
- official OpenAI ChatGPT help release notes still blocked by `403`
- Claude Code changelog fetchable with reliable latest-change datetime
- Gemini app release notes on `gemini.google` fetchable with latest card title and date extraction
- xAI developer release notes fetchable with latest-block-only extraction and latest item date
- Grok release notes page fetchable, but current extraction remains weak

Latest deployment-related commits that should be understood as already pushed to `main`:

- `6c0750f` `docs: align service context with no-notification direction`
- `22b7e52` `remove notification UI and service worker`

## Current Deployment Model

The production path now exists and is active through GitHub.

### Hosting

- GitHub Pages

### Deployment workflow

- `.github/workflows/deploy-pages.yml`

### Trigger conditions

- push to `main`
- manual run from the Actions tab
- scheduled refresh and redeploy

### Current scheduled times

The current auto-refresh schedule is aligned to the user's locale in JST:

- 09:00 JST
- 12:00 JST
- 21:00 JST

Internally this is implemented with a UTC cron expression in GitHub Actions, but the product-level
assumption should be understood as "morning, noon, and night in Japan."

### Important current deployment note

During the recent notification-removal work, the context document was pushed first, but the UI
removal commit was pushed separately afterward.

Implication for future debugging:

- if the live site ever appears inconsistent with the context doc, verify that the latest UI commit
  has actually been deployed on GitHub Pages
- the specific notification-removal UI commit is `22b7e52`

## Current Cost Profile

The current system is intentionally inexpensive to operate.

Main cost characteristics:

- no always-on server
- static hosting
- scheduled jobs only
- LLM analysis happens during refresh runs

Rough token-cost understanding from current implementation:

- approximately low-thousands of tokens per refresh run
- current implementation still has room to reduce wasted analysis on unchanged items

This means the product is already usable, but cost optimization remains a valid next-step area.

## Current Known Limitations

The following are known limitations rather than mistakes:

### 1. OpenAI official release-note access is incomplete

- some desired official routes return `403`
- current workaround is official status plus secondary coverage

### 2. Some expansion targets are now covered, but breadth is still intentionally limited

- implementation now covers OpenAI, Anthropic, Google, and xAI
- broader Chinese-company coverage remains future work

### 3. Summaries depend on extraction quality

- fetch and extraction quality differs by source
- source-specific parser improvement remains a likely future task

### 4. Some official pages are fetchable but still not cost-efficient without tailored extraction

- pages like xAI release notes can expose long historical content on a single route
- these should be trimmed to the latest relevant block before translation and analysis
- this is now implemented for `docs.x.ai/developers/release-notes` and should be preserved

### 4. Notifications are intentionally out of scope for now

- the product is web-based, but no notification delivery is currently active
- the user explicitly chose to remove notification behavior because the added runtime and storage complexity was not worth it

### 5. Alerting and scoring are still calibrating

- current thresholds are directionally correct
- future tuning should come from real usage rather than premature complexity

## Current Success Definition

At this stage, the product is successful if it reliably helps the user:

- notice important updates earlier
- read them comfortably in Japanese on a phone
- distinguish official from secondary information
- act quickly on workflow-changing updates
- build a more consistent habit of AI product catch-up

## Near-Term Next-Step Themes

Likely future work, if usage reveals the need:

- better OpenAI official acquisition paths
- more source-specific extraction rules
- lower token usage by skipping unnecessary re-analysis
- expansion beyond the current set to additional major Chinese AI companies
- continued tuning of alert strictness based on actual daily use

## Important Implementation Principle

Even as the product becomes more capable, it should continue to preserve the original intent:

- prioritize interpretation over volume
- favor primary sources where possible
- make Japanese reading friction low
- optimize for mobile use
- stay low-cost and low-ops
- detect updates that change how the user should work

## Future Expansion Ideas

Items intentionally deprioritized for the first version but still relevant later:

- a specialized media product around capability expansion
- automated influence content derived from product changes
- broader monitoring of smaller AI vendors once the interpretation pipeline is reliable

## Latest Cache And Deployment Decisions

Recent debugging and production review changed how refresh behavior should be understood.

### 1. GitHub Actions cache is now part of the production design

The deployment workflow now restores and saves the following across runs:

- `data/updates.analyzed.json`
- `data/updates.generated.json`
- `data/snapshots`

This was added because relying only on the repository-committed JSON caused unnecessary full
re-analysis whenever code changed but the previously analyzed state was not aligned with the
currently deployed logic.

Current intended effect:

- unchanged source items should avoid unnecessary re-translation and re-analysis
- rerunning the same workflow should be materially cheaper than a cold run
- production deploy behavior should depend on the latest cached analyzed state, not only on what is
  committed in Git

### 2. Partial debug runs currently share the same cache lineage

This is an important current caveat.

If a manual run is executed with only a subset of sources, the saved Actions cache for that run can
become the restore point for the next normal run.

Implication:

- a partial debug run is useful for investigation
- but it can temporarily reduce cache coverage for sources not included in that run

This is acceptable for now because partial forced runs are expected to be rare, but future work may
separate debug cache and production cache if this becomes operationally noisy.

## Latest Analysis Identity Rules

The most recent rounds of debugging clarified what should count as "the same article."

### 1. Translation and analysis cache identity is article-based

Current intended rule:

- same article detection should be based on source-level raw title and published datetime

The current implementation normalizes those values for comparison, but the product-level intent is:

- do not retranslate or reanalyze just because extracted excerpt text changed slightly
- do not invalidate cache because of small body-level parsing differences when the article itself is
  the same

This decision was made specifically to reduce wasteful API cost.

### 2. "Why regenerated" visibility is now part of the system

The analyzed layer and UI now expose cache status and regeneration reasons such as:

- cache hit
- regenerated
- no previous analysis
- title changed
- publishedAt changed
- forced regeneration requested

This visibility should remain because it directly helps explain unexpected model cost.

## Latest Alert Retention Rule

The user requested that article-level alert status should persist for the same article across runs.

Current intended behavior:

- if an article was previously promoted to alert
- and the current run is still looking at the same article
- the article may retain alert status in a later run even if it is no longer newly changed

However, this should not cause infinite alert accumulation.

Current rule:

- new alert candidates are considered first
- previously alerted same-article items are used only as retained candidates
- final alert count is still capped

Implication:

- alert status has continuity across runs
- but the top alert section should not grow forever

This behavior is now an intentional product decision rather than an accidental side effect.

## Latest Model-Split Decision

The user decided that different parts of the pipeline should use different OpenAI models.

Current intended model split:

- translation: `gpt-4.1`
- summary / alert analysis / digest analysis / weekly themes: `gpt-5`

This reflects the user's view that:

- translation fidelity is already sufficient with a cheaper model
- Japanese summary quality and judgment quality are worth spending more on

Current environment-variable interpretation:

- `OPENAI_TRANSLATION_MODEL`
- `OPENAI_SUMMARY_MODEL`

The workflow defaults should preserve this split unless there is a deliberate future cost or
quality decision.

## Latest Manual Debug Workflow

The GitHub Actions manual run flow now supports targeted debugging.

Current manual inputs include:

- source IDs to refresh
- optional feed pinning
- source IDs to force regeneration
- an option to disable same-article alert retention
- an option to skip Pages deployment and only inspect the artifact

This workflow exists so the user can:

- inspect how one source changes without paying full-run cost
- compare cached and forced-regenerated outputs
- verify behavior in artifact form before deploying to GitHub Pages

### Important operational note

If the user wants to inspect output visually without updating the public site:

- run manual workflow dispatch
- set deploy-to-pages to false
- inspect the uploaded artifact

If the user wants to see the result directly on the live GitHub Pages UI:

- run manual workflow dispatch
- set deploy-to-pages to true

This distinction is now part of the intended operating model.

## Working Tree Note For Next Chat

At the point of this handoff, there are still local uncommitted changes in generated data and
snapshots.

Current known uncommitted file families:

- `data/snapshots/*`
- `data/updates.analyzed.json`
- `data/updates.generated.json`

Important interpretation:

- these are not part of the notification-removal commits already pushed to `main`
- they likely reflect local refresh output or generated-state drift
- future work should inspect them carefully rather than assuming they are intentional product-code
  changes
