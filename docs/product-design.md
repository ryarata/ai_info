# Product Design: Personal AI Update Intelligence Service

## 1. Product Summary

This product continuously collects first-party updates from selected frontier AI companies,
classifies and summarizes them, scores their importance using the user's decision model, and
outputs two types of results:

- immediate alerts for updates that may change how the user should work now
- periodic reports that interpret medium-term strategic meaning
- Japanese translations of important English-language source material for easier consumption

The product is designed around "major updates to existing important services," not general AI news.
It is intended for a single personal user, not a general audience.

## 2. Product Goals

### Primary goals

- detect major updates from selected AI companies using first-party information
- summarize updates in a way that is useful for this specific user
- identify updates that affect work UX, especially context UX
- recommend when the user should act immediately versus simply understand the trend
- reduce regret caused by late adoption of important product shifts
- make first-party updates readable in Japanese without requiring the user to parse English deeply
- make daily use viable from a smartphone
- proactively notify the user through the web product

### Non-goals for v1

- covering all AI news comprehensively
- acting as a broad social media trend tracker
- becoming a public media product
- ranking every small feature update equally
- supporting multi-user collaboration or account management

## 3. Target Sources

### Company scope

- OpenAI
- Anthropic
- xAI
- Google
- selected Chinese AI companies

### Source types

- official blogs
- official release notes
- official product update pages
- official documentation pages with meaningful changes
- official model pages or pricing pages when practical usability changes
- selected official social announcements only as supplementary signals

### Source philosophy

Primary source first.

The system should prefer vendor-authored information and only use secondary sources as support when:

- a release is fragmented across multiple official pages
- a vendor publishes minimal details
- external context helps clarify practical impact

## 4. Core Product Outputs

### A. Immediate alert

Used for updates that may change current working behavior soon.

Output fields:

- company
- product or surface updated
- date detected
- source links
- short summary
- what changed
- why it matters for the user
- scores by key axes
- recommended action: now / this week / monitor
- 10-minute trial suggestion

### B. Periodic report

Weekly or daily digest that interprets larger movement.

Output fields:

- major updates during period
- strategic interpretation
- performance and infrastructure implications
- pricing or usage-limit implications
- likely product direction over next 3 to 6 months
- suggested experiments to run

### C. Translated source view

Used whenever the original source is primarily in English.

Output fields:

- original title
- Japanese translated title
- original source link
- concise Japanese translation of the key update points
- terminology notes where direct translation may be ambiguous

## 5. Product Principles

### Principle 1: Interpret, do not just summarize

A plain summary is insufficient. Each update should be translated into implications for:

- work style
- experimentation priority
- future market direction

### Principle 2: Separate immediate action from strategic understanding

Not every important update deserves an interruptive alert.

### Principle 3: Weight context UX highest

Changes to how context is stored, resumed, shared, or extended should dominate alert ranking.

### Principle 4: Preserve first-party grounding

Every meaningful output should point back to the original source pages used.

### Principle 5: Optimize for mobile-first reading

The product should assume the most frequent reading happens on a smartphone.

### Principle 6: Translation should reduce friction, not reduce trust

Japanese output should be easy to read while keeping a visible link to the original source.

### Principle 7: Prefer low-ops architecture

The product should avoid always-on infrastructure unless it becomes clearly necessary.

## 6. Functional Requirements

### Ingestion

- fetch configured source pages on a schedule
- support HTML pages, RSS/Atom where available, and static documentation pages
- store raw fetched content snapshots
- detect content changes over time

### Normalization

- extract title, date, body text, source type, company, product, and URL
- normalize content into a common internal document structure
- de-duplicate overlapping announcements across pages

### Relevance filtering

- determine whether a change is minor or major enough to analyze
- suppress trivial edits or low-signal copy changes

### Analysis

- generate structured summary
- score update across the product's decision axes
- classify as immediate alert or periodic-report item
- recommend action level
- generate a Japanese reading layer for key source material

