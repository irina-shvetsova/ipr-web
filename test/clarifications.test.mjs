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

test('insufficient evidence shows outcome and actionable hints for salary goal and disagreement', () => {
  const plan = { build_status: 'needs_more_evidence', clarifications: { message: 'Старая общая подсказка', questions: [
    {id:'q1',text:'Узнаёшь ли ты наблюдение?',why:'Контекст'},
    {id:'q2',text:'Какую ситуацию в работе ты хочешь изменить?',why:'Цель'},
    {id:'q3',text:'Что ты уже пробовал в этой ситуации?',why:'Опыт'}
  ] } };
  const answers = {q1:'не узнаю',q2:'хочу больше зарабатывать',q3:'ничего не пробовал'};
  const html = clarificationHTML(plan, answers);
  assert.match(html, /План пока не составлен/);
  assert.match(html, /Ответы сохранены/);
  assert.match(html, /повышение в своей роли/);
  assert.match(html, /Подтверждать вывод отчёта ради плана не нужно/);
  assert.match(html, /Не нужно придумывать прошлые попытки/);
  assert.match(html, /Собрать план с уточнениями/);
  assert.ok(!html.includes('Старая общая подсказка'));
  for (const answer of Object.values(answers)) assert.ok(html.includes(answer));
  const initial = clarificationHTML({...plan,build_status:'needs_clarification'}, answers);
  assert.ok(!initial.includes('План пока не составлен'));
});
