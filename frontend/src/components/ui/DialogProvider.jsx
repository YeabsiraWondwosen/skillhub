import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Textarea from './Textarea';
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

const DialogContext = createContext(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a <DialogProvider>');
  return ctx;
}

export function useConfirm() {
  return useDialog().confirm;
}

export function usePrompt() {
  return useDialog().prompt;
}

export function DialogProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const queueRef = useRef([]);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const requestRef = useRef(null);
  const inputRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  const showRequest = useCallback((next) => {
    activeRef.current = true;
    busyRef.current = false;
    requestRef.current = next;
    setRequest(next);
    setLastRequest(next);
    setValue(next?.kind === 'prompt' ? (next.defaultValue ?? '') : '');
    setError('');
    setLoading(false);
  }, []);

  const enqueue = useCallback((next) => new Promise((resolve) => {
    const item = { ...next, resolve };
    if (activeRef.current) {
      queueRef.current.push(item);
    } else {
      showRequest(item);
    }
  }), [showRequest]);

  const settle = useCallback((result) => {
    const current = requestRef.current;
    requestRef.current = null;
    busyRef.current = false;
    setRequest(null);
    setError('');
    setLoading(false);
    if (current?.resolve) current.resolve(result);
    const next = queueRef.current.shift() || null;
    if (next) {
      showRequest(next);
    } else {
      activeRef.current = false;
    }
  }, [showRequest]);

  const confirm = useCallback((options = {}) => enqueue({ kind: 'confirm', ...options }), [enqueue]);
  const prompt = useCallback((options = {}) => enqueue({ kind: 'prompt', ...options }), [enqueue]);

  const handleCancel = useCallback(() => {
    if (loading || busyRef.current) return;
    settle(requestRef.current?.kind === 'prompt' ? null : false);
  }, [loading, settle]);

  const handleConfirm = useCallback(async () => {
    const current = requestRef.current;
    if (!current || loading || busyRef.current) return;

    if (current.kind === 'prompt') {
      if (current.required && !String(value).trim()) {
        setError(current.requiredMessage || 'This field is required.');
        return;
      }
      settle(value);
      return;
    }

    if (typeof current.onConfirm === 'function') {
      busyRef.current = true;
      setLoading(true);
      setError('');
      try {
        await current.onConfirm();
        settle(true);
      } catch {
        busyRef.current = false;
        setLoading(false);
      }
      return;
    }

    settle(true);
  }, [value, loading, settle]);

  const ctx = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const view = request ?? lastRequest;
  const isPrompt = view?.kind === 'prompt';
  const destructive = Boolean(view?.destructive);
  const title = view?.title ?? (isPrompt ? 'Enter a value' : 'Are you sure?');
  const confirmLabel = view?.confirmLabel ?? (isPrompt ? 'Submit' : 'Confirm');
  const cancelLabel = view?.cancelLabel ?? 'Cancel';
  const Icon = view?.icon ?? (destructive ? ExclamationTriangleIcon : QuestionMarkCircleIcon);
  const initialFocus = isPrompt ? inputRef : (destructive ? cancelRef : confirmRef);

  const inputProps = {
    label: view?.label,
    placeholder: view?.placeholder,
    value,
    error,
    onChange: (e) => { setValue(e.target.value); if (error) setError(''); },
  };

  return (
    <DialogContext.Provider value={ctx}>
      {children}
      <Modal
        open={Boolean(request)}
        onClose={handleCancel}
        title={title}
        size={view?.size ?? 'sm'}
        initialFocus={initialFocus}
      >
        {view && (
          <div className="space-y-4">
            {view.message && (
              <div className="flex items-start gap-3">
                {!isPrompt && (
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${destructive ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{view.message}</p>
              </div>
            )}

            {isPrompt && (
              view.multiline ? (
                <Textarea ref={inputRef} rows={view.rows || 4} {...inputProps} />
              ) : (
                <Input
                  ref={inputRef}
                  {...inputProps}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); } }}
                />
              )
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button ref={cancelRef} variant="secondary" onClick={handleCancel} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button ref={confirmRef} variant={destructive ? 'danger' : 'primary'} onClick={handleConfirm} loading={loading}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DialogContext.Provider>
  );
}

export default DialogProvider;
