import assert from 'node:assert/strict';
import test from 'node:test';
import { requestedImportGuidance } from '../src/services/nidhiTools.js';

const phase7Question = "i'll uplode the xls file can you access whole file tabs and add all transistion in my accounts?";

test('The Phase 7 XLS upload question gets import guidance before the action matcher is called', () => {
  const guidance = requestedImportGuidance(phase7Question);
  assert.match(guidance, /save the old \.xls file as \.xlsx/i);
  assert.match(guidance, /attach statement.*review the rows.*confirm/i);
  for (const question of ['Can I attach my .xlsx file and add those transactions?', 'Upload my bank statement and create transactions']) {
    const result = requestedImportGuidance(question);
    assert.match(result, /attach statement.*review the rows/i);
    assert.doesNotMatch(result, /save the old/i);
  }
});

test('The legacy workbook rule leaves record actions and exports for chat', () => {
  for (const question of ['delete my last record', 'Create a savings goal for travel', 'Edit my lunch transaction']) {
    assert.equal(requestedImportGuidance(question), null);
  }
  assert.equal(requestedImportGuidance('Export my transactions in Excel'), null);
});
