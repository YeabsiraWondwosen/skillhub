import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, FlagIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService } from '@/services/report.service';
import toast from 'react-hot-toast';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'fake_account', label: 'Fake account' },
  { value: 'false_information', label: 'False information' },
  { value: 'copyright_violation', label: 'Copyright violation' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({ open, onClose, resourceType, resourceId, resourceLabel }) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [description, setDescription] = useState('');
  const qc = useQueryClient();

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => reportService.submitReport({
      resourceType,
      resourceId,
      reason,
      description: description.trim(),
    }),
    onSuccess: () => {
      toast.success('Report submitted. Our team will review it.');
      setDescription('');
      setReason(REPORT_REASONS[0].value);
      qc.invalidateQueries({ queryKey: ['reports'] });
      onClose();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Unable to submit report';
      toast.error(msg);
    },
  });

  const valid = reason && description.trim().length >= 20;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md p-5"
            role="dialog" aria-modal="true">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center flex-shrink-0">
                <FlagIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Report {resourceLabel || resourceType}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Your report is confidential and reviewed by our Trust &amp; Safety team.
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)} className="input text-sm py-2 w-full mt-1">
                  {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Details</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Please describe what happened (at least 20 characters)..."
                  rows={4}
                  className="input text-sm py-2 w-full mt-1 resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">{description.trim().length}/2000</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={onClose} disabled={isPending}
                className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => submit()} disabled={!valid || isPending}
                className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
                {isPending ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
