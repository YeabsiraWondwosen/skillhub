import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './i18n';
import App from './App.jsx';
import { DialogProvider } from './components/ui/DialogProvider.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 min
      gcTime: 1000 * 60 * 10,          // 10 min
      retry: (failureCount, error) => {
        if (error?.response?.status === 401) return false;
        if (error?.response?.status === 403) return false;
        if (error?.response?.status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-gray-50 bg-[radial-gradient(ellipse_80%_50%_at_20%_0%,rgba(99,102,241,0.10),transparent)] dark:bg-dark-950 dark:bg-[radial-gradient(ellipse_80%_50%_at_20%_0%,rgba(99,102,241,0.12),transparent)]">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-gray-300 border-t-primary-500 dark:border-dark-700 dark:border-t-primary-500" />
              <p className="text-sm text-gray-500 dark:text-primary-300" style={{ fontFamily: 'Inter, sans-serif' }}>Loading SkillHub...</p>
            </div>
          </div>
        }>
          <DialogProvider>
            <App />
          </DialogProvider>
        </Suspense>
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 500,
            style: {
              background: 'var(--toast-bg, #1e293b)',
              color: 'var(--toast-color, #f1f5f9)',
              borderRadius: '10px',
              border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
