import { useRef, useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { PaperClipIcon, XMarkIcon, CameraIcon } from '@heroicons/react/24/outline';
import { useSubmitDelivery, useUpdateDelivery } from '@/hooks/useProjects';
import { safeDemoUrl } from '@/utils/deliveryUrl';

const MAX_FILES = 10;
const MAX_SCREENSHOTS = 6;

export default function DeliverySubmitModal({ open, onClose, project, initial, mode = 'create' }) {
  const isUpdate = mode === 'update';
  const fileInput = useRef(null);
  const shotInput = useRef(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [files, setFiles] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [error, setError] = useState('');

  const { mutate: deliver, isPending: isDelivering } = useSubmitDelivery();
  const { mutate: update, isPending: isUpdating } = useUpdateDelivery();

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setMessage(initial?.message || '');
      setDemoUrl(initial?.demoUrl || '');
      setFiles([]);
      setScreenshots([]);
      setError('');
    }
  }, [open, initial]);

  const addFiles = (list) => {
    setFiles(prev => [...prev, ...Array.from(list)].slice(0, MAX_FILES));
  };

  const addScreenshots = (list) => {
    setScreenshots(prev => [...prev, ...Array.from(list)].slice(0, MAX_SCREENSHOTS));
  };

  const removeAt = (list, setter, i) => setter(list.filter((_, idx) => idx !== i));

  const onSubmit = () => {
    if (message.trim().length < 20) {
      setError('Delivery message must be at least 20 characters.');
      return;
    }
    if (demoUrl.trim() && !safeDemoUrl(demoUrl)) {
      setError('Live demo URL is invalid. Use a valid http(s) link.');
      return;
    }
    const fd = new FormData();
    if (title.trim()) fd.append('title', title.trim());
    fd.append('message', message.trim());
    if (demoUrl.trim()) fd.append('demoUrl', demoUrl.trim());
    files.forEach(f => fd.append('files', f));
    screenshots.forEach(s => fd.append('screenshots', s));

    if (isUpdate) {
      update({ projectId: project._id, deliveryId: initial._id, formData: fd }, { onSuccess: onClose });
    } else {
      deliver({ projectId: project._id, formData: fd }, { onSuccess: onClose });
    }
  };

  const pending = isDelivering || isUpdating;

  return (
    <Modal open={open} onClose={onClose}
      title={isUpdate ? 'Resubmit Delivery' : 'Submit Delivery'} size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        {isUpdate
          ? 'Update the description, live demo or add more files/screenshots. The client will re-review it.'
          : `Submit the completed work for "${project?.title}". The client will review it — when they approve, payment is released from escrow.`}
      </p>

      <div className="space-y-4">
        <Input
          label="Delivery title (optional)"
          placeholder="e.g. Homepage & checkout flow implemented"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
        />

        <Textarea
          label="Delivery message"
          placeholder="Summarize what you've delivered, how to test it, and anything the client should know…"
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          hint={`${message.length}/3000 characters`}
        />

        <Input
          label="Live demo URL (optional)"
          placeholder="https://my-project-demo.example.com"
          value={demoUrl}
          onChange={e => setDemoUrl(e.target.value)}
          hint="A link the client can open to see the work running."
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="label">Files (up to {MAX_FILES}, optional)</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
            >
              <PaperClipIcon className="w-5 h-5 mx-auto mb-1 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Click to attach the delivered files</span>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs bg-gray-50 dark:bg-dark-700 rounded-lg px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => removeAt(files, setFiles, i)} className="text-gray-400 hover:text-danger-500 shrink-0">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="label">Screenshots (up to {MAX_SCREENSHOTS}, optional)</p>
            <button
              type="button"
              onClick={() => shotInput.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
            >
              <CameraIcon className="w-5 h-5 mx-auto mb-1 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Click to add screenshot images</span>
              <input
                ref={shotInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addScreenshots(e.target.files)}
              />
            </button>
            {screenshots.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {screenshots.map((f, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-video">
                    <img src={URL.createObjectURL(f)} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAt(screenshots, setScreenshots, i)}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} loading={pending}>
          {isUpdate ? 'Resubmit Delivery' : 'Submit Delivery'}
        </Button>
      </div>
    </Modal>
  );
}