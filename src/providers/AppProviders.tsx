import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { RouterProvider } from 'react-router-dom';
import { router } from '../routes';

export const AppProviders = () => {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
          <ToastProvider />
        </ThemeProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};
