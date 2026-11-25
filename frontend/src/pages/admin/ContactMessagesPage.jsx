import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { contactService } from '@/services/contact.service';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/DialogProvider';
import {
  InboxIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  EyeIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const STATUS_STYLES = {
  New: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  'In Progress': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  Replied: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  Resolved: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  Closed: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400',
};

const EMAIL_STATUS_STYLES = {
  Pending: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  Sending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  Sent: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  Failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const PRIORITY_STYLES = {
  Low: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400',
  Medium: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  High: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

export default function ContactMessagesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [status, setStatus] = useState('New');
  const [priority, setPriority] = useState('Medium');

  const { data: statsData } = useQuery({
    queryKey: ['admin-contact-stats'],
    queryFn: () => contactService.getAdminMessageStats(),
  });
  const stats = statsData?.data?.data || statsData?.data || { total: 0, newMessages: 0, inProgress: 0, replied: 0, resolved: 0, highPriority: 0, emailFailed: 0 };

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: () => contactService.getAdminMessages(),
  });
  const messages = messagesData?.data?.messages || messagesData?.data?.data || messagesData?.data || [];

  const selected = useMemo(() => Array.isArray(messages) ? messages.find((m) => m._id === selectedId) || null : null, [messages, selectedId]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status: newStatus }) => contactService.updateStatus(id, newStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-stats'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to update status');
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: ({ id, priority: newPriority }) => contactService.updatePriority(id, newPriority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-stats'] });
      toast.success('Priority updated');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to update priority');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, adminReply }) => contactService.replyToMessage(id, adminReply),
    onSuccess: (response) => {
      // Success is only reported after the backend confirms the mail provider
      // accepted the message (emailStatus === 'Sent').
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-stats'] });
      setReplyText('');
      toast.success(response?.data?.message || 'Reply sent successfully');
    },
    onError: (error) => {
      // The backend stores the failure (emailStatus === 'Failed') — refresh so
      // the saved reply and the real error reason are visible.
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-stats'] });
      toast.error(error?.response?.data?.message || 'Failed to send reply email');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => contactService.deleteMessage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-stats'] });
      setSelectedId(null);
      toast.success('Message deleted');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to delete message');
    },
  });

  const handleOpen = (msg) => {
    setSelectedId(msg._id);
    setStatus(msg.status);
    setPriority(msg.priority);
    setReplyText(msg.adminReply || '');
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    if (selectedId) {
      updateStatusMutation.mutate({ id: selectedId, status: newStatus });
    }
  };

  const handlePriorityChange = (e) => {
    const newPriority = e.target.value;
    setPriority(newPriority);
    if (selectedId) {
      updatePriorityMutation.mutate({ id: selectedId, priority: newPriority });
    }
  };

  const handleReply = () => {
    if (!replyText.trim() || replyText.trim().length < 10) {
      toast.error('Reply must be at least 10 characters');
      return;
    }
    if (selectedId) {
      replyMutation.mutate({ id: selectedId, adminReply: replyText.trim() });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    confirm({
      title: 'Delete message',
      message: 'Are you sure you want to delete this message? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteMutation.mutateAsync(selectedId),
    });
  };

  const statCards = [
    { label: 'Total Messages', value: stats.total, icon: InboxIcon, color: 'text-blue-600' },
    { label: 'New', value: stats.newMessages, icon: ClockIcon, color: 'text-yellow-600' },
    { label: 'In Progress', value: stats.inProgress, icon: ChatBubbleLeftRightIcon, color: 'text-orange-600' },
    { label: 'Replied', value: stats.replied ?? 0, icon: PaperAirplaneIcon, color: 'text-purple-600' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircleIcon, color: 'text-green-600' },
    { label: 'Email Failed', value: stats.emailFailed ?? 0, icon: ExclamationTriangleIcon, color: 'text-red-600' },
    { label: 'High Priority', value: stats.highPriority, icon: ExclamationTriangleIcon, color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Contact Messages" subtitle="Manage and respond to contact form submissions" />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center', color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-dark-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Loading...</td>
                </tr>
              ) : !Array.isArray(messages) || messages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12">
                    <EmptyState icon={InboxIcon} title="No messages yet" description="Contact messages will appear here." />
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{msg.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-300">{msg.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">{msg.subject}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx('badge', STATUS_STYLES[msg.status] || 'badge-gray')}>
                        {msg.status}
                      </span>
                      {msg.emailStatus && (
                        <span
                          className={clsx('badge ml-1', EMAIL_STATUS_STYLES[msg.emailStatus] || 'badge-gray')}
                          title={
                            msg.emailStatus === 'Failed'
                              ? `Email delivery failed: ${msg.emailError || 'unknown error'}`
                              : `Reply email: ${msg.emailStatus}`
                          }
                        >
                          Email: {msg.emailStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx('badge', PRIORITY_STYLES[msg.priority] || 'badge-gray')}>
                        {msg.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {format(new Date(msg.createdAt), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleOpen(msg)}>
                        <EyeIcon className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelectedId(null)} title="Message Details" size="lg">
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sender Name</p>
                <p className="text-base text-gray-900 dark:text-white mt-1">{selected.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-base text-gray-900 dark:text-white mt-1">{selected.email}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Subject</p>
                <p className="text-base text-gray-900 dark:text-white mt-1">{selected.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted Date</p>
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {format(new Date(selected.createdAt), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                <Select value={status} onChange={handleStatusChange} className="mt-1">
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Replied">Replied</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </Select>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</p>
                <Select value={priority} onChange={handlePriorityChange} className="mt-1">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Full Message</p>
              <div className="bg-gray-50 dark:bg-dark-900 rounded-lg p-4">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selected.message}</p>
              </div>
            </div>

            {selected.adminReply && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Admin Reply</p>
                  {selected.emailStatus && (
                    <span className={clsx('badge', EMAIL_STATUS_STYLES[selected.emailStatus] || 'badge-gray')}>
                      Email: {selected.emailStatus}
                    </span>
                  )}
                </div>
                <div
                  className={clsx(
                    'rounded-lg p-4 border',
                    selected.emailStatus === 'Failed'
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  )}
                >
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selected.adminReply}</p>
                  {selected.repliedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Replied on {format(new Date(selected.repliedAt), 'MMM dd, yyyy HH:mm')}
                      {selected.emailStatus === 'Sent' && selected.emailSentAt
                        ? ` · Email delivered to ${selected.email} on ${format(new Date(selected.emailSentAt), 'MMM dd, yyyy HH:mm')}`
                        : ''}
                    </p>
                  )}
                  {selected.emailStatus === 'Failed' && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded-md p-2">
                      <strong>Email was NOT delivered.</strong>{' '}
                      {selected.emailError || 'Unknown error.'}
                      <br />
                      The reply above is saved — use “Send Reply” again after fixing the mail configuration.
                    </div>
                  )}
                  {selected.emailStatus === 'Sending' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      Email is being sent…
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Reply to User</p>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                placeholder="Write your reply here..."
                error={replyText && replyText.trim().length < 10 ? 'Reply must be at least 10 characters' : null}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {replyText.trim() ? `${replyText.trim().length}/5000 characters` : '0/5000 characters'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This reply will be emailed to{' '}
                <strong className="text-gray-700 dark:text-gray-300">{selected.email}</strong> from SkillHub
                Support.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
                <TrashIcon className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setSelectedId(null)}>
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Close
                </Button>
                <Button onClick={handleReply} loading={replyMutation.isPending} disabled={!replyText.trim() || replyText.trim().length < 10}>
                  <PaperAirplaneIcon className="w-4 h-4 mr-1" />
                  Send Reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
