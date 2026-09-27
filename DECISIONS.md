# Decisions

Decisions taken while building the prototype, with the reason for each. Where the build spec was ambiguous or internally inconsistent, the choice made is recorded here.

## Repository and build

1. **Own git repository.** The project folder sat inside a git repository rooted at the user's home directory. KaushalSetu has its own repository at the project root so its history and deploy hooks are isolated.
2. **npm workspaces.** `apps/api`, `apps/web` and `packages/shared` are workspaces with a single lockfile and hoisted `node_modules`, so `/prisma/seed.ts` and both apps resolve the same Prisma client.
3. **render.yaml without rootDir.** The spec asks for `rootDir: apps/api`, but the API build needs `/prisma` and `/packages/shared`, which sit outside that folder. The Blueprint builds from the repository root and uses `buildFilter` so only API-related changes trigger deploys. The service still serves only `/api` and `/health`.
4. **Shared package as source.** `packages/shared` ships TypeScript. Vite aliases it; the API bundles it with tsup (`noExternal`), so the Render artifact is a single `dist/server.js` plus `node_modules`.
5. **Prisma 6.** Prisma 7 changes client generation and driver adapters; version 6 is stable with the Supabase session pooler and `directUrl`.
6. **bcryptjs instead of bcrypt.** Same algorithm and hash format, no native compilation, so the Render build cannot fail on a node-gyp toolchain.
7. **Tailwind CSS 3 and react-simple-maps 3.** Both are the stable lines with typings for React 18.

## Data and seed

8. **Deterministic, date-relative seed.** All randomness comes from one generator seeded with `sih26135`. Dates are laid out relative to the day the seed runs, so the 30-month history always ends today and the Month-6 demo cohort is always due. The same run order produces the same trainees, outcomes and alerts every time.
9. **Calibration.** Seeded results: 57% placement within 90 days, retention 84%, 62% and 50% at 3, 6 and 12 months, about 63% of employment records verified, wages between ₹9,000 and ₹42,000 by sector, attrition reasons led by low wage (about 32%) and relocation (about 20%). The seed prints these figures when it finishes.
10. **District names.** Current official names are used: Chhatrapati Sambhajinagar (Aurangabad), Dharashiv (Osmanabad) and Ahilyanagar (Ahmednagar). District codes in Unified IDs are three letters (NSK, PUN, CSN and so on).
11. **Map geometry.** Boundaries come from the datameet-derived Census 2011 district GeoJSON published in the udit-001/india-maps-data repository, filtered to Maharashtra, simplified to three decimals and embedded in the bundle (130 KB, no runtime fetch). That source has 35 districts with Mumbai as one polygon; it is split into Mumbai City and Mumbai Suburban at latitude 19.045 N. The split is approximate and visual only; data are keyed by district name.
12. **Ramesh Pawar's storyline.** The spec asks for a Month-6 wage update in the live demo and also an attrition at Month 9 in his seeded history, which cannot both be true on the same timeline. Ramesh's batch ended 178 days before the seed date. His seeded Month-3 WhatsApp reply (in Marathi) names the 5-axis CNC gap while he is still employed, and the live demo is his Month-6 check-in. The attrition-with-5-axis story is carried by the earlier Nashik CNC cohorts, whose attrition is seeded higher and mostly for skill mismatch; their quotes and Ramesh's aggregate into the Nashik CNC 5-axis signal, with Ramesh's quote shown first.
13. **Sai Vocational cluster.** 70 trainees with 90% trainer-reported placement, about 12% verified, 20 linked to Shree Samarth Industrial Services (invalid GSTIN) within 21 days, and 6 employer rejections. Four employers have invalid GSTINs: two fail the checksum and two are registry-cancelled.
14. **Employers named in free text.** When a trainee types an employer the registry does not know, the API creates an employer with a placeholder GSTIN (`UNREG-...`). The verification page then asks the employer to enter their GSTIN and checks it; an active, well-formed GSTIN replaces the placeholder on approval.

## Metrics

