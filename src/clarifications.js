import { esc } from './render.js';

export const needsClarification = p => ['needs_clarification', 'needs_more_evidence'].includes(p?.build_status);
export const planComplete = p => !!p?.directions?.length && !(p.missing_directions || []).length && !['partial', 'materials_changed', 'needs_clarification', 'needs_more_evidence'].includes(p.build_status);

export function clarificationHTML(plan, answers = {}, busy = false) {
  const c = plan.clarifications;
  return `<div class="clarify"><div class="svc">Материалы разобраны</div><h2>Уточним перед составлением плана</h2>
    <p>Ответь на ${c.questions.length} вопроса. Можно не согласиться с наблюдением или написать, что пока не знаешь. Примеры помогут выбрать подходящие действия.</p>
    ${c.message ? `<p class="bdiag" role="status">${esc(c.message)}</p>` : ''}
    ${c.questions.map((q, i) => `<div class="clarify-question"><label for="clarify-${esc(q.id)}"><b>${i + 1}. ${esc(q.text)}</b></label><p class="later">${esc(q.why)}</p>
      <textarea id="clarify-${esc(q.id)}" data-clarify-answer="${esc(q.id)}" maxlength="3000" rows="4" placeholder="Опиши ситуацию, свои действия и результат" ${busy ? 'disabled' : ''}>${esc(answers[q.id] || '')}</textarea></div>`).join('')}
    <p id="clarify-save-status" class="later" role="status">Ответы сохраняются автоматически.</p>
    <button class="btn" data-clarify-submit="1" ${busy ? 'disabled' : ''}>${busy ? 'Сохраняю ответы…' : 'Собрать план по ответам'}</button>
    <button class="btn ghost" data-clarify-save="1" ${busy ? 'disabled' : ''}>Сохранить ответы</button></div>`;
}
