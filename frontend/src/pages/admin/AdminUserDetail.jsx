import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StarRating from '@/components/ui/StarRating';
import { SkeletonText } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/Modal';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/currency';
import { ArrowLeft } from 'lucide-react';

const ACCOUNT_ACTIONS = {
  verify: {
    title: 'Verify Freelancer',
    actionLabel: 'Verify Freelancer',
    message: 'Are you sure you want to verify this freelancer?',
    confirmLabel: 'Confirm Verification',
    danger: false,
    payload: () => ({ isVerifiedFreelancer: true }),
  },
  unverify: {
    title: 'Unverify Freelancer',
    actionLabel: 'Unverify Freelancer',
    message: 'Are you sure you want to remove the verified status from this freelancer?',
    confirmLabel: 'Unverify Freelancer',
    danger: true,
    payload: () => ({ isVerifiedFreelancer: false }),
  },
  activate: {
    title: 'Activate Account',
    actionLabel: 'Activate Account',
    message: 'Are you sure you want to activate this account?',
    confirmLabel: 'Activate Account',
    danger: false,
    payload: () => ({ isActive: true }),
  },
  deactivate: {
    title: 'Deactivate Account',
    actionLabel: 'Deactivate Account',
    message: 'Are you sure you want to deactivate this account?',
    confirmLabel: 'Deactivate Account',
    danger: true,
    payload: () => ({ isActive: false }),
  },
};

