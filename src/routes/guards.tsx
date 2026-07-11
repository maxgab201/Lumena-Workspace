import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { ROUTES } from '../config/routes';

export const ProtectedRoute = () => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH} replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};
