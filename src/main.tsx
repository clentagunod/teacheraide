import '@fontsource-variable/plus-jakarta-sans';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { SetupNotice } from '@/features/auth/SetupNotice';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/context/AuthContext';
import { isFirebaseConfigured, missingFirebaseEnv } from '@/lib/firebase';
import '@/styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {isFirebaseConfigured ? (
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <SetupNotice missing={missingFirebaseEnv} />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
