import assert from 'node:assert/strict';
import test from 'node:test';
import { routeLaboQuestion } from '../../frontend/src/features/labo/laboIntent.js';

const phase7Question = "i'll uplode the xls file can you access whole file tabs and add all transistion in my accounts?";

test('The Phase 7 XLS upload question gets import guidance before the action matcher is called', () => {
  const route = routeLaboQuestion(phase7Question, () => assert.fail('Import guidance must bypass the action matcher'));
  assert.match(route.guidance, /save the old \.xls file as \.xlsx/i);
  assert.match(route.guidance, /attach statement.*review the rows.*confirm/i);
  assert.equal(route.action, undefined);
  for (const question of ['Can I attach my .xlsx file and add those transactions?', 'Upload my bank statement and create transactions']) {
    const result = routeLaboQuestion(question, () => assert.fail('Statement uploads must bypass actions'));
    assert.match(result.guidance, /attach statement.*review the rows/i);
    assert.doesNotMatch(result.guidance, /save the old/i);
  }
});

test('Record actions still reach the action route', () => {
  for (const question of ['delete my last record', 'Create a savings goal for travel', 'Edit my lunch transaction']) {
    assert.deepEqual(routeLaboQuestion(question), { action: true });
  }
  assert.deepEqual(routeLaboQuestion('Export my transactions in Excel'), { action: false });
});
