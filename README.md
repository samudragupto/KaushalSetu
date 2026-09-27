# KaushalSetu

Post-training outcomes tracking and analytics for skilling programmes of the Government of Maharashtra. Smart India Hackathon 2025, Problem ID 26135.

## Overview

KaushalSetu records what happens to a trainee after a state-funded skill course ends: placement, retention, wage growth, self-employment, attrition and the skills trainees say they were missing. Consenting trainees receive WhatsApp check-ins at 3, 6, 12 and 24 months in Marathi, Hindi or English. Each reply updates the trainee's outcome history, employers confirm claimed placements through a one-time link with a GSTIN registry check and an OTP, and trainees who do not answer two check-ins move to a field agent's call queue.

The Secretary's dashboard turns these records into placement, retention and wage figures for every district, sector, course and institute, with an as-of date control that recomputes every figure for any day in the last 24 months. Four integrity rules flag institutes whose claimed placements are not backed by verification. The prototype ships with 3,200 seeded trainees across all 36 districts, 46 institutes, 28 courses in 8 sectors and 334 employers, generated from a fixed seed so every demo run produces the same data. It is not a job portal and not a learning management system.

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

Every adapter reports LIVE or DEMO in the sidebar. No adapter key is required; with none set, the whole product runs on its simulations.

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
| Web app (apps/web) | React 18, Vite 5, TypeScript (strict), Tailwind CSS 3, Framer Motion, Recharts, react-simple-maps, lucide-react, React Router 6, TanStack Query 5 |
| API (apps/api) | Node 20, Express 4, TypeScript (strict), Prisma 6, Zod, jsonwebtoken, bcryptjs, node-cron, express-rate-limit, cors |
| Shared (packages/shared) | Reference data (36 districts, 8 sectors, 28 courses, skill taxonomy), DTO types, bot state definitions and strings, GSTIN checksum, outcome folding |
| Database and files | Supabase Postgres (session pooler) and Supabase Storage (private bucket) |
| Fonts | Public Sans for interface text, JetBrains Mono with tabular numerals for all figures (self-hosted via Fontsource) |
| Hosting | Vercel (web), Render (API), Supabase (data) |

## Local Development

Prerequisites: Node 20 or later, npm 10, and a Postgres 14+ database (Docker is the simplest route).

1. Install all workspaces from the repository root. This also links `packages/shared` into both apps.

   ```bash
   npm install
   ```

2. Start Postgres. With Docker:

   ```bash
   docker compose up -d db
   ```

3. Create the environment files.

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

   The defaults point at `postgresql://postgres:postgres@localhost:5432/kaushalsetu`, the API at port 4000 and the web app at port 5173. Adjust `DATABASE_URL` and `DIRECT_URL` in both `.env` and `apps/api/.env` if your database differs.

4. Apply migrations and load the seed (3,200 trainees; finishes in under 10 seconds locally).

   ```bash
   npm run db:reset
   ```

   `db:reset` drops and recreates the schema, applies every migration and runs `prisma/seed.ts`. To reseed without touching migrations, run `npm run db:seed`; it truncates and reloads all tables.

5. Run the API and the web app in two terminals.

   ```bash
   npm run dev:api
   ```

   ```bash
   npm run dev:web
   ```

6. Open http://localhost:5173 and pick a role card. Seeded accounts can also sign in with email and password `demo@2025`:

   | Role | Email |
   | --- | --- |
   | Secretary, Skill Development | secretary@skills.mh.example.in |
   | Training provider (Government ITI Nashik) | principal.iti.nashik@skills.mh.example.in |
   | Field agent (Nashik Division) | agent.nashik@skills.mh.example.in |

Type checks for all three packages: `npm run typecheck`. Production builds: `npm run build`.

The shared package ships TypeScript source. Vite resolves it through an alias in `apps/web/vite.config.ts`; the API bundles it with tsup (`noExternal`), so `apps/api/dist/server.js` has no runtime dependency on the workspace link.

