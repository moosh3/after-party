'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center p-8"
          style={{
            background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
          }}
        >
          <div className="text-center bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-casual-dark mb-2">Something went wrong</h1>
            <p className="text-casual-dark/70 mb-6">We encountered an unexpected error. Please try refreshing.</p>
            <button
              onClick={() => window.location.reload()}
              className="twitch-button px-6 py-3"
            >
              Reload Page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}