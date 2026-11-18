import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clarificationHTML, needsClarification, planComplete } from '../src/clarifications.js';

test('waiting and incomplete plans never count as complete', () => {
  for (const build_status of ['needs_clarification', 'needs_more_evidence', 'partial', 'materials_changed']) assert.equal(planComplete({ build_status, directions: [{}] }), false);
  assert.equal(planComplete({ build_status: 'ready', directions: [] }), false);
  assert.equal(planComplete({ directions: [{}], missing_directions: ['h2'] }), false);
  assert.equal(planComplete({ build_status: 'ready', directions: [{}] }), true);
  assert.equal(needsClarification({ build_status: 'needs_more_evidence' }), true);
});

test('questions and saved answers render as escaped text', () => {
  const html = clarificationHTML({ clarifications: { questions: [{ id: 'q1', text: '<script>bad</script>', why: 'Контекст' }], message: '<img>' } }, { q1: '</textarea><script>bad</script>' }, true);
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;/textarea&gt;'));
  assert.ok(html.includes('disabled')); assert.ok(html.includes('maxlength="3000"'));
});
