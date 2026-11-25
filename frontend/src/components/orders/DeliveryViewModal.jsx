import Modal from '@/components/ui/Modal';
import { PaperClipIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export default function DeliveryViewModal({ open, onClose, order }) {
  const delivery = order?.delivery;

  return (
    <Modal open={open} onClose={onClose} title="Delivered work" size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Delivery submitted by {[order?.freelancer?.firstName, order?.freelancer?.lastName].filter(Boolean).join(' ')} for "{order?.title}".
      </p>

      {delivery?.submittedAt && (
        <p className="text-xs text-gray-400 mb-4">
          Submitted {format(new Date(delivery.submittedAt), 'MMM d, yyyy h:mm a')}
        </p>
      )}

      <div className="space-y-4">
        {delivery?.message ? (
          <div className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Delivery message</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{delivery.message}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No delivery message provided.</p>
        )}

        {delivery?.files?.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Files ({delivery.files.length})</p>
            <div className="flex flex-wrap gap-2">
              {delivery.files.map((file, i) => (
                <a key={i} href={file.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-dark-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600">
                  <PaperClipIcon className="w-3.5 h-3.5" /> {file.name || `File ${i + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}

        {!delivery?.files?.length && !delivery?.message && (
          <p className="text-sm text-gray-400">No files were attached to this delivery.</p>
        )}
      </div>
    </Modal>
  );
}
