// End-to-end smoke test against a running KaushalSetu API (seeded database).
// Usage: API_URL=http://localhost:4000 WEB_ORIGIN=http://localhost:5173 node scripts/smoke.mjs
// Exercises the demo path: health, CORS, demo sign-in, dashboard, league table, simulation
// console, the WhatsApp bot flow for Ramesh Pawar, employer verification with OTP, agent queue,
// trainee portal sign-in and the public aggregates.

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

let passed = 0;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  passed++;
  console.info(`ok    ${label}`);
}

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
}

const health = await call('/health');
ok(health.status === 200 && health.data.db === 'ok', 'health endpoint reports database ok');

const preflight = await fetch(`${API}/api/analytics/dashboard`, {
  method: 'OPTIONS',
  headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
});
ok(preflight.headers.get('access-control-allow-origin') === ORIGIN, 'CORS preflight allows the web origin');
const foreign = await call('/api/public/stats', { headers: { Origin: 'https://not-allowed.example.com' } });
ok(!foreign.headers.get('access-control-allow-origin'), 'CORS does not allow an unknown origin');

const unauth = await call('/api/analytics/dashboard');
ok(unauth.status === 401, 'dashboard requires a token');

const govt = await call('/api/auth/demo', { method: 'POST', body: { role: 'GOVT' } });
ok(govt.status === 200 && govt.data.token, 'demo sign-in as Secretary');
const T = govt.data.token;

const dash = await call('/api/analytics/dashboard', { token: T });
ok(dash.data.kpis.traineesInScope === 3200, 'dashboard covers 3,200 seeded trainees');
ok(dash.data.districts.length === 36, 'district map has 36 districts');
const placement = dash.data.kpis.placementRate90.value;
ok(placement > 0.5 && placement < 0.65, `placement rate calibrated (${(placement * 100).toFixed(1)}%)`);

const nashik = await call('/api/analytics/dashboard?district=Nashik&course=CSC%2FQ0110', { token: T });
ok(nashik.data.kpis.retention6.value < dash.data.kpis.retention6.value, 'Nashik CNC retention is below the state');

const pastDate = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
const past = await call(`/api/analytics/dashboard?asOf=${pastDate}`, { token: T });
ok(past.data.kpis.traineesInScope < 3200, 'as-of date recomputes a smaller historical scope');

const summary = await call('/api/analytics/skill-gaps/summary?district=Nashik&course=CSC%2FQ0110', { token: T });
ok(/5-axis/.test(summary.data.headline), 'skill-gap summary names the 5-axis CNC gap');

const league = await call('/api/analytics/league', { token: T });
ok(league.data[0].name.startsWith('Sai Vocational') && league.data[0].flags.length >= 3, 'Sai Vocational tops the league table with integrity flags');

const sweep = await call('/api/sim/fraud-sweep', { method: 'POST', token: T });
ok(sweep.data.open >= 7, 'fraud sweep reports open alerts');

const trigger = await call('/api/sim/trigger-followups', { method: 'POST', token: T });
ok(trigger.data.sent >= 20, 'Month-6 batch sent to the Nashik CNC cohort');
const status = await call('/api/sim/status', { token: T });
const rameshId = status.data.ramesh.traineeId;
ok(!!rameshId, 'Ramesh Pawar is in the demo cohort');

for (const input of [{ buttonId: 's_job' }, { buttonId: 'e_same' }, { buttonId: 'd_0' }, { text: '18500' }, { buttonId: 'c_yes' }, { buttonId: 'k_skip' }]) {
  const r = await call(`/api/bot/${rameshId}/message`, { method: 'POST', body: input });
  ok(r.status === 200, `bot accepts ${JSON.stringify(input)}`);
}
const chat = await call(`/api/bot/${rameshId}`);
ok(chat.data.state === 'DONE', 'bot conversation completes');
const link = chat.data.messages.map((m) => m.meta.verificationUrl).filter(Boolean).pop();
ok(!!link, 'bot issued an employer verification link');
const token = link.split('/verify/')[1];

