import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import {
  ArrowTopRightOnSquareIcon, PaperClipIcon, PhotoIcon, DocumentTextIcon,
  ArchiveBoxIcon, CodeBracketIcon, CheckCircleIcon, FlagIcon,
  FolderOpenIcon, ArrowPathIcon, DocumentArrowUpIcon, EyeIcon,
  ArrowDownTrayIcon, ExclamationTriangleIcon, UserIcon,
} from '@heroicons/react/24/outline';
import { useReviewDelivery, useApproveMilestone } from '@/hooks/useProjects';
import { milestoneService } from '@/services/milestone.service';
import { useQueryClient } from '@tanstack/react-query';
import { safeDemoUrl } from '@/utils/deliveryUrl';
import DeliverySubmitModal from './DeliverySubmitModal';
import DeliveryDetailsModal from './DeliveryDetailsModal';

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

export default function DeliveriesPanel({ project, milestoneDeliveries = [], isClient, isFreelancer }) {
  const { mutate: review, isPending: isReviewing } = useReviewDelivery();
  const { mutate: approveMilestone, isPending: isApprovingMilestone } = useApproveMilestone();
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [revisionTarget, setRevisionTarget] = useState(null);
  const [note, setNote] = useState('');
  const [lightbox, setLightbox] = useState('');
  const [milestoneResubmit, setMilestoneResubmit] = useState(null);
  const [resubmitNote, setResubmitNote] = useState('');
  const [resubmitFiles, setResubmitFiles] = useState([]);
  const [isResubmitting, setIsResubmitting] = useState(false);

  const projectDeliveries = project?.deliveries ?? [];
  const deliveries = [...projectDeliveries, ...(milestoneDeliveries ?? [])];
  const count = deliveries.length;
  const list = [...deliveries].reverse();
  const latest = list[0];
  const canDeliver = isFreelancer && ['active', 'in_revision'].includes(project?.status);

  const freelancer = project?.freelancer;
  const freelancerName = freelancer ? `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() : 'Freelancer';
  const showCompleted = project?.status === 'completed';
  const latestDemo = safeDemoUrl(latest?.demoUrl);

  const requestRevision = () => {
    if (note.trim().length < 3 || !revisionTarget) return;
    if (revisionTarget.isMilestoneDelivery) {
      milestoneService.requestRevision(revisionTarget._id, note.trim())
        .then(() => {
          toast.success('Revision requested');
          queryClient.invalidateQueries({ queryKey: ['projects', project._id, 'milestones'] });
          queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
          setRevisionTarget(null); setNote('');
        })
        .catch((e) => toast.error(e.response?.data?.message || 'Failed'));
      return;
    }
    review({ projectId: project._id, deliveryId: revisionTarget._id, data: { action: 'request_revision', revisionNote: note.trim() } }, {
      onSuccess: () => { setRevisionTarget(null); setNote(''); },
    });
  };

  const submitMilestoneResubmit = () => {
    if (resubmitNote.trim().length < 3) {
      toast.error('Please describe your changes (at least 3 characters).');
      return;
    }
    const fd = new FormData();
    fd.append('note', resubmitNote.trim());
    resubmitFiles.forEach(f => fd.append('files', f));
    setIsResubmitting(true);
    milestoneService.submit(milestoneResubmit._id, fd)
      .then(() => {
        toast.success('Milestone resubmitted');
        queryClient.invalidateQueries({ queryKey: ['projects', project._id, 'milestones'] });
        queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
        setMilestoneResubmit(null); setResubmitNote(''); setResubmitFiles([]);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Resubmission failed'))
      .finally(() => setIsResubmitting(false));
  };

  const downloadFile = (file) => {
    try {
      const a = document.createElement('a');
      a.href = file.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = file.originalName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('Unable to download file');
    }
  };
  const downloadAll = (files = []) => files.forEach(downloadFile);

  const openDetails = (delivery) => setViewing(delivery);

  return (
    <div className="space-y-6">
      {/* Completed project banner */}
      {showCompleted && (
        <div className="card p-6 border-0 bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-6 h-6" />
                <span className="text-xs font-bold uppercase tracking-widest">Project Completed</span>
              </div>
              <h2 className="text-2xl font-bold mt-2">{project?.title}</h2>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-semibold">100% Complete</span>
                <div className="w-32 h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: '100%' }} />
                </div>
              </div>
              {latest && (
                <p className="text-xs text-emerald-50/90 mt-3 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" />
                  {latest.title || 'Delivery'} · {freelancerName} · {format(new Date(latest.submittedAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {latest && (
                <button onClick={() => openDetails(latest)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 px-4 py-2 rounded-lg transition-colors">
                  <EyeIcon className="w-4 h-4" /> View Delivery
                </button>
              )}
              {latestDemo ? (
                <a href={latestDemo} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-white/15 hover:bg-white/25 ring-1 ring-white/40 px-4 py-2 rounded-lg transition-colors">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" /> Live Demo
                </a>
              ) : latest ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-50/90 px-2">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Live demo has not been provided yet.
                </span>
              ) : null}
              {latest?.files?.length > 0 && (
                <button onClick={() => downloadAll(latest.files)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-white/15 hover:bg-white/25 ring-1 ring-white/40 px-4 py-2 rounded-lg transition-colors">
                  <ArrowDownTrayIcon className="w-4 h-4" /> Download Files
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Deliveries</h2>
          <p className="text-xs text-gray-400">
            {count === 0 ? 'No delivery submitted yet.' : `${count} delivery${count > 1 ? 'ies' : ''} in this project.`}
          </p>
        </div>
        {canDeliver && (
          <Button size="sm" onClick={() => setSubmitOpen(true)}>
            <DocumentArrowUpIcon className="w-4 h-4" /> Submit Delivery
          </Button>
        )}
      </div>

      {count === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
            <FolderOpenIcon className="w-7 h-7 text-primary-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No deliveries yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5">
            {isFreelancer
              ? 'When you submit your completed work, the client will find it here — with your files, screenshots and live demo link.'
              : 'The freelancer hasn\'t submitted any work yet. You\'ll be notified the moment a delivery arrives.'}
          </p>
          {canDeliver && <Button size="md" onClick={() => setSubmitOpen(true)}>Submit First Delivery</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          {list.map((delivery, i) => {
            const index = count - i;
            const demo = safeDemoUrl(delivery.demoUrl);
            const revisionRequested = delivery.status === 'revision_requested';
            return (
              <div key={delivery._id} className="card p-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                      <PaperClipIcon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {delivery.isMilestoneDelivery ? `Milestone: ${delivery.title}` : `Delivery #${index}`}
                        </p>
                        {delivery.isMilestoneDelivery && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                            Milestone submission
                          </span>
                        )}
                        <Badge status={delivery.status}>{STATUS_LABELS[delivery.status] || delivery.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        Submitted by {freelancerName} · {format(new Date(delivery.submittedAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {delivery.title && (
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{delivery.title}</p>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => openDetails(delivery)}>
                      <EyeIcon className="w-4 h-4" /> View Delivery
                    </Button>
                  </div>
                </div>

                {/* Message */}
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {delivery.message}
                </p>

                {/* Live Demo */}
                <div className="mt-4">
                  {demo ? (
                    <a
                      href={demo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      Live Demo
                    </a>
                  ) : delivery.demoUrl ? (
                    <p className="text-xs text-danger-500">The live demo link could not be opened. (invalid URL)</p>
                  ) : (
                    <p className="text-sm text-gray-400">Live demo has not been provided yet.</p>
                  )}
                </div>

                {/* Screenshots */}
                {delivery.screenshots?.length > 0 ? (
                  <div className="mt-5">
                    <p className="label">Screenshots</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {delivery.screenshots.map((shot, si) => (
                        <button
                          key={si}
                          type="button"
                          onClick={() => setLightbox(shot.url)}
                          className="relative group aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                        >
                          <img src={shot.url} alt={shot.originalName || `Screenshot ${si + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <PhotoIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-gray-400">No screenshots have been provided.</p>
                )}

                {/* Files */}
                {delivery.files?.length > 0 ? (
                  <div className="mt-5">
                    <p className="label">Files</p>
                    <div className="space-y-2">
                      {delivery.files.map((file) => {
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
                              className="btn-secondary btn-sm shrink-0">Download</a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-gray-400">No files have been delivered yet.</p>
                )}

                {/* Revision note */}
                {delivery.revisionNote && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">
                    <FlagIcon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Revision requested</p>
                      <p className="mt-0.5 text-amber-600 dark:text-amber-400">{delivery.revisionNote}</p>
                    </div>
                  </div>
                )}

                {/* Approved note */}
                {delivery.status === 'approved' && (
                  <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm text-green-700 dark:text-green-300">
                    <CheckCircleIcon className="w-4 h-4 shrink-0" />
                    <span>This delivery has been approved by the client.</span>
                  </div>
                )}

                {/* Actions */}
                {isClient && delivery.status === 'pending' && (
                  <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Button size="sm" onClick={() => setApproveTarget(delivery)} variant="outline">
                      <CheckCircleIcon className="w-4 h-4" /> Approve Delivery
                    </Button>
                    <Button size="sm" onClick={() => setRevisionTarget(delivery)} variant="secondary">
                      <FlagIcon className="w-4 h-4" /> Request Revision
                    </Button>
                    <p className="text-xs text-gray-400 self-center ml-1">
                      Approving releases the payment from escrow.
                    </p>
                  </div>
                )}
                {isFreelancer && revisionRequested && (
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Button size="sm" onClick={() => delivery.isMilestoneDelivery ? setMilestoneResubmit(delivery) : setEditing(delivery)}>
                      <ArrowPathIcon className="w-4 h-4" /> Resubmit Delivery
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submit / Resubmit modal */}
      <DeliverySubmitModal
        open={submitOpen || !!editing}
        onClose={() => { setSubmitOpen(false); setEditing(null); }}
        project={project}
        initial={editing}
        mode={editing ? 'update' : 'create'}
      />

      {/* Delivery details modal */}
      <DeliveryDetailsModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        project={project}
        delivery={viewing}
        isClient={isClient}
        isFreelancer={isFreelancer}
        onResubmit={() => {
          if (!viewing) return;
          if (viewing.isMilestoneDelivery) setMilestoneResubmit(viewing);
          else setEditing(viewing);
          setViewing(null);
        }}
      />

      {/* Approve confirm */}
      <ConfirmModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget.isMilestoneDelivery) {
            approveMilestone(approveTarget._id, { onSuccess: () => setApproveTarget(null) });
            return;
          }
          review({
            projectId: project._id,
            deliveryId: approveTarget?._id,
            data: { action: 'approve' },
          }, {
            onSuccess: () => setApproveTarget(null),
          });
        }}
        title="Approve this delivery?"
        message="Approving will mark the delivery as accepted and release the payment from escrow to the freelancer. This can't be undone."
        confirmLabel="Approve & Release Payment"
        loading={isReviewing || isApprovingMilestone}
      />

      {/* Request revision modal */}
      <Modal open={!!revisionTarget} onClose={() => { setRevisionTarget(null); setNote(''); }} title="Request Revision" size="sm">
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
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={() => { setRevisionTarget(null); setNote(''); }}>Cancel</Button>
          <Button variant="danger" size="sm" loading={isReviewing} onClick={requestRevision}>
            <FlagIcon className="w-4 h-4" /> Request Revision
          </Button>
        </div>
      </Modal>

      {/* Screenshot lightbox */}
      <Modal open={!!lightbox} onClose={() => setLightbox('')} title="Screenshot" size="xl">
        <img src={lightbox} alt="Screenshot preview" className="w-full rounded-lg" />
      </Modal>

      {/* Milestone resubmission modal */}
      <Modal
        open={!!milestoneResubmit}
        onClose={() => { setMilestoneResubmit(null); setResubmitNote(''); setResubmitFiles([]); }}
        title="Resubmit Milestone"
        size="sm"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Tell the client what you changed. They'll re-review this milestone submission.
        </p>
        <Textarea
          label="Delivery note"
          rows={4}
          placeholder="Describe the changes made…"
          value={resubmitNote}
          onChange={e => setResubmitNote(e.target.value)}
        />
        <div className="mt-3">
          <label className="label">Attach files (optional)</label>
          <input
            type="file"
            multiple
            onChange={e => setResubmitFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100"
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={() => { setMilestoneResubmit(null); setResubmitNote(''); setResubmitFiles([]); }}>
            Cancel
          </Button>
          <Button size="sm" loading={isResubmitting} onClick={submitMilestoneResubmit}>
            <ArrowPathIcon className="w-4 h-4" /> Resubmit
          </Button>
        </div>
      </Modal>
    </div>
  );
}