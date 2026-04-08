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

### 4. The product should be web-based and capable of notifications

Implications:

- the delivery model should be web-first
- the user should not need to remember to check manually
- immediate alerts should be optimized for short, high-signal mobile delivery

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

## Notification Model

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
- lightweight browser notification behavior exists for urgent items on open

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

As of the latest successful refresh, the active monitored source count is `7`.

Current enabled sources are:

- OpenAI API changelog on developers.openai.com
- OpenAI status history Atom feed
- OpenAI TestingCatalog ChatGPT RSS
- Anthropic Claude product updates
- Anthropic Claude Code changelog Atom feed
- OpenAI ChatGPT release notes help page
- Google Gemini updates

### 5. The analyzed layer now preserves publishedAt

An earlier bug allowed `publishedAt` to exist in generated data but be dropped from analyzed alert
items. That has been fixed. Future work should preserve this behavior and avoid reintroducing a
loss of datetime metadata between pipeline stages.

## Current Operational Priorities

The next chat should treat the following as the highest-signal unresolved priorities.

### Priority 1. Improve source-specific extraction quality where dates or titles are still weak

The generic extraction path is now better than before, but some sources still need tailored logic.

Highest-value targets:

- Google Gemini updates: still often has `publishedAt: null`
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

## Latest Verified State

The latest known successful refresh before this handoff produced:

- `activeSources = 7`
- `urgentCount = 2`
- `digestCount = 2`
- `analysis.mode = openai`
- official OpenAI API changelog fetchable
- official OpenAI ChatGPT help release notes still blocked by `403`
- Claude Code changelog fetchable with reliable latest-change datetime

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

### 2. Source coverage is still intentionally narrow

- implementation currently focuses on OpenAI, Anthropic, and Google
- xAI and Chinese companies are still future expansion targets

### 3. Summaries depend on extraction quality

- fetch and extraction quality differs by source
- source-specific parser improvement remains a likely future task

### 4. Notifications are still lightweight

- the product is web-based and notification-aware
- richer push strategy may still evolve later

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
- richer notification behavior
- expansion to xAI and major Chinese AI companies
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
