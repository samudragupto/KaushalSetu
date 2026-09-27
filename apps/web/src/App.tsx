import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Role } from '@kaushalsetu/shared';
import { HOME_BY_ROLE, useAuth } from './lib/auth';
import { pageVariants } from './lib/motion';
import { useRealtimeInvalidation } from './lib/realtime';
import { AppShell } from './components/layout/AppShell';
import { Skeleton } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

const GovtDashboard = lazy(() => import('./pages/GovtDashboard'));
const TraineeRegistry = lazy(() => import('./pages/TraineeRegistry'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'));
const AgentConsole = lazy(() => import('./pages/AgentConsole'));
const WhatsAppPicker = lazy(() => import('./pages/WhatsAppPicker'));
const WhatsAppSim = lazy(() => import('./pages/WhatsAppSim'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const TraineePortal = lazy(() => import('./pages/TraineePortal'));
const PublicAggregates = lazy(() => import('./pages/PublicAggregates'));

function PageFallback() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 py-6">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return <AppShell>{children}</AppShell>;
}

function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />;
}

export function App() {
  const location = useLocation();
  useRealtimeInvalidation();
  return (
    <Suspense fallback={<PageFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Page><LoginPage /></Page>} />
          <Route path="/govt" element={<Protected roles={['GOVT']}><Page><GovtDashboard /></Page></Protected>} />
          <Route path="/govt/trainees" element={<Protected roles={['GOVT']}><Page><TraineeRegistry /></Page></Protected>} />
          <Route path="/govt/privacy" element={<Protected roles={['GOVT']}><Page><PrivacyPage /></Page></Protected>} />
          <Route path="/provider" element={<Protected roles={['PROVIDER']}><Page><ProviderDashboard /></Page></Protected>} />
          <Route path="/agent" element={<Protected roles={['AGENT', 'GOVT']}><Page><AgentConsole /></Page></Protected>} />
          <Route path="/sim/whatsapp" element={<Page><WhatsAppPicker /></Page>} />
          <Route path="/sim/whatsapp/:traineeId" element={<WhatsAppSim />} />
          <Route path="/verify/:token" element={<Page><VerifyPage /></Page>} />
          <Route path="/portal" element={<Page><TraineePortal /></Page>} />
          <Route path="/public" element={<Page><PublicAggregates /></Page>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
