# job-radar — Design Spec

Date: 2026-10-05
Status: approved (v1 scope)

## Purpose

Local, single-user Next.js app that:
1. Lets a user upload their resume.
2. Parses it and extracts structured work history (roles, titles, skills, seniority) via Claude Code, pre-filling an editable profile form.
3. User edits/corrects the extracted profile and saves it.
4. App fetches open job listings from a public job source and scores each against the saved profile, surfacing the best matches with a reason.

Modeled on the existing local app `lead-radar` (same owner), which does the analogous thing for sales leads: cheap local prefilter → cached Claude Code fit-score against a structured profile document. This spec reuses that two-stage matching pattern but swaps "Studio profile vs. lead" for "Candidate profile vs. job listing."

Built incrementally — this spec covers v1 only. No CRM/pipeline stages, no outreach/drafting, no multi-source aggregation, no auth. Those are explicitly deferred, not designed here.

## Non-goals (v1)

- No multi-source job aggregation (one source only).
- No scheduled/cron refresh (manual "Refresh" button only).
- No application tracking / pipeline stages (new → applied → interview, etc.).
- No auth/multi-tenant support — single local user, like lead-radar.
- No cover-letter or application-drafting feature.

## Tech stack

- **Next.js** (App Router), React, TypeScript.
- **Tailwind CSS** + **shadcn/ui** for components (React analog of lead-radar's Nuxt UI usage).
- **better-sqlite3** for storage (sync API, no Node-version floor unlike `node:sqlite`).
- **zod** for schema validation of structured Claude Code output and form data.
- **Claude Code headless subprocess** (`claude -p ... --json-schema`) for both resume extraction and job fit-scoring — no Anthropic API key required, bills the user's existing Claude.ai plan. Mirrors lead-radar's `lib/claudeCode.ts` wrapper, including stripping `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` from the child env so nothing accidentally hits the metered API.
- Resume file parsing: `pdf-parse` for `.pdf`, `mammoth` for `.docx`.

## Data model

Persisted in `data/` (gitignored), mirroring lead-radar's `data/` layout:

- `data/profile.json` — the candidate profile: `{ roles: Role[], skills: string[], summary: string, rawResumeText: string }` where `Role = { title: string, company: string, startDate?: string, endDate?: string, description: string }`.
- `data/resume.<ext>` — the last uploaded resume file, kept for re-parsing/reference.
- `data/jobs.db` (SQLite via better-sqlite3) — two tables:
  - `jobs`: scraped listings — `id, source, source_id, title, company, url, description, posted_at, fetched_at, dedupe_key`.
  - `score_cache`: `cache_key (sha256 of model+prompt+job content), fit_score, reason, matched_skills, created_at` — keyed exactly like lead-radar's `score_cache` so identical (profile, job) pairs are never re-scored/re-billed.

No user accounts table — single-user local app.

## Module layout (`lib/`)

Framework-agnostic logic, called from Next.js route handlers — same split lead-radar uses in its `lib/`:

- `lib/resume.ts` — extract plain text from an uploaded PDF/DOCX buffer.
- `lib/extractor.ts` — Claude Code call: resume text → structured draft profile JSON, validated against a zod schema (roles[], skills[], summary). Same shape as lead-radar's `scorer.ts` but for extraction instead of scoring.
- `lib/store.ts` — read/write `data/profile.json` and the raw resume file.
- `lib/sources.ts` — `fetchJobs(): Promise<RawJob[]>` — v1 implementation calls the RemoteOK JSON API (`https://remoteok.com/api`, no key, plain `fetch`), same no-auth-fetch pattern as lead-radar's RSS/JSON source fetchers.
- `lib/prefilter.ts` — free, local, regex/keyword scoring of a job's title+description against the profile's skills/titles, with an age cutoff and basic reject rules (e.g. missing title/description). Pure function, unit-testable on fixtures — mirrors lead-radar's `prefilter.ts`.
- `lib/scorer.ts` — Claude Code call: given the full profile and a prefiltered job, return `{ fit_score: 0-100, reason: string, matched_skills: string[] }` via `--json-schema`, batched (e.g. 8 at a time) like lead-radar. Checks `score_cache` first; only cache-misses get scored, up to a per-run cap.
- `lib/pipeline.ts` — orchestration: `refresh()` = fetch → dedupe (by `source:source_id`) → insert into `jobs` → prefilter → score pending (cache-aware) → update `jobs` rows with score.
- `lib/claudeCode.ts` — subprocess wrapper around `claude -p`, ported from lead-radar's version (env-stripping, JSON-schema flag, cwd set to an empty scratch dir so no stray `CLAUDE.md` leaks into prompts).
- `lib/db.ts` — better-sqlite3 connection + schema migration (create tables if not exist) + typed row mappers for `jobs`/`score_cache`.

## API routes (`app/api/*/route.ts`)

- `POST /api/resume/upload` — accepts multipart file upload, parses via `lib/resume.ts`, extracts via `lib/extractor.ts`, returns the **draft** structured profile (not yet persisted — user edits first).
- `GET /api/profile` / `PUT /api/profile` — read/write the saved `profile.json`.
- `GET /api/jobs` — list jobs from `jobs.db`, sorted by `fit_score` desc (nulls/unscored last).
- `POST /api/jobs/refresh` — triggers `lib/pipeline.ts`'s `refresh()`, returns summary counts (fetched/new/scored).

## Pages (`app/`)

- `/resume` — file upload control → shows parsed/extracted draft in an editable form (role list: title/company/dates/description, skill tag list, summary textarea) → Save button persists via `PUT /api/profile`.
- `/jobs` — table/list of jobs sorted by fit score, each row shows title/company/score; clicking a row expands/opens the Claude-written match reason and matched skills. "Refresh" button calls `POST /api/jobs/refresh` and re-fetches the list.

## Error handling

- Resume upload: unsupported file type or empty parse result → return 400 with a clear message, no partial profile saved.
- Extraction/scoring: if the Claude Code subprocess fails or returns output that fails zod validation, surface the error to the route caller (toast in UI) and leave existing data untouched — never write partial/invalid JSON into `profile.json` or `score_cache`.
- Job fetch: RemoteOK request failure → `refresh()` reports zero fetched for that run rather than throwing, so a transient network blip doesn't break the pipeline (same resilience pattern as lead-radar's `Promise.allSettled` over sources, scaled down to one source for v1).

## Testing

- `lib/prefilter.ts` — unit tests on fixture jobs + fixture profile (pure function).
- `lib/pipeline.ts` dedupe/orchestration logic — unit tests with a fake `sources.ts`/`scorer.ts` to avoid hitting the network or Claude Code in CI.
- `lib/extractor.ts` / `lib/scorer.ts` — manual smoke test against real Claude Code (same as lead-radar's approach; no CI mocking of the LLM call itself, since it's the core value and hard to meaningfully fake).

## Open items deferred past v1

- Additional job sources beyond RemoteOK.
- Scheduled refresh (cron/script entry point, like lead-radar's `scripts/refresh.ts`).
- Application tracking/pipeline stages.
- Multi-resume / multi-profile support.
