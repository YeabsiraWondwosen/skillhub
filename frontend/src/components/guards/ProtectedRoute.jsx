import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function ProtectedRoute() {
  const { user, accessToken, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) return <LoadingScreen />;
  if (!user || !accessToken) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  if (user.isEmailVerified === false) {
    return <Navigate to="/auth/verify-email" state={{ email: user.email }} replace />;
  }

  return <Outlet />;
}
