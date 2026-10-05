# job-radar

Local, single-user app that matches open job listings against your own resume.

Upload a resume, review and edit the roles/skills Claude Code extracts from it, then refresh to pull job listings and score each one against your profile with a reason for the fit.

Modeled on the matching pattern from `lead-radar` (same author): a free local keyword prefilter narrows the field, then a cached Claude Code call scores what's left against a structured profile document.

## Status

v1 in progress — see `docs/superpowers/specs/2026-10-05-job-radar-design.md` for the full design and `docs/superpowers/plans/2026-10-06-job-radar-v1.md` for the implementation plan and task list.

**v1 scope:** one resume, one job source (RemoteOK), manual refresh, no auth, no application tracking. See the spec's "Non-goals" section for what's deliberately deferred.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- `node:sqlite` (`DatabaseSync`) for job/score storage — no native module to compile
- zod for schema validation
- `pdf-parse` / `mammoth` for resume text extraction
- Claude Code headless subprocess (`claude -p`) for resume extraction and job fit-scoring — uses your existing Claude.ai plan, no Anthropic API key required (and the subprocess env is stripped of any that are set, so nothing accidentally bills the metered API)

## Setup

Requires the `claude` CLI logged in (`claude` on your PATH, already authenticated) — the resume extraction and job scoring features call it directly.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, start at **Resume** to upload and save your profile, then check **Jobs** and click **Refresh**.

## Data

Everything persists locally under `data/` (gitignored): your resume file, `profile.json`, and `jobs.db`. Override the location with `JOB_RADAR_DATA_DIR`.

## Testing

```bash
npm test
```

Library logic (`lib/`) is unit-tested with mocked network/subprocess calls. UI pages are smoke-tested manually (`npm run dev`), noted per-task in the implementation plan.
