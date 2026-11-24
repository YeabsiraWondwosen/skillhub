import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AuditLog from '../../models/AuditLog.model.js';

// The single source of truth for allowed audit categories.
const validCategories = new Set(AuditLog.schema.path('category').enumValues);

const readSource = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const settingsControllers = [
  '../../controllers/admin.controller.js',
  '../../controllers/adminFinance.controller.js',
];

test('every audit category used by the settings controllers is a valid enum value', () => {
  for (const relative of settingsControllers) {
    const source = readSource(relative);
    const matches = [...source.matchAll(/category:\s*'([a-z_]+)'/g)];
    assert.ok(matches.length > 0, `${relative} should create audit logs`);
    for (const match of matches) {
      assert.ok(
        validCategories.has(match[1]),
        `${relative} logs to invalid audit category '${match[1]}'`
      );
    }
  }
});

test('platform + commission settings audit events map to existing categories', () => {
  const source = readSource('../../controllers/admin.controller.js');
  const actionToCategory = {};
  for (const match of source.matchAll(/action:\s*'([a-z_]+)'\s*,\s*category:\s*'([a-z_]+)'/g)) {
    actionToCategory[match[1]] = match[2];
  }

  assert.equal(actionToCategory.platform_settings_updated, 'admin');
  assert.equal(actionToCategory.platform_logo_updated, 'admin');
  assert.equal(actionToCategory.commission_settings_updated, 'commission');

  // The finance controller already logged commission settings under 'commission',
  // so the two handlers must agree.
  const financeSource = readSource('../../controllers/adminFinance.controller.js');
  assert.match(
    financeSource,
    /action:\s*'commission_settings_updated'\s*,\s*category:\s*'commission'/
  );
});
