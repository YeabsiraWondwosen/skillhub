import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import Avatar from '@/components/ui/Avatar';
import { useReviewDelivery, useApproveMilestone } from '@/hooks/useProjects';
import { milestoneService } from '@/services/milestone.service';
import { useQueryClient } from '@tanstack/react-query';
import { safeDemoUrl } from '@/utils/deliveryUrl';
import {
  ArrowTopRightOnSquareIcon, PhotoIcon, DocumentTextIcon,
  ArchiveBoxIcon, CodeBracketIcon, CheckCircleIcon, FlagIcon,
  ExclamationTriangleIcon, ArrowPathIcon, CalendarIcon, UserIcon,
} from '@heroicons/react/24/outline';

const STATUS_LABELS = {
  pending: 'Submitted',
  approved: 'Approved',
  revision_requested: 'Revision Requested',
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const fileIcon = (file) => {
  const type = file.fileType || '';
  if (type.startsWith('image/')) return PhotoIcon;
  if (/(zip|rar|tar|gzip|7z)/.test(type)) return ArchiveBoxIcon;
  if (/(javascript|python|java|c\+\+|typescript|go|ruby|php|sql|yaml|markdown|shellscript)/.test(type)) return CodeBracketIcon;
  return DocumentTextIcon;
};

export default function DeliveryDetailsModal({ open, onClose, project, delivery, isClient, isFreelancer, onResubmit }) {
  const { mutate: review, isPending: isReviewing } = useReviewDelivery();
  const { mutate: approveMilestone, isPending: isApprovingMilestone } = useApproveMilestone();
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!delivery) {
    return (
      <Modal open={open} onClose={onClose} title="Delivery" size="lg">
        <p className="text-sm text-gray-400">No delivery selected.</p>
      </Modal>
    );
  }

  const demo = safeDemoUrl(delivery.demoUrl);
  const submittedBy = delivery.submittedBy?.firstName ? delivery.submittedBy : project?.freelancer;
  const submittedByName = submittedBy
    ? `${submittedBy.firstName || ''} ${submittedBy.lastName || ''}`.trim()
    : 'Freelancer';
  const screenshots = delivery.screenshots ?? [];
  const files = delivery.files ?? [];

  const closeAndReset = () => {
    setApproveOpen(false);
    setRevisionOpen(false);
    setNote('');
    setError('');
    onClose();
  };

  const approve = () => {
    if (delivery.isMilestoneDelivery) {
      approveMilestone(delivery._id, { onSuccess: closeAndReset });
      return;
    }
    review(
      { projectId: project._id, deliveryId: delivery._id, data: { action: 'approve' } },
      { onSuccess: closeAndReset }
    );
  };

  const requestRevision = () => {
    if (note.trim().length < 3) {
      setError('Please describe the changes needed (at least 3 characters).');
      return;
    }
    if (delivery.isMilestoneDelivery) {
      milestoneService.requestRevision(delivery._id, note.trim())
        .then(() => {
          toast.success('Revision requested');
          queryClient.invalidateQueries({ queryKey: ['projects', project._id, 'milestones'] });
          queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
          closeAndReset();
        })
        .catch((e) => setError(e.response?.data?.message || 'Failed to request revision.'));
      return;
    }
    review(
      {
        projectId: project._id,
        deliveryId: delivery._id,
        data: { action: 'request_revision', revisionNote: note.trim() },
      },
      { onSuccess: closeAndReset, onError: () => setError('Failed to request revision. Please try again.') }
    );
  };

  return (
    <Modal open={open} onClose={closeAndReset} title="Delivery" size="xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">DELIVERY</p>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {delivery.title || 'Delivered work'}
          </h3>
        </div>
        <Badge status={delivery.status}>{STATUS_LABELS[delivery.status] || delivery.status}</Badge>
      </div>

      {/* Submitted by / date */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-gray-400 mb-5">
        <span className="inline-flex items-center gap-1.5">
          <UserIcon className="w-4 h-4" /> Submitted by{' '}
          <span className="inline-flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
            <Avatar src={submittedBy?.avatar?.url || submittedBy?.avatar} alt={submittedByName} size="xs" />
            {submittedByName}
          </span>
        </span>
        {delivery.submittedAt && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4" /> Submitted {format(new Date(delivery.submittedAt), 'MMM d, yyyy h:mm a')}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {/* Description */}
        <div>
          <p className="label">Description</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {delivery.message || 'No description provided.'}
          </p>
        </div>

        {/* Live Demo */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="label">Live Demo</p>
          {demo ? (
            <a
              href={demo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-lg transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              Open Live Demo
            </a>
          ) : delivery.demoUrl ? (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>The live demo link could not be opened (invalid URL).</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Live demo has not been provided yet.</p>
          )}
        </div>

        {/* Screenshots */}
        <div>
          <p className="label">Screenshots</p>
          {screenshots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {screenshots.map((shot, i) => (
                <a
                  key={shot.url || i}
                  href={shot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                >
                  <img
                    src={shot.url}
                    alt={shot.originalName || `Screenshot ${i + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <PhotoIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No screenshots have been provided.</p>
          )}
        </div>

        {/* Files */}
        <div>
          <p className="label">Files</p>
          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => {
                const Icon = fileIcon(file);
                return (
                  <div key={file.url || file.originalName}
                    className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-dark-700 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-gray-500" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.originalName}</p>
                        <p className="text-xs text-gray-400">
                          {file.fileType || 'file'}{file.fileSize ? ` · ${formatBytes(file.fileSize)}` : ''}
                        </p>
                      </div>
                    </div>
                    <a href={file.url} target="_blank" rel="noopener noreferrer" download
                      className="btn-secondary btn-sm shrink-0">
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 inline -mt-0.5" /> Download
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No files have been delivered yet.</p>
          )}
        </div>

        {/* Revision note */}
        {delivery.revisionNote && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">
            <FlagIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Revision requested</p>
              <p className="mt-0.5 text-amber-600 dark:text-amber-400">{delivery.revisionNote}</p>
            </div>
          </div>
        )}

        {/* Approved note */}
        {delivery.status === 'approved' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm text-green-700 dark:text-green-300">
            <CheckCircleIcon className="w-4 h-4 shrink-0" />
            <span>This delivery has been approved by the client.</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isClient && delivery.status === 'pending' && (
        <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button size="sm" onClick={() => setApproveOpen(true)}>
            <CheckCircleIcon className="w-4 h-4" /> Approve Delivery
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setRevisionOpen(true)}>
            <FlagIcon className="w-4 h-4" /> Request Revision
          </Button>
          <p className="text-xs text-gray-400 self-center ml-1">
            Approving releases the payment from escrow.
          </p>
        </div>
      )}
      {isFreelancer && delivery.status === 'revision_requested' && onResubmit && (
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button size="sm" onClick={onResubmit}>
            <ArrowPathIcon className="w-4 h-4" /> Resubmit Delivery
          </Button>
        </div>
      )}

      {/* Approve confirm */}
      <ConfirmModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={approve}
        title="Approve this delivery?"
        message="Approving will mark the delivery as accepted and release the payment from escrow to the freelancer. This can't be undone."
        confirmLabel="Approve & Release Payment"
        loading={isReviewing || isApprovingMilestone}
      />

      {/* Request revision modal */}
      <Modal open={revisionOpen} onClose={() => { setRevisionOpen(false); setError(''); }} title="Request Revision" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Tell the freelancer what needs to change. They'll be notified and can resubmit an updated delivery.
        </p>
        <Textarea
          label="Revision note"
          rows={4}
          placeholder="Describe what needs to be changed or improved…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-danger-500 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={() => { setRevisionOpen(false); setError(''); }}>Cancel</Button>
          <Button variant="danger" size="sm" loading={isReviewing} onClick={requestRevision}>
            <FlagIcon className="w-4 h-4" /> Request Revision
          </Button>
        </div>
      </Modal>
    </Modal>
  );
}