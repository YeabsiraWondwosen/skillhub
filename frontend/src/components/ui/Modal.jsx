import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '3xl': 'max-w-3xl', full: 'max-w-7xl' };

export default function Modal({ open, isOpen, onClose, title, children, size = 'md', className, initialFocus }) {
  const show = open ?? isOpen ?? false;
  return (
    <Transition show={show} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50" initialFocus={initialFocus}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={clsx('card w-full p-6 shadow-xl', sizes[size], className)}>
                {title && (
                  <div className="flex items-center justify-between mb-5">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                      {title}
                    </Dialog.Title>
                    <button onClick={onClose} className="btn-icon text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export function ConfirmModal({ open, isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading, children }) {
  const show = open ?? isOpen ?? false;
  return (
    <Modal open={show} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>
      {children}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className={clsx('btn', danger ? 'btn-danger' : 'btn-primary')}>
          {loading ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
