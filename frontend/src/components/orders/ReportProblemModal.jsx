import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useReportOrder } from '@/hooks/useOrders';

const REPORT_REASONS = [
  'spam',
  'inappropriate_content',
  'harassment',
  'scam',
  'copyright_violation',
  'false_information',
  'other',
];

export default function ReportProblemModal({ open, onClose, order }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const { mutate: report, isPending } = useReportOrder();

  const onSubmit = () => {
    report({
      orderId: order._id,
      data: { reason, description: description.trim() },
    }, {
      onSuccess: () => {
        setReason('');
        setDescription('');
        onClose();
      },
    });
  };

  const canSubmit = reason && description.trim().length >= 20;

  return (
    <Modal open={open} onClose={onClose} title="Report a problem" size="lg">
      <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-4 mb-5 text-sm text-yellow-800 dark:text-yellow-200">
        Funds for this order are locked in escrow and will not be released until the dispute is resolved. Our support team will review your report.
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Reason *</label>
          <select
            className="input"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            <option value="">Select a reason…</option>
            {REPORT_REASONS.map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <Textarea
          label="Describe the problem *"
          placeholder="Explain what went wrong in detail — what was promised, what was delivered, and any evidence. (at least 20 characters)"
          rows={6}
          value={description}
          onChange={e => setDescription(e.target.value)}
          hint={`${description.trim().length}/2000 characters`}
        />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onSubmit} disabled={!canSubmit} loading={isPending}>
          Report Problem
        </Button>
      </div>
    </Modal>
  );
}
