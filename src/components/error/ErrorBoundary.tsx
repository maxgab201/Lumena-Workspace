import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { GenericError } from './GenericError';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return <GenericError error={error as Error} reset={resetErrorBoundary} />;
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
