# KaushalSetu Demo Script (3 minutes)

Every URL below is the Vercel production URL, written here as `https://<app>.vercel.app`.

## Before the slot (T minus 5 minutes)

1. Open `https://<app>.vercel.app/login` in a desktop browser at 1366x768 or larger. If the counters on the left show dashes, the Render API is waking up; wait 40 to 60 seconds.
2. Sign in once as the Secretary, open the Simulation console (bottom right) and check the cohort tiles read about 21 scheduled. If a previous rehearsal left them in another state, that is fine: the Trigger button resets them.
3. Keep three browser tabs ready: the dashboard, a blank tab for the WhatsApp simulator and a blank tab for the employer link. On a phone, the employer link also works (`/verify/...` survives a direct open).
4. Leave Demo mode on in the sidebar. It shows the simulation console and the as-of date control.

## Script

| Time | What you do (clicks) | What the judges see | What you say |
| --- | --- | --- | --- |
| 0:00 to 0:25 | Open `/login`. Click the card "Secretary, Skill Development" (1 click). | Login split screen with live counters (3,200 trainees tracked, verification rate, 36 of 36 districts) over a Maharashtra outline. The dashboard lands with six KPIs counting up, the district map and retention curves drawing in. | "KaushalSetu follows every trainee for 24 months after the certificate. This is the Secretary's view: 3,200 trainees across all 36 districts, with placement, retention, wages and verification in one place." |
| 0:25 to 1:00 | Click Nashik on the map (1 click). Pick "CNC Machine Operator (Turning)" in the course filter (1 click). Scroll to the Skill gap report and expand the first row (1 click). | KPI deltas turn red: retention at 6 months about 18 points below the state. The retention curve drops faster than the dashed state line. AI summary: "48% of Manufacturing trainees in Nashik who are not working report a 5-axis CNC machining gap — recommend syllabus update", with Ramesh's Marathi quote and its English gloss. | "Filter to Nashik CNC and the retention problem is obvious. The reason comes from the trainees themselves: they tell our WhatsApp bot that plants have moved to 5-axis machines the ITI never taught. The summary turns that into a syllabus recommendation." |
| 1:00 to 1:45 | Open the Simulation console, click "Trigger Month-6 follow-up batch" (1 click), then "Ramesh on WhatsApp" (1 click, opens a new tab). In the phone: tap नोकरी, tap the employer button, tap "CNC Operator", type 18500 and send, tap "होय, बरोबर", tap "काही नाही". Tap the employer verification link card in the chat (opens the verification page). Click "Send OTP to HR contact", click the demo OTP chip, type a name, click Approve. Switch back to the dashboard tab. | A pixel-faithful WhatsApp chat in Marathi with typing indicators and read receipts. The confirmation creates a pending wage update and a verification link. The employer page shows masked trainee details, the claim (₹18,500, was ₹15,500), an Active GSTIN from the registry and an on-screen demo OTP. On approval, the dashboard's verification KPI ticks up within 5 seconds. | "Ramesh gets his Month-6 check-in in Marathi. He reports a raise. The claim goes to his employer as a one-time link: GSTIN checked against the registry, OTP, approve. The dashboard updates itself; nobody typed anything into a spreadsheet." |
| 1:45 to 2:20 | Clear the filters (1 click on "Clear 2"). Scroll to the Provider league table; Sai Vocational Institute, Jalgaon is on top with red chips. Click its row (1 click). In the drawer, click the first rejected record (1 click). | Sai Vocational: about 92% claimed placement but 12% verified, chips "Verify placements", "Investigate provider", "Employer concentration". The drawer explains each rule with the numbers, then the rejected record: employer said "No such employee on our rolls", GSTIN fails the registry check. | "Claimed placement is not the same as real placement. This institute claims 92% but employers confirm 12%, twenty trainees were linked to one security contractor in three weeks, and that contractor's GSTIN fails the checksum. The rules run every night." |
| 2:20 to 3:00 | Close the drawer. Drag the As-of date slider to "12 months ago" (or click the "12 months ago" chip, 1 click). Then open "Consent and audit" in the sidebar (1 click) and click "What the public sees" (1 click). | Every KPI, the map and the curves re-animate to last year's figures. The consent page shows grant rates per scope, the append-only ledger (including Rohini Bhosale's withdrawal) and the PII access log with the reveals from this demo. The public page shows anonymised district aggregates with small cells suppressed. | "Because every figure is computed from dated events, we can stand on any day in the last two years. And it is DPDP-aligned: consent is a ledger, every reveal is logged, and the public sees only this: totals with no names, and nothing below ten people." |

## Fallbacks

- If the WhatsApp tab is slow, the console's "Simulate trainee replies" answers for the rest of the cohort and the dashboard still moves.
- If the employer link card is not visible yet, the console shows an "Employer link" button once Ramesh has confirmed.
- If a judge asks about non-responders: click "Advance to next milestone" twice (reminders, then escalation), sign out, pick "Field Agent" and show the call queue with Sunil Jadhav at the top.
- If a judge asks about the trainee's side: open `/portal`, choose "Sneha · Pune", use the demo code, and show her timeline, consent toggles, Udyam certificate and bridge courses in Marathi.

## Personas

| Persona | Unified ID | Story |
| --- | --- | --- |
| Ramesh Pawar | MH-NSK-100101 | CNC operator, Government ITI Nashik, placed at Indrayani Auto Stampings, Chakan. Month-3 reply named the 5-axis CNC gap; Month-6 check-in is the live demo. |
| Sneha Patil | MH-PUN-100102 | Bridal makeup graduate running her own studio in Hadapsar; Udyam registered; income reported at ₹8,500, ₹14,000 and ₹21,000. |
| Pooja Wagh | MH-JLG-100103 | Sai Vocational Institute trainee whose claimed placement the employer rejected. |
| Sunil Jadhav | MH-CSN-100104 | Did not answer two Month-6 messages; oldest task in the agent queue. |
| Priya Deshmukh | MH-NGP-100105 | Full-stack web graduate in Nagpur, not placed; React.js and Git gap. |
| Akash More | MH-PUN-100106 | Solar PV installer with wage growth confirmed by EPFO signals. |
| Kavita Shinde | MH-JAL-100107 | Retail associate who left work after relocating to Pune. |
| Imran Shaikh | MH-MSU-100108 | Automotive technician who switched employers for a 44% raise. |
| Swati Kamble | MH-LAT-100109 | GST accounts apprentice converted to a full-time role. |
| Vijay Gaikwad | MH-GAD-100110 | Electrician running a repair shop in Aheri, Gadchiroli. |
| Rohini Bhosale | MH-THN-100111 | F&B steward who withdrew wage and public-aggregate consent in the portal. |
| Mahesh Kale | MH-KOP-100112 | Welder whose reported ₹61,000 wage trips the wage-outlier rule. |
