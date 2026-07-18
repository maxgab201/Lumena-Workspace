import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { ROUTES } from '../config/routes';
import { LoadingPage } from '../components/error/LoadingPage';

export const ProtectedRoute = () => {
  const user = useUserStore((state) => state.user);
  const loading = useUserStore((state) => state.loading);
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!user) {
    return <Navigate to={ROUTES.AUTH} state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const user = useUserStore((state) => state.user);
  const loading = useUserStore((state) => state.loading);

  if (loading) {
    return <LoadingPage />;
  }

  if (user) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};