## Deployment Guide

Deploy in this order: Supabase, then Render, then Vercel. Each later step needs a value from the earlier one.

### 1. Supabase (region ap-south-1, Mumbai)

1. Create a project in ap-south-1. Save the database password.
2. Project Settings, Database, Connection string: choose the connection **pooler** in **Session** mode. It looks like `postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`. Use this string for both `DATABASE_URL` and `DIRECT_URL`. Do not use the direct host `db.<ref>.supabase.co`; it resolves to IPv6 only and Render cannot reach it. If you ever use Transaction mode (port 6543) instead, append `?pgbouncer=true&connection_limit=1`.
3. From your machine, with those two variables exported (or placed in the root `.env`), create the schema and load the seed:

   ```bash
   npx prisma migrate deploy
   ```

   ```bash
   npm run db:seed
   ```

4. Open the SQL editor and run `supabase/setup.sql`. It enables row-level security and revokes public API access on every application table, creates the private `outcome-evidence` bucket, and documents the Realtime broadcast channel. This step matters: Supabase exposes the `public` schema to the anon key by default.
5. Note the Project URL, the `anon` key (for Vercel, optional) and the `service_role` key (for Render only).

Supabase Storage accepts browser uploads from any origin because every upload uses a short-lived signed URL minted by the API; no bucket-level CORS entry is needed for the Vercel domain or localhost.

### 2. Render (API web service)

1. New, Blueprint, select this repository. Render reads `render.yaml`, which defines one web service and no database.
2. Fill the variables marked `sync: false` (see the matrix below). Set `CORS_ORIGIN` and `PUBLIC_WEB_URL` to a placeholder such as `http://localhost:5173` for now; you will update them after Vercel gives you a URL.
3. Deploy. The build runs `npm ci`, bundles the API with tsup and runs `prisma migrate deploy`. The service starts with `node apps/api/dist/server.js`.
4. Check `https://<service>.onrender.com/health` returns `{"status":"ok","db":"ok",...}`.

`render.yaml` does not set `rootDir`, because the API build needs `/prisma` and `/packages/shared` from the repository root; `buildFilter` restricts automatic deploys to those paths plus `apps/api`.

### 3. Vercel (web app)

1. New Project, import the repository, set Root Directory to `apps/web`. Framework preset Vite, build command `npm run build`, output directory `dist`. Keep "Include source files outside of the Root Directory" enabled (the default) so the build can read `packages/shared`.
2. Environment variables: `VITE_API_URL` = the Render URL with no trailing slash. Optionally `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for instant refresh.
3. Deploy. `apps/web/vercel.json` rewrites every path to `index.html`, so deep links such as `/verify/<token>` and `/sim/whatsapp/<id>` work when opened directly from a phone.
4. Back on Render, set `CORS_ORIGIN` to the Vercel production URL (add preview URLs and `http://localhost:5173` separated by commas if you use them) and `PUBLIC_WEB_URL` to the production URL. Redeploy the API.
5. Verify cross-origin access from the production URL, not just locally: open the Vercel URL, sign in as the Secretary, and confirm the dashboard loads. In the browser's network panel the preflight `OPTIONS` request to the Render API must return 204 with `Access-Control-Allow-Origin` equal to your Vercel URL. If the dashboard shows "Cannot reach the KaushalSetu server", the most common cause is a trailing slash or a missing preview URL in `CORS_ORIGIN`.

### Environment variable matrix

