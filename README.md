# AI Update Intel

Personal AI update intelligence app for a single user.

## Current direction

- static-first web app
- smartphone-first reading
- Japanese summaries for English primary sources
- low-cost delivery
- scheduled generation instead of always-on servers

## Project structure

- `config/sources.json`: monitored companies and primary sources
- `data/updates.sample.json`: sample analyzed updates for UI prototyping
- `scripts/generate-site.mjs`: builds the static site into `public/`
- `public/`: generated site assets
- `docs/`: product context, design, diagrams, and wireframes

## Local usage

1. Run `npm run refresh`
2. Open `public/index.html` in a browser

## Real-device preview

If you want to check the app on your phone right away:

1. Run `npm run preview`
2. Keep the terminal open
3. Open one of the printed `http://...:4173` URLs on your phone while connected to the same Wi-Fi

If you only want to serve the already generated files:

1. Run `npm run serve`
2. Open the printed URL from your phone

## Optional LLM analysis

If you set `OPENAI_API_KEY`, the pipeline will run an additional analysis step that improves
Japanese alert and digest generation.

Optional environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` default: `gpt-4.1`
- `OPENAI_TRANSLATION_MODEL` default: `gpt-4.1`
- `OPENAI_SUMMARY_MODEL` default: `gpt-5`

Example:

1. Copy `.env.example` to `.env`
2. Set `OPENAI_API_KEY`
3. Run `npm run refresh`

The scripts automatically read `.env`, so you do not need to export environment variables manually.

## Low-cost deployment path

- host the generated `public/` directory on GitHub Pages
- use GitHub Actions for automatic scheduled refresh and deploy
- keep notifications simple at first, then add richer delivery if needed

## Fastest real-device test: GitHub Pages

Recommended path:

1. Put this project in a GitHub repository
2. Set the repository default branch to `main`
3. Add repository secret `OPENAI_API_KEY`
4. Optional: add repository variables `OPENAI_TRANSLATION_MODEL` and `OPENAI_SUMMARY_MODEL`
5. Push to `main`
6. Enable GitHub Pages for GitHub Actions

After that:

- every push to `main` will build and deploy the latest static site
- a scheduled GitHub Actions run will also refresh and redeploy automatically three times per day

The deployment workflow is:

- [deploy-pages.yml](C:\Users\arata\ws\ai_info\.github\workflows\deploy-pages.yml)

The workflow fails early if `OPENAI_API_KEY` is missing.

## Auto-update behavior

The production site now updates automatically through GitHub Actions.

- trigger 1: push to `main`
- trigger 2: manual run from the Actions tab
- trigger 3: scheduled refresh three times per day

Current scheduled times:

- 09:00 JST
- 12:00 JST
- 21:00 JST

No local machine needs to stay on for scheduled updates.

## Near-term roadmap

- replace sample updates with real fetched source snapshots
- add diff detection and analysis generation
- add low-cost notification delivery
- move from sample JSON to generated daily and weekly outputs
