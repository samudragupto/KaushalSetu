import { Link } from 'react-router-dom';
import { Logo } from '../components/layout/Logo';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo />
      <p className="num mt-8 text-5xl font-semibold text-primary">404</p>
      <h1 className="mt-2 text-lg font-semibold">This page is not part of KaushalSetu</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">The link may be old or mistyped. Employer verification links look like /verify/ followed by a long code.</p>
      <Link to="/" className="mt-6 rounded-lg border-2 border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600">
        Go to the start page
      </Link>
    </div>
  );
}
