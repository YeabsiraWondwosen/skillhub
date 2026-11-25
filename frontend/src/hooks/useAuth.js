import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { buildAuthEntryLocation, extractFromPath, resolvePostAuthDestination } from '@/utils/authRedirect';

export const useLogin = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  return useMutation({
    mutationFn: authService.login,
    onSuccess: ({ data }) => {
      const { user, accessToken } = data.data;
      login(user, accessToken);
      if (user.isEmailVerified === false) {
        toast.error('Please verify your email to continue.');
        navigate('/auth/verify-email', { state: { email: user.email }, replace: true });
        return;
      }
      toast.success(`Welcome back, ${user.firstName}!`, {
        duration: 500,
        id: 'login-welcome',
      });
      const destination = resolvePostAuthDestination({ locationState: location.state, user });
      navigate(destination.to, { state: destination.state, replace: destination.replace });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Login failed');
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return useMutation({
    mutationFn: authService.register,
    onSuccess: (res, variables) => {
      const requiresVerification = res?.data?.data?.requiresEmailVerification;
      if (requiresVerification) {
        toast.success(res?.data?.message || 'Account created! Check your email for a 6-digit code.');
        navigate('/auth/verify-email', { state: { email: variables?.email }, replace: true });
      } else {
        toast.success('Account created! Please log in.');
        navigate('/auth/login', { replace: true });
      }
    },
    onError: (err) => toast.error(err.response?.data?.errors?.[0] || err.response?.data?.message || 'Registration failed'),
  });
};

export const useLogout = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      logout();
      qc.clear();
      navigate('/auth/login');
    },
  });
};

export const useForgotPassword = () =>
  useMutation({
    mutationFn: ({ email }) => authService.forgotPassword(email),
    onSuccess: () => toast.success('Reset link sent to your email'),
    onError: (err) => toast.error(err.response?.data?.message || 'Request failed'),
  });

export const useResetPassword = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: () => {
      toast.success('Password reset! Please log in.');
      navigate('/auth/login');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Reset failed'),
  });
};

export const useChangePassword = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      toast.success('Password changed. Please log in again.');
      logout();
      qc.clear();
      navigate('/auth/login');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to change password'),
  });
};

export const useVerifyEmailChange = (token) =>
  useQuery({
    queryKey: ['verify-email-change', token],
    queryFn: () => authService.verifyEmailChange(token),
    enabled: !!token,
    retry: false,
  });

export const useVerifyEmailOtp = () => {
  const { updateUser } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authService.verifyEmailOtp,
    onSuccess: ({ data }) => {
      const updatedUser = data?.data?.user;
      if (updatedUser) updateUser(updatedUser);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
};

export const useResendEmailOtp = () =>
  useMutation({
    mutationFn: authService.resendEmailOtp,
  });

export const useDeleteAccount = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authService.deleteAccount,
    onSuccess: () => {
      toast.success('Your account has been permanently deleted.');
      logout();
      qc.clear();
      navigate('/');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete account'),
  });
};