### Delivery

- store analyzed updates
- expose alerts and reports in a readable web UI
- keep a searchable history
- send notifications for immediate alerts

## 7. Initial Scoring Model

### Main scoring axes

- Context UX change: 0 to 5
- Work UX change: 0 to 5
- Workflow compression: 0 to 5
- Medium-term performance impact: 0 to 5
- Operational viability change: 0 to 5
- Foundational/platform impact: 0 to 5

### Suggested weighted score

`total = 5*context_ux + 4*work_ux + 4*workflow + 3*performance_midterm + 2*operational_viability + 2*foundational_impact`

### Immediate-alert override

Trigger an immediate alert if any of the following is true:

- context_ux >= 4
- work_ux >= 4
- workflow >= 4

### Secondary annotations

Keep these as low-weight or metadata-only fields:

- capability expansion
- user base expansion
- standardization signal
- continued-use need

## 8. Analysis Template

For each detected update, the analyzer should produce:

- `summary_short`: one-sentence overview
- `what_changed`: concise factual description
- `user_relevance`: why this matters for the user's stated priorities
- `immediate_action`: one of `now`, `this_week`, `monitor`
- `trial_plan`: a short suggested experiment
- `strategic_meaning`: medium-term implications
- `title_ja`: Japanese-translated title
- `summary_ja`: concise Japanese summary
- `key_points_ja`: translated bullet points of the most important source facts
- `scores`: structured numeric scores by axis
- `confidence`: confidence in the interpretation

## 9. User Experience Flow

### Daily system flow

1. Fetch configured sources.
2. Compare content against prior snapshots.
3. Identify meaningful new or changed items.
4. Run structured analysis.
5. Generate Japanese translation layers for relevant updates.
6. Store results.
7. Emit immediate alerts when thresholds are met.
8. Roll non-urgent items into the next digest or report.

### User reading flow

1. Receive a web notification on mobile for urgent updates.
2. Open the mobile web dashboard or alert detail.
3. Read concise Japanese explanation of why the update matters.
4. Decide whether to try now, this week, or later.
5. Review digest or report for broader strategic understanding.

## 10. Recommended Technical Architecture

### Architecture overview

Use a pipeline with clear stages:

- source registry
- fetcher
- snapshot store
- change detector
- analyzer
- output generator
- delivery surface

### Suggested v1 stack

This can be implemented simply and expanded later.

- App shell: Next.js static-friendly web app or simple static HTML generation
- Scheduler: GitHub Actions, local scheduled task, or another low-cost scheduled runner
- Fetching: `fetch` plus HTML parsing
- Storage: JSON files or SQLite depending on deployment path
- LLM analysis: configurable model API
- UI: responsive web app with smartphone-first layout
- Notifications: browser notification support when feasible, with fallback to low-cost channels

### Why this stack fits

- fast to iterate
- works well for a personal product
- avoids the cost of maintaining an always-on backend
- smartphone access becomes straightforward through a responsive web UI
- JSON or SQLite are enough for snapshot history, analyses, and reports in early versions

## 10.5 Recommended v1 Product Decisions

To avoid over-design, the first implementation should intentionally choose the following defaults:

- deployment model: static or mostly static personal web app
- primary output: responsive personal dashboard plus generated digest pages
- run frequency: 2 to 4 times per day for source fetching
- report cadence: daily digest and weekly strategic report
- initial company scope: OpenAI, Anthropic, Google
- initial source count: 1 to 3 high-signal pages per company
- alert rule: strict immediate alerts only when work style may materially change
- default language: Japanese
- device priority: smartphone first
- notification priority: low-cost immediate alerts
- user model: single user only

Reasoning:

- smartphone-first makes the service more likely to become part of daily behavior
- static or mostly static web delivery reduces friction without forcing ongoing server costs
- dashboard plus digest gives both searchable history and low-friction reading
- limited source count makes parser tuning and scoring calibration realistic
- strict alerts reduce the risk of the system becoming noisy and ignored

