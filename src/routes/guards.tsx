import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { ROUTES } from '../config/routes';
import { LoadingPage } from '../components/error/LoadingPage';

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useUserStore();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH} replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useUserStore();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};
