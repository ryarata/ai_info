# Product Diagrams

## System Overview

```mermaid
flowchart LR
    A["Official Sources\nOpenAI / Anthropic / Google / xAI / China"] --> B["Source Registry\nconfig/sources.json"]
    B --> C["Fetcher\nscheduled collection"]
    C --> D["Snapshot Store\nraw + normalized content"]
    D --> E["Change Detector\nmeaningful diff only"]
    E --> F["Analyzer\nLLM + scoring"]
    F --> G["Analysis Store\nscores / summaries / actions"]
    G --> H["Immediate Alerts\nnow / this week / monitor"]
    G --> I["Periodic Reports\ndaily digest / weekly strategy"]
    G --> J["Dashboard / Searchable History"]
```

## Analysis Logic

```mermaid
flowchart TD
    A["Detected Update"] --> B["Factual Extraction"]
    B --> C["User-Lens Interpretation"]
    C --> D["Score Main Axes"]
    D --> E["Context UX"]
    D --> F["Work UX"]
    D --> G["Workflow Compression"]
    D --> H["Performance Midterm Impact"]
    D --> I["Operational Viability"]
    D --> J["Foundational Impact"]
    E --> K["Weighted Decision"]
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K
    K --> L{"Immediate Alert Override?"}
    L -->|Yes| M["Immediate Alert"]
    L -->|No| N["Digest / Weekly Report"]
```

## Daily Processing Flow

```mermaid
flowchart TD
    A["Scheduled Run\n2 to 4 times per day"] --> B["Fetch Configured Sources"]
    B --> C["Normalize Main Content"]
    C --> D["Compare With Previous Snapshot"]
    D --> E{"Meaningful Change?"}
    E -->|No| F["Store Snapshot Only"]
    E -->|Yes| G["Run Structured Analysis"]
    G --> H["Generate Summary + Scores + Trial Plan"]
    H --> I{"High-Impact UX / Workflow?"}
    I -->|Yes| J["Send Immediate Alert"]
    I -->|No| K["Queue For Digest"]
    J --> L["Store In History"]
    K --> L
```

## User Value Model

```mermaid
flowchart LR
    A["First-Party Updates"] --> B["Interpretation Layer"]
    B --> C["What changed in the product?"]
    B --> D["Does this change how I work now?"]
    B --> E["Will I regret learning this late?"]
    B --> F["What does this imply for the next 3 to 6 months?"]
    C --> G["Actionable Output"]
    D --> G
    E --> G
    F --> G
```

## Priority Weighting

```mermaid
flowchart TD
    A["Priority Model"] --> B["Context UX\nweight 5"]
    A --> C["Work UX\nweight 4"]
    A --> D["Workflow Compression\nweight 4"]
    A --> E["Performance Midterm Impact\nweight 3"]
    A --> F["Operational Viability\nweight 2"]
    A --> G["Foundational Impact\nweight 2"]
    B --> H["Highest Alert Sensitivity"]
    C --> H
    D --> H
```

## Screen Flow

```mermaid
flowchart TD
    A["Dashboard / Home"] --> B["Alert Detail"]
    A --> C["Daily Digest"]
    A --> D["Weekly Report"]
    A --> E["Update History"]
    A --> F["Sources"]
    A --> G["Settings"]

    B --> H["Open Source Links"]
    B --> I["View Trial Plan"]
    B --> J["Back to Dashboard"]

    C --> K["Digest Item Detail"]
    K --> H
    K --> I
    K --> C

    D --> L["Strategic Insight Detail"]
    L --> H
    L --> D

    E --> M["History Item Detail"]
    M --> H
    M --> I
    M --> E

    F --> N["Source Detail"]
    N --> O["Recent Changes For Source"]
    O --> M
    N --> F

    G --> P["Scoring Weights"]
    G --> Q["Notification Rules"]
    G --> R["Company / Source Management"]
    P --> G
    Q --> G
    R --> F
```

## Main User Journey

```mermaid
flowchart LR
    A["Dashboard"] --> B{"Anything urgent?"}
    B -->|Yes| C["Open Immediate Alert"]
    B -->|No| D["Read Daily Digest"]
    C --> E["Read Why It Matters"]
    E --> F["Try 10-Minute Experiment"]
    F --> G["Return to Dashboard"]
    D --> H["Open Digest Item"]
    H --> I["Understand Medium-Term Meaning"]
    I --> G
```

## Screen Roles

- `Dashboard / Home`
  - shows today's immediate alerts, latest digest, and quick links to reports
- `Alert Detail`
  - explains what changed, why it matters, scoring, source links, and suggested next action
- `Daily Digest`
  - lists non-urgent but relevant updates from the day
- `Weekly Report`
  - summarizes strategic shifts and future implications
- `Update History`
  - searchable archive of previously analyzed updates
- `Sources`
  - manages monitored companies and source pages
- `Settings`
  - controls weights, alert thresholds, and notification behavior