export default function AdminUserDetail() {
  const { userId } = useParams();
  const qc = useQueryClient();
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [action, setAction] = useState(null);
  const actionLabelRef = useRef('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminService.getUserDetail(userId).then(r => r.data),
    enabled: !!userId,
  });
  const user = data?.data;
  const isAdmin = user?.role === 'admin';
  const actionConfig = ACCOUNT_ACTIONS[action];

  const { mutate: updateUser, isPending } = useMutation({
    mutationFn: (data) => adminService.updateUser(userId, data),
    onSuccess: () => { toast.success(`${actionLabelRef.current} — completed`); qc.invalidateQueries({ queryKey: ['admin', 'user', userId] }); },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <div className="page-container max-w-3xl"><SkeletonText lines={10} /></div>;
  if (!user) return <div className="page-container"><p className="text-gray-500">User not found.</p></div>;

  const adminInfo = [
    { label: 'Role', value: <Badge status="admin">Admin</Badge> },
    { label: 'Status', value: user.isActive ? <Badge status="active">Active</Badge> : <Badge status="rejected">Suspended</Badge> },
    { label: 'Member Since', value: format(new Date(user.createdAt), 'MMMM d, yyyy') },
    { label: 'Last Login', value: format(new Date(user.lastSeen || user.createdAt), 'MMMM d, yyyy') },
    { label: 'Email', value: user.email },
    { label: 'Permissions', value: 'Full Platform Access' },
    { label: 'Account Type', value: 'Protected Administrator' },
  ];

  return (
    <div className="page-container max-w-3xl space-y-6">
      <Link to="/admin/users" className="text-sm text-gray-400 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft size={14} /> Users</Link>

      <div className="card p-6">
        <div className="flex items-start gap-5">
          <Avatar src={user.avatar?.url} alt={`${user.firstName} ${user.lastName}`} size="xl" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </h1>
              <Badge status={user.role} />
              {!isAdmin && user.isBanned && <Badge status="rejected">Banned</Badge>}
              {!isAdmin && user.isVerifiedFreelancer && <Badge status="active">Verified</Badge>}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
            {!isAdmin && (
              <>
                <div className="flex items-center gap-1 mt-1">
                  <StarRating value={user.stats?.averageRating ?? 0} readonly size="sm" />
                  <span className="text-xs text-gray-400">({user.stats?.totalReviews ?? 0} reviews)</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Joined {format(new Date(user.createdAt), 'MMMM d, yyyy')}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {isAdmin ? (
        <>
          {/* Administrator Information */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Administrator Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {adminInfo.map(r => (
                <div key={r.label}>
                  <p className="text-gray-400 text-xs">{r.label}</p>
                  <p className="font-semibold text-gray-900 dark:text-white break-all">{r.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Protected info card */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheckIcon className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Protected Administrator Account</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Administrator accounts cannot be banned, deleted or deactivated from User Management.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              To change administrator permissions, use the dedicated administrator management system.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Completed Projects', value: user.stats?.completedProjects ?? 0 },
              { label: 'Active Projects', value: user.stats?.activeProjects ?? 0 },
              { label: user.role === 'freelancer' ? 'Total Earned' : 'Total Spent',
                value: formatCurrency(user.role === 'freelancer' ? user.stats?.totalEarnings : user.stats?.totalSpent) },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <p className="stat-value">{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Admin Actions</h2>
            <div className="flex flex-wrap gap-3">
              {user.role === 'freelancer' && (
                <Button size="sm" variant={user.isVerifiedFreelancer ? 'secondary' : 'primary'}
                  disabled={isPending}
                  onClick={() => setAction(user.isVerifiedFreelancer ? 'unverify' : 'verify')}>
                  {user.isVerifiedFreelancer ? 'Unverify Freelancer' : 'Verify Freelancer'}
                </Button>
              )}
              <Button size="sm" variant={user.isActive ? 'danger' : 'primary'}
                disabled={isPending}
                onClick={() => setAction(user.isActive ? 'deactivate' : 'activate')}>
                {user.isActive ? 'Deactivate Account' : 'Activate Account'}
              </Button>
              <Button size="sm" variant="danger" disabled={isPending} onClick={() => setBanOpen(true)}>
                {user.isBanned ? 'Unban User' : 'Ban User'}
              </Button>
            </div>
            {user.isBanned && user.banReason && (
              <p className="text-sm text-red-500">Ban reason: {user.banReason}</p>
            )}
          </div>

          {/* Wallet info */}
          {user.wallet && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Wallet</h2>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Balance', value: formatCurrency(user.wallet.balance) },
                  { label: 'In Escrow', value: formatCurrency(user.wallet.escrowBalance) },
                  { label: 'Currency', value: user.wallet.currency },
                ].map(r => (
                  <div key={r.label}>
                    <p className="text-gray-400 text-xs">{r.label}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ban Modal */}
          <ConfirmModal open={banOpen} onClose={() => setBanOpen(false)}
            title={user.isBanned ? 'Unban User' : 'Ban User'}
            message={user.isBanned
              ? 'This will restore full access to this account.'
              : 'This will immediately suspend this account.'}
            confirmLabel={user.isBanned ? 'Unban' : 'Ban User'}
            danger={!user.isBanned}
            loading={isPending}
            onConfirm={() => {
              updateUser({ isBanned: !user.isBanned, banReason: banReason || 'Admin action' },
                { onSuccess: () => setBanOpen(false) });
            }}
          >
            {!user.isBanned && (
              <input value={banReason} onChange={e => setBanReason(e.target.value)}
                placeholder="Reason for ban (optional)" className="input mt-3" />
            )}
          </ConfirmModal>

          {/* Verify / Activate / Deactivate confirmation */}
          <ConfirmModal
            open={!!action}
            onClose={() => setAction(null)}
            title={actionConfig?.title}
            message={actionConfig?.message}
            confirmLabel={actionConfig?.confirmLabel}
            danger={actionConfig?.danger}
            loading={isPending}
            onConfirm={() => {
              actionLabelRef.current = actionConfig.actionLabel;
              updateUser(actionConfig.payload(), { onSuccess: () => setAction(null) });
            }}
          >
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-1.5 mt-3">
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Name</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">{user.firstName} {user.lastName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Email</span>
                <span className="text-gray-700 dark:text-gray-200 text-right break-all">{user.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Action</span>
                <span className="font-medium text-gray-900 dark:text-white">{actionConfig?.actionLabel}</span>
              </div>
            </div>
          </ConfirmModal>
        </>
      )}
    </div>
  );
}
