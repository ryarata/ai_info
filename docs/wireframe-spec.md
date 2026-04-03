# Wireframe Spec

## Purpose

This document defines a low-fidelity wireframe specification for the Personal AI Update
Intelligence Service. It is intended to be used as the direct source for creating Figma frames.

The design goal is clarity first:

- urgent items should be visible immediately
- the user should understand why something matters at a glance
- the product should cleanly separate immediate action from strategic reading

## Screen List

- Dashboard / Home
- Alert Detail
- Daily Digest
- Weekly Report
- Update History
- Sources
- Settings

## 1. Dashboard / Home

### Goal

Show the current state of the system in one view, with immediate alerts first and digest/report
entry points below.

### Layout

- top header
- left sidebar navigation
- main content area
- optional right rail for quick context

### Header

- product name
- current date
- latest sync status
- manual refresh button

### Sidebar

- Dashboard
- Alerts
- Daily Digest
- Weekly Report
- History
- Sources
- Settings

### Main content blocks

#### Block A: Immediate Alerts

- section title: `Immediate Alerts`
- count badge
- list of alert cards

Each alert card contains:

- company name
- product/surface name
- one-line summary
- `Why now` label
- score chips
- action chip: `Now` / `This week`
- button: `Open`

#### Block B: Daily Digest Preview

- section title: `Today’s Digest`
- 3 to 5 digest items
- button: `Open Daily Digest`

Each digest item contains:

- company
- update headline
- short implication line
- action recommendation

#### Block C: Weekly Strategic View

- section title: `This Week’s Strategic Shifts`
- 2 to 3 high-level bullets
- button: `Open Weekly Report`

#### Block D: Monitoring Overview

- monitored companies count
- active sources count
- updates detected today
- last run timestamp

### Wireframe notes

- immediate alerts should visually dominate the top half
- digest and weekly report should feel calmer and more secondary
- the page should answer "Do I need to act right now?" within 3 seconds

## 2. Alert Detail

### Goal

Explain why a specific update deserves immediate attention and what the user should do next.

### Layout

- breadcrumb
- main article column
- right sidebar

### Main column sections

- title with company and product
- update date and source links
- short summary
- `What changed`
- `Why this matters for you`
- `Recommended action`
- `10-minute trial`
- `Strategic meaning`

### Right sidebar sections

- score breakdown
  - Context UX
  - Work UX
  - Workflow Compression
  - Performance Midterm Impact
  - Operational Viability
  - Foundational Impact
- alert level badge
- confidence indicator
- quick actions
  - mark reviewed
  - save for later
  - open source

### Wireframe notes

- scoring should feel transparent, not overly technical
- the trial plan should be prominent and low-friction

## 3. Daily Digest

### Goal

Provide a clean list of relevant but non-urgent updates for the current day.

### Layout

- page title
- date selector
- filter row
- digest list

### Filters

- company
- impact type
- action recommendation

### Digest item card

- company
- product
- headline
- short summary
- one-line strategic meaning
- action chip: `Monitor` / `This week`
- button: `View detail`

### Wireframe notes

- list should be dense but readable
- allow quick scanning across multiple updates

## 4. Weekly Report

### Goal

Summarize the strategic direction of major updates over the past week.

### Layout

- report header
- summary hero block
- strategic themes
- update clusters
- suggested experiments

### Main sections

#### Summary hero

- report period
- 3 key takeaways

#### Strategic themes

- theme card 1
- theme card 2
- theme card 3

Each theme card contains:

- theme title
- explanation
- companies involved
- expected 3 to 6 month implication

#### Update clusters

- grouped by company or theme

#### Suggested experiments

- 2 to 5 experiments to try this week

### Wireframe notes

- this screen should feel more analytical than operational
- visually distinct from daily digest

## 5. Update History

### Goal

Let the user review past updates and analyses over time.

### Layout

- title row
- search bar
- filters
- table or card list

### Columns or fields

- detected date
- company
- product
- summary
- alert level
- action recommendation
- detail link

### Wireframe notes

- prioritize retrieval and comparison over visual richness

## 6. Sources

### Goal

Show what the system monitors and whether each source is healthy.

### Layout

- source list
- source detail panel

### Source list fields

- company
- source label
- source type
- status
- poll frequency
- last fetched

### Source detail

- source URL
- parsing strategy
- recent changes
- recent fetch results

### Wireframe notes

- useful mainly for trust and maintenance
- should feel operational, not editorial

## 7. Settings

### Goal

Allow tuning of personalization and alert behavior.

### Layout

- section tabs or stacked cards

### Sections

#### Scoring weights

- Context UX
- Work UX
- Workflow Compression
- Performance Midterm Impact
- Operational Viability
- Foundational Impact

#### Alert rules

- immediate alert threshold
- digest inclusion threshold
- report cadence

#### Monitoring scope

- company toggles
- source enable/disable

### Wireframe notes

- should support adjustment without overwhelming the user
- make current defaults visible

## Global Components

### Navigation

- consistent left sidebar
- active page highlight

### Status chips

- `Now`
- `This week`
- `Monitor`
- `High`
- `Medium`
- `Low`

### Score chips

- compact pill style
- visible on cards and detail sidebars

## Mobile Notes

For mobile:

- collapse sidebar into menu
- stack cards vertically
- keep immediate alert cards first
- move score detail into expandable accordion

## Figma Frame Recommendations

Suggested desktop frames:

- `Dashboard` at 1440 x 1024
- `Alert Detail` at 1440 x 1200
- `Daily Digest` at 1440 x 1200
- `Weekly Report` at 1440 x 1400
- `Update History` at 1440 x 1024
- `Sources` at 1440 x 1024
- `Settings` at 1440 x 1100

Suggested mobile frames:

- `Dashboard Mobile` at 390 x 844
- `Alert Detail Mobile` at 390 x 1000

## Suggested Visual Style For Low-Fidelity Wireframes

- grayscale only
- simple rectangular cards
- minimal iconography
- no brand colors yet
- use spacing and hierarchy to show priority

