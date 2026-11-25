import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import OtpInput from '../../components/ui/OtpInput.jsx';
import { useResendEmailOtp, useVerifyEmailOtp } from '../../hooks/useAuth.js';
import { useAuthStore } from '../../store/authStore.js';
import { formatResendCountdown, isOtpComplete, OTP_LENGTH } from '../../utils/otpInput.js';

const RESEND_COOLDOWN_SEC = 60;

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState(
    location.state?.email || searchParams.get('email') || user?.email || ''
  );
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const [submitted, setSubmitted] = useState(false);
  const intervalRef = useRef(null);
  const mountedRedirectRef = useRef(false);

  const verifyMutation = useVerifyEmailOtp();
  const resendMutation = useResendEmailOtp();

  useEffect(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (mountedRedirectRef.current) return;
    mountedRedirectRef.current = true;
    if (user?.isEmailVerified) {
      navigate(user ? '/dashboard' : '/auth/login', { replace: true });
    }
  }, [user, navigate]);

  const goAfterSuccess = (message) => {
    toast.success(message);
    if (user) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/auth/login', { replace: true });
    }
  };

  const handleVerify = async () => {
    if (submitted) return;
    if (!isOtpComplete(otp, OTP_LENGTH)) {
      setError('Please enter the 6-digit code.');
      return;
    }
    if (!email) {
      setError('Email is required.');
      return;
    }
    setError('');
    setSubmitted(true);
    try {
      const res = await verifyMutation.mutateAsync({ email, otp });
      const alreadyVerified = res?.data?.data?.alreadyVerified;
      if (alreadyVerified || user?.isEmailVerified) {
        goAfterSuccess('Email is already verified');
      } else {
        goAfterSuccess('Email verified successfully. Please log in.');
      }
    } catch (err) {
      setSubmitted(false);
      const msg = err?.response?.data?.message || 'Verification failed. Please try again.';
      setError(msg);
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || resendMutation.isLoading) return;
    setError('');
    try {
      await resendMutation.mutateAsync({ email });
      toast.success('Verification code sent');
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to resend code.';
      setError(msg);
    }
  };

  const canVerify = isOtpComplete(otp, OTP_LENGTH) && email && !verifyMutation.isLoading;
  const canResend = !!email && cooldown === 0 && !resendMutation.isLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Verify your email</h2>
          <p className="mt-2 text-sm text-gray-600">
            We sent a 6-digit code to {email || 'your email'}
          </p>
        </div>

        {!email && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the email you registered with so we can resend your verification code.
            </p>
          </div>
        )}

        <div className="mt-6">
          <OtpInput
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setError('');
            }}
            length={OTP_LENGTH}
            autoFocus
            error={!!error}
            disabled={verifyMutation.isLoading}
            onComplete={(v) => setOtp(v)}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 text-center">{error}</div>
        )}

        <button
          onClick={handleVerify}
          disabled={!canVerify}
          className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
        >
          {verifyMutation.isLoading ? 'Verifying...' : 'Verify Email'}
        </button>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            onClick={handleResend}
            disabled={!canResend}
            className="text-blue-600 hover:text-blue-500 disabled:text-gray-400"
          >
            Resend code
          </button>
          {cooldown > 0 && (
            <span className="text-gray-500">{formatResendCountdown(cooldown)}</span>
          )}
        </div>

        <div className="text-center text-sm">
          <Link to="/auth/login" className="text-blue-600 hover:text-blue-500">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}