15. **Definitions.** Placement rate (90 days): trainees whose batch ended at least 90 days before the as-of date and who had a job, apprenticeship or self-employment within 90 days of batch end. Retention at 6 months: of trainees first placed at least 6 months before the as-of date, the share working 6 months after placement (a job switch counts as retained). Median wage: current wage of employed trainees with wage consent. Wage growth at 12 months: median change from starting wage to wage 12 months after placement. Verification rate: verified employment records over all records created by the as-of date.
16. **Everything is folded from events.** Status at any date is computed by folding OutcomeEvents up to that date (`packages/shared/src/outcomes.ts`). This is what makes the as-of control exact rather than approximate, and the seed, bot and dashboard share the same function.
17. **In-memory analytics.** The API loads a snapshot of trainees, events, records and follow-ups (a few MB) and computes metrics in memory, cached by a data version that every write path bumps, and rebuilt at least once a minute. With 5-second polling from several screens this is cheaper than repeated SQL aggregation, and it keeps every filter combinable. The roadmap moves this to materialised views at larger scale.
18. **Skill-gap share.** Mentions of a skill in a district and course are divided by the number of trainees from that district and course who are not in work at the as-of date (the denominator is never smaller than the mention count). Signals are also materialised in SkillGapSignal for the AI summary.
19. **Deterministic AI fallback.** Without an LLM key, the summary is built from the ranked signals and the bridge-course catalogue, in exactly the shape the LLM path returns. LLM results are cached for 10 minutes so polling does not call the model every 5 seconds.

## Workflow

20. **Reminder then escalation.** "Two non-responses" is implemented as: check-in sent, reminder after 48 hours without a reply, escalation to the agent queue after a second 48-hour window. The console's "Advance to next milestone" performs one step per click for the demo cohort and runs the EPFO simulator.
21. **Wage update on the same employer.** Reporting a new wage for the current employer updates the open employment record, logs a WAGE_CHANGE event and sets the record back to pending, so the employer confirms the new wage. This is why Ramesh's approval moves the verification rate.
22. **Replies close agent tasks.** If an escalated trainee answers on WhatsApp before the call, the open agent task is resolved automatically with a note.
23. **Pending verification list.** The provider's list shows claims from the last 180 days; older unconfirmed claims are left to EPFO matching and agent calls.
24. **Month-6 trigger is a reset.** Triggering the Nashik CNC batch resets those follow-ups and starts new sessions, so the demo can be rehearsed any number of times without reseeding.

## Interface

25. **WhatsApp simulator perspective.** The simulator is the trainee's phone, so the chat header shows the bot (KaushalSetu, verified account) as the contact and the trainee's name labels the device and the side panel. WhatsApp's own colours are used only inside the phone frame so it reads as the real channel; the rest of the product keeps the specified palette.
26. **Palette use in charts.** Sector retention curves highlight one sector in teal against grey peers and a navy dashed "all sectors" line, instead of eight hues. Reason breakdowns use teal at decreasing strength. The map uses a single teal ramp, with saffron only for the selected district outline and activity markers.
27. **Localisation.** Trainee-facing screens (portal and simulator chrome) use en, hi and mr JSON files, Marathi by default; bot messages are generated server-side in the trainee's language. Staff screens are in English. Timeline titles in the portal are localised on the client.
28. **Simulation console starts minimised** and remembers its state, so it does not cover the dashboard at 1366x768.

## Security and privacy

29. **Supabase lockdown instead of table publication.** The spec suggests adding EmploymentRecord and FollowUp to the `supabase_realtime` publication and subscribing with the anon key. Prisma creates tables without RLS, and Supabase grants the anon role access to the `public` schema, so that setup would let anyone holding the public anon key read trainee data over PostgREST or Realtime. `supabase/setup.sql` enables RLS and revokes anon and authenticated access on every table. Instant refresh uses a Realtime Broadcast from the API that carries only the data version.
30. **Demo-only public endpoints.** The WhatsApp simulator endpoints and the persona list are open without login because the simulator stands in for a trainee's phone. They are enabled only when `DEMO_MODE=true`; with it off, inbound messages arrive only through the WhatsApp webhook.
31. **On-screen OTPs.** No SMS gateway is configured, so in demo mode the employer and trainee OTPs are returned by the API and displayed with a DEMO label. The code, expiry and one-time use are still enforced server-side.
32. **Bearer tokens in localStorage.** As specified, because the API and web app are on different sites; httpOnly cookies on a shared parent domain are listed as production hardening.
33. **GSTIN checks.** The internal registry validates the real GSTIN structure and mod-36 checksum, then looks the number up among registered employers.
