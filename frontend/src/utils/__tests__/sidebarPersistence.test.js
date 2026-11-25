import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSidebarNav } from '../../components/layouts/sidebarNav.js';

const t = (key) => key;
const userId = 'user-123';
const flatNav = (nav) => nav.flatMap((item) => (item.section ? item.section : [item]));

const readSource = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

// Pages an admin sidebar may link to that intentionally live in the shared
// protected shell instead of under /admin.
const ADMIN_SHARED_ROUTES = new Set(['/notifications']);

test('admin sidebar targets never leave the single dashboard shell', () => {
  const nav = buildSidebarNav({ role: 'admin', t, userId });
  for (const item of flatNav(nav)) {
    const staysInShell = item.to.startsWith('/admin') || ADMIN_SHARED_ROUTES.has(item.to);
    assert.ok(staysInShell, `admin nav "${item.to}" would switch layout and remount the sidebar`);
  }
});

test('app declares exactly one DashboardLayout shell shared by all roles', () => {
  const app = readSource('../../App.jsx');
  const shells = app.match(/<Route element=\{<DashboardLayout \/>\}>/g) || [];
  assert.equal(shells.length, 1, 'protected pages must share one DashboardLayout instance');
  assert.ok(app.includes('path="/notifications"'), 'notifications must be registered in the shared shell');
  assert.ok(app.includes('path="/admin/settings"'), 'admin settings must be registered in the shared shell');
});

test('AdminLayout does not mount a second DashboardLayout shell', () => {
  const source = readSource('../../components/layouts/AdminLayout.jsx');
  assert.ok(!/import\s+DashboardLayout/.test(source), 'AdminLayout must not re-create the dashboard shell');
  assert.ok(source.includes('<Outlet />'), 'AdminLayout should stay a transparent route-group marker');
});
