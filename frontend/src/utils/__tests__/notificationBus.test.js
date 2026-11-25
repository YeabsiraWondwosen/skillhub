import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribe, emit, listenerCount, clear } from '../notificationBus.js';

test.beforeEach(() => clear());
test.afterEach(() => clear());

test('subscribing the same listener twice only registers it once', () => {
  let calls = 0;
  const listener = () => { calls += 1; };

  subscribe(listener);
  subscribe(listener);

  assert.equal(listenerCount(), 1);
  emit({ _id: 'n1' });
  assert.equal(calls, 1);
});

test('unsubscribe removes the listener and is idempotent', () => {
  let calls = 0;
  const listener = () => { calls += 1; };

  const unsubscribe = subscribe(listener);
  emit({ _id: 'n1' });
  unsubscribe();
  unsubscribe();
  emit({ _id: 'n2' });

  assert.equal(calls, 1);
  assert.equal(listenerCount(), 0);
});

test('all distinct listeners receive the notification exactly once', () => {
  const seen = [];
  const a = (n) => seen.push(['a', n._id]);
  const b = (n) => seen.push(['b', n._id]);

  subscribe(a);
  subscribe(b);
  emit({ _id: 'n1' });

  assert.deepEqual(seen, [['a', 'n1'], ['b', 'n1']]);
});

test('a throwing listener does not block other listeners', () => {
  let reached = false;
  const boom = () => { throw new Error('listener failure'); };
  const ok = () => { reached = true; };

  subscribe(boom);
  subscribe(ok);
  emit({ _id: 'n1' });

  assert.equal(reached, true);
});

test('subscribe ignores non-function listeners', () => {
  const cleanup = subscribe(null);
  assert.equal(typeof cleanup, 'function');
  assert.equal(listenerCount(), 0);
});