## 11. Data Model Proposal

### `sources`

- `id`
- `company`
- `product`
- `source_type`
- `url`
- `active`
- `poll_interval_minutes`

### `snapshots`

- `id`
- `source_id`
- `fetched_at`
- `content_hash`
- `raw_content`
- `normalized_content`

### `changes`

- `id`
- `source_id`
- `snapshot_id`
- `change_detected_at`
- `change_type`
- `diff_summary`
- `is_meaningful`

### `analyses`

- `id`
- `change_id`
- `analyzed_at`
- `summary_short`
- `title_ja`
- `summary_ja`
- `key_points_ja`
- `what_changed`
- `user_relevance`
- `strategic_meaning`
- `immediate_action`
- `trial_plan`
- `context_ux_score`
- `work_ux_score`
- `workflow_score`
- `performance_midterm_score`
- `operational_viability_score`
- `foundational_impact_score`
- `weighted_score`
- `alert_level`
- `confidence`

### `reports`

- `id`
- `report_type`
- `period_start`
- `period_end`
- `content`
- `generated_at`

## 12. Source Registry Design

The source registry should be explicit and editable.

Each entry should include:

- company
- source label
- URL
- expected update type
- parsing strategy
- monitoring importance

Example categories:

- blog
- release notes
- docs page
- pricing page
- model page

## 13. Change Detection Strategy

Simple diffing on raw HTML will generate too much noise.

Recommended approach:

1. fetch raw page
2. extract main readable content
3. normalize whitespace and boilerplate
4. hash normalized content
5. if changed, generate semantic diff summary
6. only pass meaningful changes to the analyzer

Potential heuristics for "meaningful":

- new heading added
- release date changed with new body content
- new feature section added
- pricing table materially changed
- model list materially changed

## 14. Analysis Pipeline Design

### Step 1: factual extraction

Extract:

- release date if available
- named product or model
- concrete changes
- supporting evidence from the source

### Step 2: user-lens interpretation

Interpret through the user's priorities:

- does this affect context UX?
- does this change work UX?
- does this likely compress workflow?
- is this a medium-term performance signal?
- does this change practical usability?
- is this foundational for future products?

### Step 3: action recommendation

Recommend:

- `now`
- `this_week`
- `monitor`

### Step 4: trial suggestion

Always try to provide a lightweight experiment such as:

- "test multi-session continuity with a real project"
- "compare this workflow against your current daily research flow"

## 15. Delivery Options

### Option A: responsive web app

Pros:

- aligned with smartphone-first use
- strong for searchable history and drill-down
- compatible with browser notifications
- can be hosted cheaply if mostly static

Cons:

- browser push can still add implementation and platform constraints

### Option B: static site plus scheduled content generation

Pros:

- very low hosting cost
- simple operational model
- easy to pair with GitHub Pages, Cloudflare Pages, or similar

Cons:

- real-time interaction is limited
- true web push may be harder depending on hosting choice

### Option C: email-like digest

Pros:

- easy to consume
- easy to automate

Cons:

- weak for history and drill-down

### Option D: hybrid

Recommended for v1.5 or v2.

- responsive web app as source of truth
- alerts delivered through browser notifications or other channels later

## 16. Recommended v1 Scope

To keep v1 realistic, start with:

- 2 to 4 companies
- 1 to 3 core source pages each
- snapshot storage
- change detection
- structured analysis
- Japanese translation generation
- responsive web reading experience
- low-cost notification support for urgent items

Suggested first set:

- OpenAI
- Anthropic
- Google

Add xAI and Chinese companies after parsers and ranking feel trustworthy.

## 17. Implementation Phases

### Phase 0: context and design

- capture user intent
- define axes
- define source list
- define output schema

### Phase 1: source monitoring MVP

- source registry
- scheduled fetch
- snapshot storage
- normalized diff detection
- low-cost output persistence

