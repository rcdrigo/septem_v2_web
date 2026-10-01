import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'business-calendar-contracts-'));
try {
  await build({ entryPoints: ['src/lib/business-calendar.ts', 'src/lib/api/settings.ts'], bundle: true, alias: { '@': './src' }, platform: 'node', format: 'esm', outdir: dir, outExtension: { '.js': '.mjs' }, define: { 'import.meta.env': '{}' } });
  const { businessHoursFromSettings, validateCalendarLocation } = await import(pathToFileURL(join(dir, 'business-calendar.mjs')));
  const { settingsFieldPolicy, sanitizeSettingsPayload } = await import(pathToFileURL(join(dir, 'api/settings.mjs')));
  const week = businessHoursFromSettings({ businessHourStart: 8, businessHourEnd: 24, businessDays: '1, 3,6' });
  assert.deepEqual(week[1], [{ start: '08:00', end: '24:00' }]);
  assert.deepEqual(week[2], []);
  assert.deepEqual(week[6], [{ start: '08:00', end: '24:00' }]);
  assert.deepEqual(week[7], []);
  const custom = structuredClone(week);
  custom[1] = [{ start: '08:15', end: '12:00' }, { start: '14:00', end: '18:30' }];
  assert.deepEqual(businessHoursFromSettings({ businessHours: JSON.parse(JSON.stringify(custom)), businessHourStart: 0, businessHourEnd: 1, businessDays: '7' }), custom, 'Stored per-day minutes override every legacy field');
  for (const legacy of ['businessHourStart', 'businessHourEnd', 'businessDays']) {
    const policies = { [`GENERAL.${legacy.toUpperCase()}`]: { visible: true, editable: false } };
    assert.equal(settingsFieldPolicy(policies, 'general', 'businessHours').editable, false);
    assert.deepEqual(sanitizeSettingsPayload('general', { businessHours: custom, clienteNome: 'Cliente' }, policies), { clienteNome: 'Cliente' }, 'Restricted legacy field cannot be bypassed through new week');
  }
  assert.deepEqual(sanitizeSettingsPayload('general', { clienteNome: 'Cliente' }), { clienteNome: 'Cliente' }, 'Partial saves do not synthesize a calendar');
  assert.deepEqual(sanitizeSettingsPayload('general', { businessHours: custom }), { businessHours: custom });
  assert.equal(settingsFieldPolicy({ general: { visible: false, editable: true } }, 'general', 'businessHours').visible, false);
  assert.equal(settingsFieldPolicy({ 'general.businessHours': { visible: true, editable: false } }, 'general', 'businessHours').editable, false);
  assert.ok(validateCalendarLocation({ stateCode: 'PE', timeZoneId: 'America/Recife' }));
  assert.ok(validateCalendarLocation({ stateCode: 'PE', cityCode: '2607901', cityName: 'Jaboatão dos Guararapes', timeZoneId: 'Invalid/Zone' }));
  assert.equal(validateCalendarLocation({ stateCode: 'PE', cityCode: '2607901', cityName: 'Jaboatão dos Guararapes', timeZoneId: 'America/Recife' }), null);
  console.log('PASS: calendar legacy migration, minute roundtrip, policy compatibility, partial payload and location validation.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
