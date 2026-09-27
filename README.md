# KaushalSetu

[![CI/CD](https://github.com/samudragupto/KaushalSetu/actions/workflows/ci.yml/badge.svg)](https://github.com/samudragupto/KaushalSetu/actions/workflows/ci.yml)

Post-training outcomes tracking and analytics for skilling programmes of the Government of Maharashtra. Smart India Hackathon 2025, Problem ID 26135.

| | |
| --- | --- |
| Live app | https://kaushalsetu-zeta.vercel.app |
| API health | https://kaushalsetu-api-wzll.onrender.com/health |
| WhatsApp simulator | https://kaushalsetu-zeta.vercel.app/sim/whatsapp |
| Public statistics | https://kaushalsetu-zeta.vercel.app/public |
| Demo script | [DEMO_SCRIPT.md](DEMO_SCRIPT.md) |
| Design decisions | [DECISIONS.md](DECISIONS.md) |

## Overview

KaushalSetu records what happens to a trainee after a state-funded skill course ends: placement, retention, wage growth, self-employment, attrition and the skills trainees say they were missing. Consenting trainees receive WhatsApp check-ins at 3, 6, 12 and 24 months in Marathi, Hindi or English. Each reply updates the trainee's outcome history, employers confirm claimed placements through a one-time link with a GSTIN registry check and an OTP, and trainees who do not answer two check-ins move to a field agent's call queue.

The Secretary's dashboard turns these records into placement, retention and wage figures for every district, sector, course and institute, with an as-of date control that recomputes every figure for any day in the last 24 months. Four integrity rules flag institutes whose claimed placements are not backed by verification. The prototype ships with 3,200 seeded trainees across all 36 districts, 46 institutes, 28 courses in 8 sectors and 334 employers, generated from a fixed seed so every demo run produces the same data. It is not a job portal and not a learning management system.

What each role can do:

| Role | Entry | Screens |
| --- | --- | --- |
| Secretary, Skill Development | Login card or `secretary@skills.mh.example.in` | Outcomes dashboard (KPIs, district map, retention curves, reasons, league table, skill-gap report with AI summary, integrity alerts, as-of date, CSV export), trainee registry with audited reveal, consent and audit log, simulation console |
| Training provider | Login card or `principal.iti.nashik@skills.mh.example.in` | Scorecard against the state average, pending employer verifications with shareable links, trainee milestones, attrition reasons, skill gaps for its courses |
| Field agent | Login card or `agent.nashik@skills.mh.example.in` | Call queue sorted by SLA age, audited phone reveal, outcome form with the same branches as the bot, queue statistics |
| Trainee | `/portal`, Unified ID plus OTP | Timeline, consent toggles with ledger, contact update, proof upload, bridge-course recommendations; Marathi by default |
| Employer | `/verify/<token>`, no login | Masked trainee details, claim, GSTIN lookup, OTP, approve or reject with reason |
| Public | `/public`, no login | Consent-filtered district and sector aggregates, cells under 10 people suppressed |

All seeded staff accounts use the password `demo@2025`.

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        W["React app<br/>Secretary, Provider, Agent,<br/>Trainee portal, WhatsApp simulator,<br/>Employer verification"]
    end
    subgraph Vercel
        V["Static build of apps/web<br/>SPA rewrites to index.html"]
    end
    subgraph Render
        A["Express API (apps/api)<br/>JWT auth, Zod validation, CORS allowlist"]
        BOT["Bot state machine"]
        AN["Analytics engine<br/>in-memory snapshot, as-of dates"]
        FR["Integrity rules engine"]
        CRON["node-cron<br/>keep-alive, scheduler, nightly sweep"]
        subgraph Adapters
            WA["WhatsApp"]
            GST["GSTIN"]
            LLM["LLM summary"]
            EPFO["EPFO signals"]
            BH["Bhashini"]
            ST["Storage"]
        end
    end
    subgraph Supabase
        PG[("Postgres<br/>via session pooler :5432")]
        SB[("Storage bucket<br/>outcome-evidence (private)")]
        RT["Realtime broadcast"]
    end
    W --> V
    W -- "fetch + Bearer JWT (VITE_API_URL)" --> A
    A --> BOT
    A --> AN
    A --> FR
    CRON --> BOT
    CRON --> FR
    A --> PG
    BOT --> WA
    A --> GST
    AN --> LLM
    CRON --> EPFO
    BOT --> BH
    A --> ST
    ST -- "signed upload URL" --> SB
    W -- "PUT file to signed URL" --> SB
    A -. "version ping" .-> RT
    RT -. "refresh signal" .-> W
    WA -- "key present" --> MetaAPI["Meta WhatsApp Cloud API"]
    WA -- "no key" --> SIM["In-app simulator<br/>(same engine)"]
    GST -- "key present" --> GSTAPI["GST verification API"]
    GST -- "no key" --> REG["Internal registry<br/>+ checksum validation"]
    LLM -- "key present" --> GEM["Gemini or OpenAI"]
    LLM -- "no key" --> TAX["Deterministic taxonomy<br/>aggregation"]
    EPFO -- "no public API" --> EPSIM["EPFO Signal Simulator"]
    BH -- "no key" --> GLOSS["Pre-translated strings"]
    ST -- "no Supabase keys" --> INLINE["Inline base64 in Postgres"]
```

The web app never talks to Postgres directly. Every request goes through one API client module that prepends `VITE_API_URL`, and the API is the only holder of database credentials and the Supabase service role key. Each adapter reports LIVE or DEMO in the sidebar; with no keys set, the product runs entirely on its simulations.

## Key Flows

### WhatsApp follow-up lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant S as Scheduler (node-cron) or Simulation console
    participant B as Bot state machine
    participant T as Trainee (WhatsApp or simulator)
    participant DB as Postgres
    participant E as Employer (/verify/:token)
    participant D as Secretary dashboard
    S->>DB: Find FollowUp due (Month 3/6/12/24) with employment consent
    S->>B: startFollowUp(followUpId)
    B->>T: Greeting in Marathi with status buttons
    T->>B: "नोकरी" (Job)
    B->>T: Employer, designation, wage questions
    T->>B: Same employer, CNC Operator, 18500
    B->>T: Confirm details?
    T->>B: "होय, बरोबर" (Yes)
    B->>DB: OutcomeEvent (WAGE_CHANGE or PLACED), EmploymentRecord PENDING_VERIFICATION
    B->>DB: VerificationToken (14-day magic link)
    B->>T: Verification link sent to employer
    B->>DB: FollowUp RESPONDED
    E->>DB: Open link: masked trainee, claim, GSTIN registry check
    E->>DB: Request OTP, enter OTP
    alt Approve
        E->>DB: EmploymentRecord VERIFIED (method EMPLOYER_LINK)
    else Reject with reason
        E->>DB: EmploymentRecord REJECTED, counts toward integrity rules
    end
    D->>DB: Poll every 5 s (data version bumped)
    DB-->>D: Verification rate and wage KPIs recomputed
```

### Non-responder escalation

```mermaid
sequenceDiagram
    autonumber
    participant S as Scheduler
    participant B as Bot state machine
    participant T as Trainee
    participant Q as Agent call queue
    participant A as Field agent
    participant DB as Postgres
    S->>B: Check-in sent (attempt 1)
    Note over T: No reply for 48 hours
    S->>B: Reminder sent (attempt 2)
    Note over T: No reply for another 48 hours
    S->>DB: FollowUp ESCALATED
    S->>Q: AgentTask QUEUED (sorted by age, 72-hour SLA)
    A->>Q: Open task
    Q->>DB: AuditLog REVEAL_PHONE_FOR_CALL, task IN_CALL
    A->>T: Phone call on revealed number
    A->>DB: Log outcome (same branches as the bot)
    alt Not working, reason SKILL_MISMATCH
        DB->>DB: OutcomeEvent UNEMPLOYED or ATTRITION with quote
        DB->>DB: Taxonomy extraction upserts SkillGapSignal
    else Job
        DB->>DB: EmploymentRecord PENDING and employer link created
    end
    A->>DB: AgentTask RESOLVED, FollowUp RESPONDED
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web app (apps/web) | React 18, Vite 5, TypeScript (strict), Tailwind CSS 3, Framer Motion, Recharts, react-simple-maps, lucide-react, React Router 6, TanStack Query 5 (5-second polling) |
| API (apps/api) | Node 20, Express 4, TypeScript (strict), Prisma 6, Zod, jsonwebtoken, bcryptjs, node-cron, express-rate-limit, cors, tsup |
| Shared (packages/shared) | Reference data (36 districts, 8 sectors, 28 courses, skill taxonomy), DTO types, bot states and strings in mr/hi/en, GSTIN checksum, outcome folding |
| Database and files | Supabase Postgres through the session pooler; Supabase Storage private bucket |
| Localisation | en, hi, mr JSON files for trainee screens (Marathi default); bot messages generated server-side in the trainee's language |
| Fonts | Public Sans for interface text, JetBrains Mono with tabular numerals for figures, self-hosted through Fontsource |
| CI/CD | GitHub Actions (typecheck, build, migrations, seed, 38-check smoke test, production checks); Vercel and Render deploy from `main` |
| Hosting | Vercel (web), Render (API), Supabase (data) |

## Local Development

Prerequisites: Node 20 or later, npm 10, and Postgres 14 or later (Docker is the simplest route).

1. Clone and install all workspaces from the repository root. This also links `packages/shared` into both apps.

   ```bash
   git clone https://github.com/samudragupto/KaushalSetu.git
   ```

   ```bash
   npm install
   ```

2. Start Postgres with Docker, or use any local Postgres and adjust the URLs in the next step.

   ```bash
   docker compose up -d db
   ```

3. Create the environment files. The defaults point at `postgresql://postgres:postgres@localhost:5432/kaushalsetu`, the API on port 4000 and the web app on port 5173.

   ```bash
   cp .env.example .env
   ```

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

4. Apply migrations and load the seed. `db:reset` drops the schema, applies every migration and seeds; `db:seed` alone truncates and reloads all tables.

   ```bash
   npm run db:reset
   ```

5. Run the API and the web app in two terminals, then open http://localhost:5173.

   ```bash
   npm run dev:api
   ```

   ```bash
   npm run dev:web
   ```

6. With the API running, the smoke test walks the whole demo path (38 checks). Reseed afterwards if you want untouched demo data.

   ```bash
   npm run smoke
   ```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:api` | API with hot reload on port 4000 (reads `apps/api/.env`) |
| `npm run dev:web` | Vite dev server on port 5173 |
| `npm run typecheck` | Strict TypeScript checks for shared, api and web |
| `npm run build` | tsup bundle of the API (`apps/api/dist/server.js`) and Vite build of the web app (`apps/web/dist`) |
| `npm run db:migrate` | Create and apply a new migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply committed migrations (used on Render) |
| `npm run db:seed` | Truncate and reload deterministic seed data (seed `sih26135`) |
| `npm run db:reset` | Drop, migrate and seed |
| `npm run smoke` | End-to-end smoke test against `API_URL` (default `http://localhost:4000`) |

### Project structure

```
apps/
  api/                 Express API deployed to Render
    src/adapters/      WhatsApp, GSTIN, LLM, EPFO, Bhashini, Storage (LIVE or DEMO)
    src/routes/        auth, analytics, trainees, privacy, sim, bot, verify, agent, provider, portal, uploads, webhooks
    src/services/      analytics, dataset snapshot, bot engine, follow-ups, outcomes, fraud rules, trainee profile
  web/                 React app deployed to Vercel
    src/pages/         one file per screen
    src/components/    ui kit, layout, charts (map, retention, donut), dashboard widgets
    src/i18n/          en, hi, mr strings for trainee-facing screens
    src/data/          embedded Maharashtra district GeoJSON
packages/shared/       types, reference data, bot definitions, GSTIN checksum, outcome folding
prisma/                schema, migrations, deterministic seed
scripts/smoke.mjs      end-to-end smoke test
supabase/setup.sql     table lockdown and storage bucket
.github/workflows/     CI/CD pipeline
render.yaml            Render Blueprint for the API
```

## Deployment Guide

Deploy in this order: Supabase, then Render, then Vercel. Each later step needs a value from the earlier one.

### 1. Supabase (region ap-south-1, Mumbai)

1. New project. Region South Asia (Mumbai). Postgres type: default Postgres. Generate a strong password with letters and digits only (symbols would need URL encoding) and save it. Recommended security options: leave "Automatically expose new tables" off and turn "Enable automatic RLS" on. The GitHub connection on this screen is not needed.
2. Click **Connect**, choose **Connection string**, then **Session pooler** (Type: URI). The string looks like `postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`. Use it for both `DATABASE_URL` and `DIRECT_URL`. Do not use the Direct connection host `db.<ref>.supabase.co`: it is IPv6-only and Render cannot reach it. If you ever use Transaction mode (port 6543), append `?pgbouncer=true&connection_limit=1`.
3. From your machine, with the pooler string exported as both variables (for example in the root `.env`), create the schema and load the seed:

   ```bash
   npx prisma migrate deploy
   ```

   ```bash
   npm run db:seed
   ```

   Point the root `.env` back at your local database afterwards so you do not reseed production by accident.
4. Open the SQL Editor and run `supabase/setup.sql`. "Success. No rows returned" is the expected result. It enables row-level security and revokes public API access on every application table and creates the private `outcome-evidence` bucket.
5. Optional: from Project Settings, API, note the Project URL, the `anon` key (Vercel, for instant refresh) and the `service_role` key (Render only, for Storage).

Supabase Storage accepts browser uploads from any origin because every upload uses a short-lived signed URL minted by the API, so no bucket CORS entry is needed.

### 2. Render (API web service)

Either use **New, Blueprint** (reads `render.yaml`), or, if Blueprints are not available on your plan, **New, Web Service** with these settings:

| Field | Value |
| --- | --- |
| Repository, branch | `samudragupto/KaushalSetu`, `main` |
| Language, region, plan | Node, Singapore, Free |
| Root Directory | empty (the build needs `/prisma` and `/packages/shared`) |
| Build Command | `npm ci --include=dev --workspace @kaushalsetu/api --include-workspace-root && npm run build -w @kaushalsetu/api && npx prisma migrate deploy` |
| Start Command | `node apps/api/dist/server.js` |
| Health Check Path | `/health` |

Set the variables from the matrix below. Paste only the value: no quotes, no `KEY=` prefix, no spaces or line breaks. A malformed `DATABASE_URL` shows up in the build log as `Can't reach database server at localhost:5432`. Use `http://localhost:5173` for `CORS_ORIGIN` and `PUBLIC_WEB_URL` until Vercel gives you a URL. When the deploy finishes, `https://<service>.onrender.com/health` must return `"status":"ok","db":"ok"`.

### 3. Vercel (web app)

1. Add New, Project, import the repository.
2. **Root Directory: `apps/web`**. Vercel then detects the Vite preset. If it shows the Express preset and API variables, the root directory is still `apps/api`; change it. Leave build, output and install commands at their defaults, and keep "Include source files outside of the Root Directory" enabled so the build can read `packages/shared`.
3. One environment variable: `VITE_API_URL` = the Render URL with no trailing slash. Optionally `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never add database credentials or the service role key here.
4. Deploy. `apps/web/vercel.json` rewrites every path to `index.html`, so deep links such as `/verify/<token>` work when opened directly.

### 4. Connect the two

On Render set `CORS_ORIGIN` to `https://<app>.vercel.app,http://localhost:5173` and `PUBLIC_WEB_URL` to `https://<app>.vercel.app`, both without trailing slashes, and save (Render redeploys). Then open the Vercel URL and sign in as the Secretary. The browser's preflight `OPTIONS` request to the API must return 204 with `Access-Control-Allow-Origin` equal to the Vercel URL; the CI `deploy` job checks exactly this after every push.

### Environment variable matrix

| Variable | Render (API) | Vercel (web) | Local | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | Never | `apps/api/.env`, root `.env` | Supabase session pooler, port 5432 |
| `DIRECT_URL` | Required | Never | `apps/api/.env`, root `.env` | Same pooler string; used by `prisma migrate` |
| `JWT_SECRET` | Required (Generate) | Never | `apps/api/.env` | Signs Bearer tokens |
| `CORS_ORIGIN` | Required | No | `apps/api/.env` | Comma-separated allowlist of web origins |
| `PUBLIC_WEB_URL` | Recommended | No | `apps/api/.env` | Base of employer verification links |
| `DEMO_MODE` | `true` for the demo | No | `apps/api/.env` | Demo sign-in, simulation console, WhatsApp simulator, on-screen OTP |
| `CRON_ENABLED` | Optional (default `true`) | No | `apps/api/.env` | Keep-alive, follow-up scheduler, nightly sweep |
| `NODE_VERSION`, `NODE_ENV` | `20`, `production` | No | No | Render runtime |
| `SUPABASE_URL` | Optional | No | `apps/api/.env` | Storage signing and Realtime broadcast |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Never | `apps/api/.env` | Server-only key |
| `SUPABASE_STORAGE_BUCKET` | Optional (default `outcome-evidence`) | No | `apps/api/.env` | Private bucket name |
| `GEMINI_API_KEY` or `OPENAI_API_KEY` | Optional | Never | `apps/api/.env` | LLM skill-gap summary |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Optional | Never | `apps/api/.env` | Meta WhatsApp Cloud API |
| `GSTIN_API_KEY`, `GSTIN_API_URL` | Optional | Never | `apps/api/.env` | External GST verification |
| `BHASHINI_API_KEY` | Optional | Never | `apps/api/.env` | Translation of free-text replies |
| `VITE_API_URL` | No | Required | `apps/web/.env` | Render URL, no trailing slash |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | No | Optional | `apps/web/.env` | Realtime broadcast subscription (anon key only) |

### Continuous integration and delivery

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | Steps |
| --- | --- |
| `verify` | `npm ci`, `prisma validate`, strict typecheck of all three packages, production build of API and web |
| `e2e` | Postgres 16 service container, `prisma migrate deploy`, drift check (migrations must match the schema), deterministic seed, boots the bundled API exactly as Render runs it, then `scripts/smoke.mjs`: 38 checks covering CORS, auth and roles, KPIs and calibration, time travel, skill-gap summary, league table, fraud sweep, the full WhatsApp bot flow, employer OTP approval and the KPI tick, GSTIN checksum, agent queue with audited reveal, provider scoping, trainee portal and consent, public aggregates |
| `deploy` (main only) | Optionally triggers a Render deploy hook, waits for the production API to be healthy, checks production CORS for the Vercel origin and checks that deep links on Vercel return 200 |

Delivery: Vercel builds every push to `main` (production) and every pull request (preview). Render auto-deploys `main`. To make Render deploy only after CI passes, either set the service's Auto-Deploy to "After CI Checks Pass", or turn Auto-Deploy off, create a Deploy Hook in Render (Settings, Deploy Hook) and save it as the repository secret `RENDER_DEPLOY_HOOK`; the `deploy` job then triggers it after the smoke test passes. If you use Vercel preview URLs against the API, add them to `CORS_ORIGIN`.

### Keep-alive and demo-day checklist

- Render's free tier sleeps after 15 minutes idle; the first request then takes 40 to 60 seconds. Add an UptimeRobot HTTP monitor on `/health` every 10 minutes.
- An hourly node-cron query keeps the Supabase project from pausing while the API is awake.
- Five minutes before the slot, open the Vercel URL, sign in as the Secretary and open the Simulation console.
- "Trigger Month-6 follow-up batch" resets the Nashik CNC cohort each time, so rehearsals need no reseed. For a completely fresh dataset, run `npm run db:seed` with the Supabase pooler URL (about 15 seconds).

## Data Model

| Model | Holds |
| --- | --- |
| Trainee | Unified ID (`MH-<DIST>-<6 digits>`), name, date of birth, gender, social category, district, phones, preferred language, upskill opt-in |
| ConsentRecord | Append-only ledger: scope (employment tracking, wage tracking, public aggregates), granted, time, channel, source IP |
| Provider, Course, Enrollment | 46 institutes (ITI, PMKK, private, polytechnic); 28 NSQF-aligned courses with taught skills; batch dates, attendance, assessment, certification |
| Employer | Name, GSTIN, GSTIN validity, district, sector, size |
| EmploymentRecord | Claimed job with designation and monthly wage; status PENDING_VERIFICATION, VERIFIED or REJECTED; method EMPLOYER_LINK, EPFO_SIM, AGENT or DOCUMENT; evidence JSON |
| OutcomeEvent | PLACED, SELF_EMPLOYED, APPRENTICE, UNEMPLOYED, JOB_SWITCH, WAGE_CHANGE, DROPPED_OUT, ATTRITION with source, payload and attrition reason. Every metric is computed by folding these events up to the as-of date |
| FollowUp | Milestone (Month 3, 6, 12, 24), channel, status (SCHEDULED, SENT, RESPONDED, ESCALATED), attempts, responses |
| BotSession, BotMessage | State machine position, language and context; the transcript shown in the simulator |
| SkillGapSignal | Taxonomy skill by district and course, mention count and sample quotes |
| AgentTask | Escalated follow-up, assignee, status (QUEUED, IN_CALL, RESOLVED), notes, outcome |
| VerificationToken | Employer magic link, OTP and expiry |
| EvidenceFile | Uploaded proof, in Supabase Storage or inline |
| IntegrityAlert | Rule, severity, explanation, metrics, linked provider, employer or record |
| User, AuditLog, OtpChallenge | Staff accounts by role; every reveal of personal data; trainee portal sign-in codes |

Metric definitions are in [DECISIONS.md](DECISIONS.md) (item 15).

## Fraud and Integrity Rules

Run on demand from the simulation console and nightly at 02:30 IST. Alerts are upserted by a stable key and resolved automatically when the condition stops holding.

1. **Verify placements**: an institute claims more than 70% placement while fewer than 40% of its employment records are verified.
2. **Wage outlier**: a reported wage is more than twice the median wage of the course's sector.
3. **Employer concentration**: more than 15 trainees from one institute are linked to the same employer within 30 days.
4. **Investigate provider**: employers rejected at least 3 claimed placements from an institute, and rejections exceed 15% of employer responses.

The seeded Sai Vocational Institute, Jalgaon trips rules 1, 3 and 4; four seeded wage claims trip rule 2.

## Privacy and DPDP Notes

- **Consent ledger.** Consent is captured per scope at enrolment and changed by the trainee in the portal. Rows are only ever appended, with time, channel and source IP. Follow-ups are sent only with employment-tracking consent, wage figures use only trainees with wage-tracking consent, and the public page uses only trainees with public-aggregates consent.
- **PII masking by role.** The API masks before data leaves the server. Lists shown to the Secretary carry masked names, IDs and phones. Agents see a phone number only after opening the task they are calling on. Employers see the trainee's first name, masked ID and the claim itself. Providers cannot open the state dashboard.
- **Audit log.** Opening a trainee record (with a mandatory stated reason), revealing a phone for a call, viewing uploaded proof and every employer decision are written to AuditLog before the data is returned.
- **Public release.** District and sector aggregates only; any cell with fewer than 10 people is suppressed.
- **Database exposure.** `supabase/setup.sql` enables row-level security and revokes anon and authenticated access on every table, so Supabase's public anon key cannot read application data. The Realtime channel carries only a version number.
- **Rate limits.** Sign-in and portal OTP endpoints allow 60 requests per 15 minutes per IP; employer verification links allow 120.
- In production, Supabase Row-Level Security would enforce PII masking at the database layer as defense-in-depth.
- Tokens are stored in `localStorage` and sent as `Authorization: Bearer`, because the web app and API are on different domains. Production hardening would use httpOnly cookies on a shared parent domain with SameSite protection.

## Demo Guide

The three-minute script with timings, clicks, talking points, fallbacks and the twelve personas is in [DEMO_SCRIPT.md](DEMO_SCRIPT.md). In short: Secretary dashboard, Nashik plus CNC filter and the 5-axis skill gap, Ramesh Pawar's Month-6 WhatsApp check-in and employer approval, the Sai Vocational integrity flags, then the as-of date and the consent ledger.

## Production Roadmap

- **WhatsApp Cloud API.** The adapter and webhook (`/api/webhooks/whatsapp`) are in place. Production needs a verified Meta business account, approved Marathi, Hindi and English templates for the first check-in, and opt-in captured at enrolment.
- **Bhashini.** Replace the pre-translated glosses with Bhashini translation of free-text replies, and use its speech pipeline for an IVR channel for trainees without smartphones.
- **EPFO integration design.** EPFO has no public API for this purpose. The intended design is a data-sharing arrangement under which the department sends a monthly batch of consenting trainees' UANs (captured at enrolment) and receives contribution-month flags and ECR wages for matched establishments. Matches mark records VERIFIED and update wages. The EPFO Signal Simulator produces exactly these signals today.
- **Row-Level Security.** Move masking and role scoping into Postgres RLS policies keyed on JWT claims, keeping the API checks as a second layer.
- **Identity.** State SSO for officials, Aadhaar e-KYC or DigiLocker for trainees, and an SMS gateway for OTPs.
- **Scale.** Move the in-memory analytics snapshot to materialised views refreshed on write once the trainee base grows past a few hundred thousand records.

## API Reference

All routes are under `/api` except `/health`. Staff routes need `Authorization: Bearer <token>`.

| Area | Routes | Access |
| --- | --- | --- |
| Auth | `POST /auth/demo`, `POST /auth/login`, `GET /auth/me` | Public (demo only in DEMO_MODE) |
| Public | `GET /public/config`, `/public/stats`, `/public/personas`, `/public/aggregates` | Public |
| Analytics | `GET /meta/filters`, `/meta/adapters`, `/analytics/dashboard`, `/analytics/league`, `/analytics/skill-gaps`, `/analytics/skill-gaps/summary`, `/analytics/alerts`, `/analytics/providers/:id` | Secretary (skill gaps also provider) |
| Trainees | `GET /trainees`, `POST /trainees/:id/reveal` | Secretary; reveal is audited |
| Privacy | `GET /privacy/consent`, `/privacy/audit` | Secretary |
| Simulation | `GET /sim/status`, `POST /sim/trigger-followups`, `/sim/simulate-replies`, `/sim/advance-milestone`, `/sim/fraud-sweep` | Secretary, DEMO_MODE |
| Bot | `GET /bot/:traineeId`, `POST /bot/:traineeId/message`, `POST /bot/:traineeId/lang` | DEMO_MODE (simulator) |
| Verification | `GET /verify/:token`, `POST /verify/:token/gstin`, `/otp`, `/decision` | Public link, rate limited |
| Agent | `GET /agent/queue`, `/agent/stats`, `POST /agent/tasks/:id/open`, `/release`, `/resolve` | Agent (and Secretary) |
| Provider | `GET /provider/overview`, `/provider/trainees`, `/provider/verifications`, `POST /provider/verifications/:id/link` | Provider, scoped to its institute |
| Portal | `POST /portal/otp`, `/portal/login`, `GET /portal/me`, `PUT /portal/consent`, `/portal/contact`, `/portal/upskill` | Trainee |
| Uploads | `POST /uploads/sign`, `/uploads/complete`, `/uploads/inline`, `GET /uploads/:id` | Trainee; staff views are audited |
| Webhooks | `GET`, `POST /webhooks/whatsapp` | Meta WhatsApp Cloud API |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Dashboard says "Cannot reach the KaushalSetu server" | Render is waking up (wait a minute), or `CORS_ORIGIN` on Render does not contain the exact Vercel URL (no trailing slash). |
| Render build fails with `Can't reach database server at localhost:5432` | `DATABASE_URL` or `DIRECT_URL` is malformed: remove quotes, `KEY=` prefixes, brackets or whitespace from the value. |
| Render cannot reach Supabase | You used the Direct connection host `db.<ref>.supabase.co` (IPv6-only). Use the Session pooler string. |
| Vercel shows the Express preset and API variables | Root Directory is `apps/api`; set it to `apps/web`. |
| Refreshing `/verify/<token>` gives 404 on another host | The host needs SPA rewrites to `index.html`, as in `apps/web/vercel.json`. |
| Windows build fails with `EPERM ... query_engine-windows.dll.node` | A running dev API locks the Prisma engine. Stop it, then build. |
| Figures look stale after reseeding production | The API rebuilds its analytics snapshot at least once a minute; wait or restart the service. |