### Phase 2: structured analysis MVP

- analysis prompt
- scoring
- alert classification
- digest generation

### Phase 3: delivery and review loop

- responsive dashboard or rendered web pages
- review feedback from user
- tune weights and thresholds

### Phase 4: expansion

- more companies
- more sources
- stronger personalization
- richer trial recommendations

## 18. Key Product Risks

### Risk 1: noise from source changes

Mitigation:

- normalize content before diffing
- maintain per-source parsing rules

### Risk 2: over-alerting

Mitigation:

- keep immediate alert thresholds strict
- route strategic items into periodic reports

### Risk 3: summaries drift from source facts

Mitigation:

- require factual extraction before interpretation
- store source excerpts or evidence references

### Risk 4: personalization remains too generic

Mitigation:

- encode the user's weightings directly
- allow easy future tuning

### Risk 5: low-cost hosting constrains notification behavior

Mitigation:

- start with cheap, reliable notification fallbacks
- treat browser push as optional for the first version
- prioritize "I actually see it" over technical purity

## 18.5 Recommended Low-Cost Technical Direction

For this product's current constraints, the strongest default recommendation is:

- frontend: Next.js with static export or a small static-first web app
- hosting: GitHub Pages or Cloudflare Pages
- scheduled update job: GitHub Actions
- storage: JSON artifacts committed or uploaded as build outputs
- notifications: start with low-cost channels such as email or a personal messaging webhook, then add browser push later if needed

Why this is attractive:

- almost no fixed server cost
- easy private/personal iteration
- enough for a single-user product
- good fit for content that is generated on a schedule rather than constantly queried

## 18.6 Alternative Technical Options

### Option 1: Static-first recommended path

- app: static web app
- generation: scheduled job
- data: JSON files
- cost profile: minimal

Best when:

- only one user needs access
- freshness every few hours is enough
- interactivity requirements are limited

### Option 2: Local-only generation plus hosted static viewer

- generation runs on the user's machine
- output is published as static files
- hosting remains cheap

Best when:

- the user wants even lower external dependency
- local scheduling is acceptable

### Option 3: Lightweight serverless API

- static frontend plus a few serverless endpoints
- useful for richer notification or source-control workflows
- still cheaper than a dedicated server

Best when:

- the product later needs more dynamic features
- static-only constraints become painful

## 19. Recommended Next Design Tasks

- create the initial source registry
- define the structured analyzer output schema as JSON
- write the first analysis prompt
- define the Japanese translation output rules
- decide notification mechanics for mobile web
- choose the first low-cost hosting path

## 19.5 Suggested Initial Repository Structure

One practical starting structure is:

- `docs/`
- `config/sources.json`
- `src/fetch/`
- `src/normalize/`
- `src/diff/`
- `src/analyze/`
- `src/translate/`
- `src/report/`
- `src/notify/`
- `src/db/`
- `src/web/`
- `data/`
- `public/`

Role of each area:

- `docs/`: context, design, prompts, decision logs
- `config/sources.json`: editable source registry
- `src/fetch/`: source retrieval logic
- `src/normalize/`: readable-content extraction and cleanup
- `src/diff/`: snapshot comparison and meaningful-change detection
- `src/analyze/`: LLM prompting, scoring, and action recommendation
- `src/translate/`: Japanese translation shaping and terminology handling
- `src/report/`: digest and alert rendering
- `src/notify/`: browser notification logic and delivery hooks
- `src/db/`: schema and storage access
- `src/web/`: responsive web UI
- `data/`: SQLite database, snapshots, and generated artifacts in local development
- `public/`: generated static assets when using static hosting

## 20. Suggested MVP Definition

The MVP is successful if it can:

- monitor a small set of first-party sources
- detect meaningful updates
- classify whether an item deserves immediate attention
- explain why it matters in the user's own decision framework
- generate a useful digest without requiring manual source checking