| Variable | Render (API) | Vercel (web) | Local | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | No | `apps/api/.env` and root `.env` | Supabase session pooler, port 5432 |
| `DIRECT_URL` | Required | No | `apps/api/.env` and root `.env` | Same pooler string; used by `prisma migrate` |
| `JWT_SECRET` | Required (generated) | No | `apps/api/.env` | Signs Bearer tokens |
| `CORS_ORIGIN` | Required | No | `apps/api/.env` | Comma-separated allowlist of web origins |
| `PUBLIC_WEB_URL` | Recommended | No | `apps/api/.env` | Base of employer verification links |
| `DEMO_MODE` | `true` for the demo | No | `apps/api/.env` | Demo sign-in, simulation console, WhatsApp simulator, on-screen OTP |
| `CRON_ENABLED` | Optional (default true) | No | `apps/api/.env` | Keep-alive, follow-up scheduler, nightly sweep |
| `SUPABASE_URL` | Optional | No | `apps/api/.env` | Storage signing and Realtime broadcast |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Never | `apps/api/.env` | Server-only key; never put it in the web app |
| `SUPABASE_STORAGE_BUCKET` | Optional (default `outcome-evidence`) | No | `apps/api/.env` | Private bucket name |
| `GEMINI_API_KEY` or `OPENAI_API_KEY` | Optional | No | `apps/api/.env` | LLM skill-gap summary |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Optional | No | `apps/api/.env` | Meta WhatsApp Cloud API |
| `GSTIN_API_KEY`, `GSTIN_API_URL` | Optional | No | `apps/api/.env` | External GST verification |
| `BHASHINI_API_KEY` | Optional | No | `apps/api/.env` | Translation of free-text replies |
| `NODE_VERSION` | `20` (in render.yaml) | No | No | Render runtime |
| `VITE_API_URL` | No | Required | `apps/web/.env` | Render URL, no trailing slash |
| `VITE_SUPABASE_URL` | No | Optional | `apps/web/.env` | Realtime broadcast subscription |
| `VITE_SUPABASE_ANON_KEY` | No | Optional | `apps/web/.env` | Public anon key only |

### Keep-alive and demo-day checklist

- Render's free tier sleeps after 15 minutes without traffic, and the first request then takes 40 to 60 seconds. Add an UptimeRobot HTTP monitor on `https://<service>.onrender.com/health` every 10 minutes.
- The API runs a trivial database query every hour (node-cron), so the Supabase project does not pause for inactivity while the API is awake.
- Vercel static hosting does not sleep. Open the Vercel URL anyway five minutes before the demo slot, sign in once as the Secretary and open the simulation console; this warms the API and the analytics cache.
- Rehearsing is safe: "Trigger Month-6 follow-up batch" resets the Nashik CNC cohort's Month-6 check-ins each time. For a completely fresh dataset run `npm run db:seed` against the Supabase URL (about 30 seconds over the network).

## Data Model

| Model | Holds |
| --- | --- |
| Trainee | Unified ID (`MH-<DIST>-<6 digits>`), name, date of birth, gender, social category, district, phones, preferred language |
| ConsentRecord | Append-only ledger: scope (employment tracking, wage tracking, public aggregates), granted, time, channel, source IP |
| Provider, Course, Enrollment | 46 institutes (ITI, PMKK, private, polytechnic); 28 NSQF-aligned courses with taught skills; batch dates, attendance, assessment, certification |
| Employer | Name, GSTIN, GSTIN validity, district, sector, size |
| EmploymentRecord | Claimed job with designation and monthly wage; status PENDING_VERIFICATION, VERIFIED or REJECTED; method EMPLOYER_LINK, EPFO_SIM, AGENT or DOCUMENT; evidence JSON |
| OutcomeEvent | PLACED, SELF_EMPLOYED, APPRENTICE, UNEMPLOYED, JOB_SWITCH, WAGE_CHANGE, DROPPED_OUT, ATTRITION with source, payload and attrition reason. Every metric is computed by folding these events up to the as-of date |
| FollowUp | Milestone (Month 3, 6, 12, 24), channel, status (SCHEDULED, SENT, RESPONDED, ESCALATED), attempts, responses |
| BotSession, BotMessage | State machine position, language and context; the message transcript shown in the simulator |
| SkillGapSignal | Taxonomy skill by district and course, mention count and sample quotes |
| AgentTask | Escalated follow-up, assignee, status (QUEUED, IN_CALL, RESOLVED), notes, outcome |
| VerificationToken | Employer magic link, OTP and expiry |
| EvidenceFile | Uploaded proof, stored in Supabase Storage or inline |
| IntegrityAlert | Rule, severity, explanation, metrics, linked provider, employer or record |
| User, AuditLog, OtpChallenge | Staff accounts by role; every reveal of personal data; trainee portal sign-in codes |

