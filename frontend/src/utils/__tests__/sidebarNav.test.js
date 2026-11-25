import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSidebarNav } from '../../components/layouts/sidebarNav.js';

const t = (key) => key;
const userId = 'user-123';

const flatNav = (nav) => nav.flatMap((item) => (item.section ? item.section : [item]));
const firstOf = (nav) => nav[0];
const findByTo = (nav, to) => flatNav(nav).find((item) => item.to === to);
const unreadItems = (nav) => flatNav(nav).filter((item) => item.showUnreadBadge);

test('sidebar nav starts with the dashboard item for every role', () => {
  assert.equal(firstOf(buildSidebarNav({ role: 'client', t, userId })).to, '/client/dashboard');
  assert.equal(firstOf(buildSidebarNav({ role: 'freelancer', t, userId })).to, '/freelancer/dashboard');
  assert.equal(firstOf(buildSidebarNav({ role: 'admin', t, userId })).to, '/admin/dashboard');
});

test('client sidebar keeps Analytics, Profile, Settings and Help & Support reachable', () => {
  const nav = buildSidebarNav({ role: 'client', t, userId });
  assert.ok(findByTo(nav, '/client/analytics'));
  assert.ok(findByTo(nav, `/profile/${userId}`));
  assert.ok(findByTo(nav, '/client/settings'));
  assert.ok(findByTo(nav, '/support'));
});

test('freelancer sidebar keeps Profile, Settings and Help & Support reachable', () => {
  const nav = buildSidebarNav({ role: 'freelancer', t, userId });
  assert.ok(findByTo(nav, '/freelancer/profile'));
  assert.ok(findByTo(nav, `/profile/${userId}`));
  assert.ok(findByTo(nav, '/freelancer/settings'));
  assert.ok(findByTo(nav, '/support'));
});

test('admin sidebar keeps Analytics, Settings and Help & Support reachable', () => {
  const nav = buildSidebarNav({ role: 'admin', t, userId });
  assert.ok(findByTo(nav, '/admin/services/analytics'));
  assert.ok(findByTo(nav, '/admin/settings'));
  assert.ok(findByTo(nav, '/admin/support'));
});

test('every role exposes exactly one navigation item with an unread badge', () => {
  ['client', 'freelancer', 'admin'].forEach((role) => {
    const items = unreadItems(buildSidebarNav({ role, t, userId }));
    assert.equal(items.length, 1, `${role} should have exactly one unread-badge item`);
    assert.equal(items[0].to, '/notifications');
  });
});

test('sidebar nav items have unique "to" keys per role', () => {
  ['client', 'freelancer', 'admin'].forEach((role) => {
    const nav = buildSidebarNav({ role, t, userId });
    const flat = flatNav(nav);
    assert.equal(new Set(flat.map((item) => item.to)).size, flat.length, `${role} has duplicate "to" keys`);
  });
});

test('admin finance group keeps its item ordering', () => {
  const nav = buildSidebarNav({ role: 'admin', t, userId });
  const finance = nav.find((group) => group.label === 'sidebar.finance');
  assert.ok(finance, 'admin finance group should exist');
  const order = finance.section.map((item) => item.to);
  assert.equal(order[0], '/admin/finance');
  assert.ok(order.indexOf('/admin/finance/transactions') < order.indexOf('/admin/finance/deposits'));
});

test('unknown or missing role falls back to the client nav', () => {
  const fallback = buildSidebarNav({ t, userId });
  assert.equal(firstOf(fallback).to, '/client/dashboard');
  assert.equal(firstOf(buildSidebarNav({ role: 'other', t, userId })).to, '/client/dashboard');
  assert.equal(firstOf(buildSidebarNav()).to, '/client/dashboard');
});