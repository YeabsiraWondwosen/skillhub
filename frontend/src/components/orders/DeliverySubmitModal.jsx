import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useDeliverOrder } from '@/hooks/useOrders';

export default function DeliverySubmitModal({ open, onClose, order }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const { mutate: deliver, isPending } = useDeliverOrder();

  const addFiles = (list) => {
    setFiles(prev => [...prev, ...Array.from(list)].slice(0, 5));
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const onSubmit = () => {
    const fd = new FormData();
    if (message.trim()) fd.append('message', message.trim());
    files.forEach(f => fd.append('files', f));
    deliver({ orderId: order._id, formData: fd }, {
      onSuccess: () => {
        setMessage('');
        setFiles([]);
        onClose();
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit delivery" size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Submit the completed work for "{order?.title}". The client will review it and can release payment or request revisions.
      </p>

      <div className="space-y-4">
        <Textarea
          label="Delivery message"
          placeholder="Summarize what you delivered, how to use it, and anything the client should know…"
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          hint={`${message.length}/5000 characters`}
        />

        <div>
          <p className="label">Attachments (up to 5 files)</p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
          >
            <PaperClipIcon className="w-6 h-6 mx-auto mb-2 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Click to attach the delivered files</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </button>
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm bg-gray-50 dark:bg-dark-700 rounded-lg px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-danger-500 shrink-0">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} loading={isPending}>Submit Delivery</Button>
      </div>
    </Modal>
  );
}
