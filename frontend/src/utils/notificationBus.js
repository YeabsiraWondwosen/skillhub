// Tiny module-level pub/sub used to fan out real-time notifications to the UI.
//
// A Set guarantees the same listener function reference is registered at most
// once, so re-running an effect (including React StrictMode's double invoke)
// cannot register duplicate subscriptions. `subscribe` always returns an
// idempotent cleanup so callers can safely unsubscribe on unmount.

const listeners = new Set();

export const subscribe = (listener) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emit = (notification) => {
  // Snapshot so a listener that unsubscribes during dispatch cannot disturb it.
  [...listeners].forEach((listener) => {
    try {
      listener(notification);
    } catch {
      // A single faulty listener must never break delivery to the others.
    }
  });
};

export const listenerCount = () => listeners.size;

export const clear = () => listeners.clear();