## Fraud and Integrity Rules

Run on demand from the simulation console and nightly at 02:30 IST. Alerts are upserted by a stable key and resolved automatically when the condition stops holding.

1. **Verify placements**: an institute claims more than 70% placement while fewer than 40% of its employment records are verified.
2. **Wage outlier**: a reported wage is more than twice the median wage of the course's sector.
3. **Employer concentration**: more than 15 trainees from one institute are linked to the same employer within 30 days.
4. **Investigate provider**: employers rejected at least 3 claimed placements from an institute, and rejections exceed 15% of employer responses.

The seeded Sai Vocational Institute, Jalgaon trips rules 1, 3 and 4; four seeded wage claims trip rule 2.

## Privacy and DPDP Notes

- **Consent ledger.** Consent is captured per scope at enrolment and changed by the trainee in the portal. Rows are only ever appended, with time, channel and source IP. Follow-ups are sent only with employment-tracking consent, wage figures use only trainees with wage-tracking consent, and the public statistics page uses only trainees with public-aggregates consent.
- **PII masking by role.** The API masks before data leaves the server. Lists shown to the Secretary carry masked names, IDs and phones. Agents see a phone number only after opening the task they are calling on. Employers see the trainee's first name, masked ID and the claim itself.
- **Audit log.** Opening a trainee record (with a mandatory stated reason), revealing a phone for a call, viewing uploaded proof and every employer decision are written to AuditLog before the data is returned. The Consent and audit page lists them.
- **Public release.** The public page publishes district and sector aggregates only, and suppresses any cell with fewer than 10 people.
- **Database exposure.** `supabase/setup.sql` enables row-level security and revokes anon and authenticated access on every table, so the public anon key cannot read application data. The Realtime channel carries only a version number.
- In production, Supabase Row-Level Security would enforce PII masking at the database layer as defense-in-depth.
- Tokens are stored in `localStorage` and sent as `Authorization: Bearer`, because the web app and API are on different domains. Production hardening would move to httpOnly cookies on a shared parent domain (for example `app.` and `api.` under one government domain) with SameSite protection.

## Demo Guide

The three-minute script with timings, clicks and fallbacks is in [DEMO_SCRIPT.md](DEMO_SCRIPT.md). Design and scope decisions are recorded in [DECISIONS.md](DECISIONS.md).

## Production Roadmap

- **WhatsApp Cloud API.** The adapter and webhook (`/api/webhooks/whatsapp`) are in place. Production needs a verified Meta business account, approved Marathi, Hindi and English message templates for the first check-in (session messages for replies), and opt-in captured at enrolment.
- **Bhashini.** Replace the pre-translated glosses with Bhashini translation of free-text replies, and use its speech pipeline for an IVR channel for trainees without smartphones.
- **EPFO integration design.** EPFO has no public API for this purpose. The intended design is a data-sharing arrangement under which the department sends a monthly batch of consenting trainees' UANs (captured at enrolment) and receives contribution-month flags and ECR wages for matched establishments. Matches mark records VERIFIED with method EPFO and update wages. The EPFO Signal Simulator produces exactly these signals today.
- **Row-Level Security.** Move masking and role scoping into Postgres RLS policies keyed on JWT claims, keeping the API checks as a second layer.
- **Identity.** Replace demo sign-in with the state's SSO for officials and Aadhaar-based e-KYC or DigiLocker for trainees, and add an SMS gateway for OTPs.
- **Scale.** Move the in-memory analytics snapshot to materialised views refreshed on write once the trainee base grows past a few hundred thousand records.
