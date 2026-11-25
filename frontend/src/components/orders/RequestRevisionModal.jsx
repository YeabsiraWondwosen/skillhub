import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useRequestRevision } from '@/hooks/useOrders';

export default function RequestRevisionModal({ open, onClose, order }) {
  const [reason, setReason] = useState('');
  const { mutate: requestRevision, isPending } = useRequestRevision();

  const onSubmit = () => {
    requestRevision({ orderId: order._id, reason: reason.trim() }, {
      onSuccess: () => {
        setReason('');
        onClose();
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Request revisions" size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        The payment stays securely in escrow while the freelancer makes changes. Be specific so they can address everything.
      </p>

      <Textarea
        label="What needs to change? *"
        placeholder="Describe exactly what should be revised — missing requirements, changes to the delivered work, etc. (at least 5 characters)"
        rows={6}
        value={reason}
        onChange={e => setReason(e.target.value)}
        hint={`${reason.length}/2000 characters`}
      />

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} disabled={reason.trim().length < 5} loading={isPending}>
          Request Revision
        </Button>
      </div>
    </Modal>
  );
}
