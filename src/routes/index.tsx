import { createBrowserRouter } from 'react-router-dom';
import React, { Suspense } from 'react';
import { ROUTES } from '../config/routes';
import { ProtectedRoute, PublicRoute } from './guards';
import { LoadingPage } from '../components/error/LoadingPage';
import { NotFound } from '../components/error/NotFound';
import { GenericError } from '../components/error/GenericError';
import { AppLayout } from '../components/layout/AppLayout';

// Lazy loading pages
const Landing = React.lazy(() => import('../pages/Landing').then(m => ({ default: m.Landing })));
const Auth = React.lazy(() => import('../pages/Auth').then(m => ({ default: m.Auth })));
const ResetPassword = React.lazy(() => import('../pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Dashboard = React.lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Viewer = React.lazy(() => import('../pages/Viewer').then(m => ({ default: m.Viewer })));
const Settings = React.lazy(() => import('../pages/Settings').then(m => ({ default: m.Settings })));
const Billing = React.lazy(() => import('../pages/Billing').then(m => ({ default: m.Billing })));
const Legal = React.lazy(() => import('../pages/Legal').then(m => ({ default: m.Legal })));

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<LoadingPage />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    errorElement: <GenericError />,
    children: [
      // Public routes
      {
        element: <PublicRoute />,
        children: [
          { path: ROUTES.HOME, element: withSuspense(Landing) },
          { path: ROUTES.AUTH, element: withSuspense(Auth) },
          { path: '/reset-password', element: withSuspense(ResetPassword) },
        ],
      },
      // Protected routes inside AppLayout
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.DASHBOARD, element: withSuspense(Dashboard) },
              { path: ROUTES.VIEWER, element: withSuspense(Viewer) },
              { path: ROUTES.SETTINGS, element: withSuspense(Settings) },
              { path: ROUTES.BILLING, element: withSuspense(Billing) },
            ],
          },
        ],
      },
      // Unprotected specific routes
      { path: ROUTES.LEGAL, element: withSuspense(Legal) },
      // 404
      { path: ROUTES.NOT_FOUND, element: <NotFound /> },
    ],
  },
]);
