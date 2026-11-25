import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function RoleRoute({ role }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.role !== role) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
