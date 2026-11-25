import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useDeleteAccount } from '@/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';

export default function DangerZone() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const { mutate: deleteAccount, isPending } = useDeleteAccount();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const confirmText = watch('confirmText') || '';
  const password = watch('password') || '';
  const canDelete = confirmText === 'DELETE' && password.length > 0;

  // Step 1: validate the form, then open the final confirmation dialog. Nothing
  // is deleted here — deletion only fires from the dialog's confirm action.
  const requestDelete = handleSubmit((data) => {
    setPendingDelete({ password: data.password, confirmText: data.confirmText });
    setFinalOpen(true);
  });

  // Step 2: the ONLY place the delete mutation is invoked.
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteAccount(pendingDelete, {
      onSettled: () => {
        setFinalOpen(false);
        setPendingDelete(null);
      },
    });
  };

  const reset = () => {
    setConfirmOpen(false);
    setFinalOpen(false);
    setPendingDelete(null);
  };

  return (
    <div className="card p-6 border-danger-200 dark:border-danger-900/40">
      <h2 className="font-semibold text-danger-600 dark:text-danger-400 mb-4 flex items-center gap-2">
        <ExclamationTriangleIcon className="w-5 h-5" /> Danger Zone
      </h2>

      {!confirmOpen ? (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Delete account</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete Account</Button>
        </div>
      ) : (
        <form onSubmit={requestDelete} className="space-y-4">
          <div className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg text-sm text-danger-600 dark:text-danger-400">
            Deleting your account will permanently remove your profile, portfolio, transactions, reviews and all
            related data. This action is irreversible.
          </div>
          <Input label="Type DELETE to confirm" placeholder="DELETE"
            error={errors.confirmText?.message}
            {...register('confirmText', {
              required: 'Please type DELETE',
              validate: (v) => v === 'DELETE' || 'Please type DELETE exactly',
            })} />
          <Input label="Password" type="password" placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password', { required: 'Password is required' })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={!canDelete}>
              Permanently Delete Account
            </Button>
          </div>
        </form>
      )}

      <ConfirmModal
        isOpen={finalOpen}
        onClose={() => { if (!isPending) setFinalOpen(false); }}
        onConfirm={confirmDelete}
        title="Delete your account?"
        message="This is your final confirmation. Your account and all associated data will be permanently deleted. This cannot be undone."
        confirmLabel="Yes, delete permanently"
        danger
        loading={isPending}
      />
    </div>
  );
}