const before = (await call('/api/analytics/dashboard', { token: T })).data.kpis.verificationRate.numerator;
const claim = await call(`/api/verify/${token}`);
ok(claim.data.record.monthlyWage === 18500 && claim.data.gstin.status === 'ACTIVE', 'verification page shows the claim and an active GSTIN');
const otp = await call(`/api/verify/${token}/otp`, { method: 'POST' });
ok(/^\d{6}$/.test(otp.data.demoOtp), 'OTP issued');
const bad = await call(`/api/verify/${token}/decision`, { method: 'POST', body: { otp: '000000', decision: 'APPROVE', approverName: 'CI' } });
ok(bad.status === 400, 'wrong OTP is refused');
const good = await call(`/api/verify/${token}/decision`, { method: 'POST', body: { otp: otp.data.demoOtp, decision: 'APPROVE', approverName: 'CI HR Desk' } });
ok(good.data.status === 'VERIFIED', 'employer approval verifies the record');
const after = (await call('/api/analytics/dashboard', { token: T })).data.kpis.verificationRate.numerator;
ok(after === before + 1, 'verification KPI ticks up by one');

const invalid = await call(`/api/verify/${token}/gstin`, { method: 'POST', body: { gstin: '27ABCDE1234F1Z5' } });
ok(invalid.data.status === 'INVALID', 'GSTIN checksum validation rejects a bad number');

const agent = await call('/api/auth/demo', { method: 'POST', body: { role: 'AGENT' } });
const queue = await call('/api/agent/queue', { token: agent.data.token });
ok(queue.data.length > 0 && queue.data[0].trainee.maskedPhone.includes('xxxxxx'), 'agent queue lists masked phones');
const opened = await call(`/api/agent/tasks/${queue.data[0].id}/open`, { method: 'POST', token: agent.data.token });
ok(/^\d{10}$/.test(opened.data.trainee.phonePrimary), 'opening a task reveals the phone');
const resolved = await call(`/api/agent/tasks/${queue.data[0].id}/resolve`, { method: 'POST', token: agent.data.token, body: { outcome: 'NONE', reason: 'SKILL_MISMATCH', skillsText: 'PLC panel wiring and spoken English' } });
ok(resolved.data.ok, 'agent resolves the task with a skill-gap outcome');
const audit = await call('/api/privacy/audit', { token: T });
ok(audit.data.some((a) => a.action === 'REVEAL_PHONE_FOR_CALL'), 'phone reveal is in the audit log');

const provider = await call('/api/auth/demo', { method: 'POST', body: { role: 'PROVIDER' } });
const overview = await call('/api/provider/overview', { token: provider.data.token });
ok(overview.data.provider.name === 'Government ITI Nashik', 'provider dashboard loads for Government ITI Nashik');
const forbidden = await call('/api/analytics/dashboard', { token: provider.data.token });
ok(forbidden.status === 403, 'provider cannot open the state dashboard');

const portalOtp = await call('/api/portal/otp', { method: 'POST', body: { unifiedId: 'MH-PUN-100102' } });
const portal = await call('/api/portal/login', { method: 'POST', body: { unifiedId: 'MH-PUN-100102', otp: portalOtp.data.demoOtp } });
const me = await call('/api/portal/me', { token: portal.data.token });
ok(me.data.fullName === 'Sneha Patil' && me.data.currentStatus === 'SELF_EMPLOYED', 'trainee portal sign-in for Sneha Patil');
const consent = await call('/api/portal/consent', { method: 'PUT', token: portal.data.token, body: { scope: 'publicAggregates', granted: false } });
ok(consent.data.consents.publicAggregates === false, 'consent withdrawal is recorded');

const pub = await call('/api/public/aggregates');
ok(pub.data.districts.length === 36 && pub.data.minCellSize === 10, 'public aggregates publish 36 districts with suppression');

console.info(`\n${passed} checks passed against ${API}`);
