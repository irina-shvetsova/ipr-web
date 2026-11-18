import { esc } from './render.js';

export const needsClarification = p => ['needs_clarification', 'needs_more_evidence'].includes(p?.build_status);
export const planComplete = p => !!p?.directions?.length && !(p.missing_directions || []).length && !['partial', 'materials_changed', 'needs_clarification', 'needs_more_evidence'].includes(p.build_status);

// Подсказки интерфейса, а не выдуманное объяснение рассуждений модели.
export function clarificationHint(question, answer = '') {
  if (/Какую ситуацию в работе/.test(question.text)) {
    return /зарабат|доход|зарплат|оплат/i.test(answer)
      ? 'Цель «больше зарабатывать» понятна. Уточни, какой путь рассматриваешь: повышение в своей роли, новая должность или смена работы? Какие требования к следующему уровню известны, а что ещё нужно выяснить? Можно написать, что пока выбираешь путь.'
      : 'Опиши желаемое изменение в работе: в какой задаче или роли, что происходит сейчас и какой результат нужен. Если пока не знаешь путь к цели, назови, что хочешь выяснить.';
  }
  if (/Что ты уже пробовал/.test(question.text)) return 'Если пока ничего не пробовал — это допустимый ответ. Добавь, с чего готов начать и какие есть ограничения: время, доступ к задачам, поддержка руководителя. Не нужно придумывать прошлые попытки.';
  return 'Если наблюдение не подходит, оставь несогласие. Можно пояснить, как ситуация выглядит с твоей стороны, или описать другую рабочую ситуацию, которую хочешь изменить. Подтверждать вывод отчёта ради плана не нужно.';
}

export function clarificationHTML(plan, answers = {}, busy = false) {
  const c = plan.clarifications;
  const retry = plan.build_status === 'needs_more_evidence';
  return `<div class="clarify"><div class="svc">Материалы разобраны</div><h2>${retry ? 'План пока не составлен' : 'Уточним перед составлением плана'}</h2>
    ${retry ? `<div class="clarify-feedback" role="status"><b>Ответы сохранены, но анализ не смог выбрать обоснованные направления развития.</b><p>Поэтому мы вернули форму для уточнения. Это не означает, что нужно согласиться с отчётом или придумать опыт, которого не было.</p><p><b>Что добавить:</b> связь твоей цели с работой — желаемую роль или задачу, текущую ситуацию и то, что нужно изменить или выяснить. Под каждым вопросом есть подсказка. Без дополнений повторная отправка может снова вернуть эту форму.</p></div>` : `<p>Ответь на ${c.questions.length} вопроса. Можно не согласиться с наблюдением или написать, что пока не знаешь. Примеры помогут выбрать подходящие действия.</p>${c.message ? `<p class="bdiag" role="status">${esc(c.message)}</p>` : ''}` }
    ${c.questions.map((q, i) => `<div class="clarify-question"><label for="clarify-${esc(q.id)}"><b>${i + 1}. ${esc(q.text)}</b></label><p class="later">${esc(q.why)}</p>${retry ? `<p class="clarify-hint" id="hint-${esc(q.id)}"><b>Как дополнить ответ:</b> ${esc(clarificationHint(q, answers[q.id]))}</p>` : ''}
      <textarea id="clarify-${esc(q.id)}" data-clarify-answer="${esc(q.id)}" maxlength="3000" rows="4" ${retry ? `aria-describedby="hint-${esc(q.id)}"` : ''} placeholder="Опиши ситуацию, свои действия и результат" ${busy ? 'disabled' : ''}>${esc(answers[q.id] || '')}</textarea></div>`).join('')}
    <p id="clarify-save-status" class="later" role="status">Ответы сохраняются автоматически.</p>
    <button class="btn" data-clarify-submit="1" ${busy ? 'disabled' : ''}>${busy ? 'Сохраняю ответы…' : retry ? 'Собрать план с уточнениями' : 'Собрать план по ответам'}</button>
    <button class="btn ghost" data-clarify-save="1" ${busy ? 'disabled' : ''}>Сохранить ответы</button></div>`;
}
