import cron from 'node-cron';
import { env } from './env';
import { prisma } from './db';
import { createApp } from './app';
import { runFraudSweep } from './services/fraud';
import { runScheduler } from './services/followups';
import { runEpfoSignals } from './adapters/epfo';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`KaushalSetu API listening on :${env.PORT} (demo mode: ${env.DEMO_MODE ? 'on' : 'off'})`);
});

function schedule(name: string, expr: string, job: () => Promise<unknown>) {
  cron.schedule(
    expr,
    () => {
      job()
        .then((r) => console.info(`[cron] ${name}`, r ?? ''))
        .catch((err) => console.error(`[cron] ${name} failed`, err));
    },
    { timezone: 'Asia/Kolkata' },
  );
}

if (env.CRON_ENABLED) {
  // Hourly trivial query keeps the Supabase project from pausing for inactivity.
  schedule('keep-alive', '7 * * * *', () => prisma.$queryRaw`SELECT 1`.then(() => 'ok'));
  // Follow-up scheduler: due check-ins, reminders after 48 h, escalation after two misses.
  schedule('follow-up scheduler', '*/15 * * * *', () => runScheduler());
  // Nightly integrity sweep and EPFO signal pass.
  schedule('fraud sweep', '30 2 * * *', () => runFraudSweep());
  schedule('epfo signals', '0 3 * * *', () => runEpfoSignals());
}

function shutdown() {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
