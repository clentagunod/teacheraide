import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageLoader } from '@/components/ui/Feedback';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { TrademarkFooter } from '@/components/layout/TrademarkFooter';

export function AppShell() {
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar />
      <div className="shell__main">
        <Topbar />
        <main id="main" className="shell__content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
        <TrademarkFooter />
      </div>
    </div>
  );
}
