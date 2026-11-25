import { clsx } from 'clsx';

const STATUS_COLORS = {
  // Job / Application statuses
  open: 'badge-success', active: 'badge-success', available: 'badge-success',
  completed: 'badge-primary', released: 'badge-primary', approved: 'badge-primary',
  pending: 'badge-warning', funded: 'badge-warning', submitted: 'badge-warning',
  in_progress: 'badge-warning', shortlisted: 'badge-warning',
  viewed: 'badge-primary', accepted: 'badge-success',
  closed: 'badge-gray', cancelled: 'badge-gray', withdrawn: 'badge-gray',
  draft: 'badge-gray', paused: 'badge-gray', not_available: 'badge-gray', refunded: 'badge-gray',
  rejected: 'badge-danger', disputed: 'badge-danger', failed: 'badge-danger',
  revision_requested: 'badge-danger', banned: 'badge-danger',
  urgent: 'badge-danger',
  verified: 'badge-success', unverified: 'badge-gray',
  // Report statuses
  under_review: 'badge-info',
  resolved: 'badge-success', dismissed: 'badge-gray', reopened: 'badge-info',
  // General
  freelancer: 'badge-primary', client: 'badge-success', admin: 'badge-danger',
  expert: 'badge-primary', intermediate: 'badge-warning', entry: 'badge-gray',
  fixed: 'badge-primary', hourly: 'badge-success',
  // Contract statuses
  not_started: 'badge-gray', pending_payment: 'badge-warning', in_escrow: 'badge-info',
};

export default function Badge({ children, status, className }) {
  const colorClass = status ? (STATUS_COLORS[status] || 'badge-gray') : '';
  return (
    <span className={clsx('badge', colorClass, className)}>
      {children ?? (status?.replace(/_/g, ' ') ?? '')}
    </span>
  );
}
