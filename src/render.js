// Рендер плана из PlanState. Только отображение: всё, что считается, приходит из шлюза.

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const low = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
export const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
export const listRu = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1]);
export function plural(n, a, b, c) { const m = n % 10, h = n % 100; if (m === 1 && h !== 11) return a; if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return b; return c; }

export const TYPE_LABEL = { '360': 'Отчёт 360', ipr: 'Прошлый ИПР', notes: 'Заметки', delta: 'Delta', job: 'Описание должности', competency_model: 'Модель компетенций', self_assessment: 'Самооценка', other: 'Документ' };
export const HTYPE = { agree: 'одно и то же в разных источниках', self: 'как видишь себя и как видят другие', say: 'что заявлено и что в задачах', time: 'что важно на словах и куда уходит время', ctx: 'поведение в разных контекстах', plan: 'что планировали и что вышло' };
export const TIME = [
  { id: '1', t: 'До 1 часа', d: 'Хватит на одно направление' },
  { id: '3', t: '2–3 часа', d: 'Хватит на два' },
  { id: '5', t: 'От 4 часов', d: 'Хватит на три' },
  { id: '0', t: 'Сейчас не до этого', d: 'Один маленький шаг' },
];
export const GOALS = [
  { id: 'role', t: 'Расти в своей роли', d: 'Делать текущую работу лучше и спокойнее.' },
  { id: 'own', t: 'Есть конкретная цель', d: 'Например, новая должность или экспертиза.' },
  { id: 'compare', t: 'Выбираю из нескольких вариантов', d: 'Добавим шаг, чтобы попробовать их на практике.' },
  { id: 'search', t: 'Пока не знаю', d: 'Добавим шаг, чтобы понять, куда расти. План от этого не хуже.' },
];
export const PREV_ST = [
  { id: 'done', t: 'Получилось' }, { id: 'partial', t: 'Частично' }, { id: 'not_done', t: 'Не дошли руки' }, { id: 'stale', t: 'Стало неактуально' },
];
export const REASONS = ['Не узнаю себя', 'Так было раньше', 'Причина другая'];
const QUARTERS = ['1 квартал', '2 квартал', '3 квартал', '4 квартал'];
const EXPL = {
  compare: { title: 'Выбрать, куда расти', why: 'Ты выбираешь из нескольких вариантов роста. Этот шаг помогает сравнить их на практике.', goal: 'К концу квартала понятно, какой вариант ближе.', work: ['Выбрать два варианта и поговорить с человеком, который уже так работает.', 'Взять пробную задачу по одному из вариантов и обсудить результат с руководителем.'] },
  search: { title: 'Найти, куда расти', why: 'Куда расти, пока не решено. План от этого не хуже: он опирается на задачи квартала, а этот шаг помогает найти ориентир.', goal: 'К концу квартала есть 2–3 варианта роста, которые хочется проверить.', work: ['Два разговора по 30 минут с людьми на других ролях в компании.', 'Записать, что откликнулось, и обсудить с руководителем.'] },
};

const docOf = id => String(id).split('.')[0];
export const hyp = (s, id) => s.hypotheses.find(h => h.id === id);
export const dir = (s, id) => s.directions.find(d => d.hypothesis_id === id);
const fl = (flash, key, cls = '') => (flash?.[key] ? `${cls} flash`.trim() : cls);

export function goalShort(g) {
  if (!g) return 'Расти в своей роли';
  if (g.type === 'own') return g.hidden && !g.text ? 'Своя цель (скрыта)' : (g.text || 'Своя цель, не записана');
  return GOALS.find(x => x.id === g.type)?.t || 'Расти в своей роли';
}

function srcLabel(s, factId) {
  const m = s.materials.find(x => x.id === docOf(factId));
  const f = s.facts.find(x => x.id === factId);
  const label = m ? TYPE_LABEL[m.type] || 'Документ' : 'Документ';
  const cls = f?.kind === 'self_note' || (m && ['notes', 'self_assessment'].includes(m.type)) ? 'self' : (m?.type === '360' ? '' : 'doc');
  return { label, cls };
}

function zoneNumbers(s) {
  const order = [];
  const roots = s.hypotheses.filter(h => !h.symptom_of || !s.hypotheses.some(x => x.id === h.symptom_of));
  for (const r of roots) { order.push(r.id); s.hypotheses.filter(h => h.symptom_of === r.id).forEach(h => order.push(h.id)); }
  s.hypotheses.forEach(h => { if (!order.includes(h.id)) order.push(h.id); });
  const ref = {};
  order.forEach((id, i) => { ref[id] = `2.${i + 1}`; });
  return { order, ref };
}

/** Сильные стороны: с шлюза приходят готовыми (s.strengths), в демо-снимках берём из связей */
export const strengthsOf = s => s.strengths || (s.links || []).filter(l => l.polarity === 'strength').map(l => ({ id: l.id, topic: l.topic, summary: l.summary, level: 'peers' }));
const SELF_NOTE = 'По твоим словам и документам, оценкой коллег пока не подтверждено.';

// ---------------------------------------------------------------- «Главное»

function mainHTML(s, o) {
  const mid = s.selected[0];
  const d = dir(s, mid);
  const h = hyp(s, mid);
  if (!d || !h) return '';
  const { ref } = zoneNumbers(s);
  const rk = (s.ranking || []).find(r => r.hypothesis_id === mid);
  const why = rk?.reasons?.length ? cap(rk.reasons.join('; ')) + '.' : 'Выбрано по задачам квартала и твоим ответам.';
  const notNow = (s.ranking || []).filter(r => !s.selected.includes(r.hypothesis_id)).slice(0, 3)
    .map(r => `<li><b>${esc(hyp(s, r.hypothesis_id)?.topic)}:</b> ${esc((s.deferred || []).includes(r.hypothesis_id) ? 'перенесено на следующий квартал.' : 'в этот квартал не помещается, вернёмся при пересборке.')}</li>`).join('');
  const strengths = strengthsOf(s);
  const selfS = strengths.filter(x => x.level === 'self');
  const strengthText = d.strength_basis
    || (selfS.length ? `Опирайся на то, что уже получается: ${listRu(selfS.map(x => low(x.topic)))}. ${SELF_NOTE}`
      : o.manager ? 'Сильные стороны в плане пока не указаны.'
        : s.ask_strengths ? 'Ответь на вопрос «Что у тебя получается лучше всего?» слева: на это будет опираться план.'
          : 'Сильные стороны появятся, когда в материалах будет оценка окружения.');
  let x = `<div class="${fl(o.flash, 'main', 'mainbox')}" id="main"><div class="kick2">Главное в плане<span>С чего начать в этом квартале и почему</span></div>`;
  x += `<div class="mb-t">${esc(d.title)}</div>`;
  x += `<p class="mb-why"><b>Почему с этого.</b> ${esc(why)} Объяснение и опоры в пункте ${ref[mid]}.</p>`;
  if (s.answers.time === '0') x += '<p class="light-note">Сейчас не до развития, и план это учитывает: в этом квартале один шаг в спокойном темпе.</p>';
  x += `<div class="quad"><div><div class="qh2">Что это даст в задачах квартала</div>${esc(d.goal)}</div>`
    + `<div><div class="qh2">Как: через сильную сторону</div>${esc(strengthText)}</div>`
    + `<div><div class="qh2">Что пока не трогать</div><ul class="notnow">${notNow}${strengths.length ? `<li><b>Сильные стороны:</b> ${esc(listRu(strengths.map(l => low(l.topic))))}. Развивать отдельно не нужно, на них опираемся.</li>` : ''}</ul></div>`
    + `<div><div class="qh2">Если ничего не менять</div>${esc(d.cost_if_nothing)}</div></div>`;
  return x + '</div>';
}

// ---------------------------------------------------------------- раздел 2

function whyBlock(s, h, o) {
  const draft = o.mode === 'draft';
  if (h.rejected) {
    if (!draft) return '';
    return `<div class="why-blk rej"><div class="wt">Почему так может быть · отклонено</div><div class="hf">${esc(h.statement)}</div><div class="hfoot">`
      + `<span style="font-size:13px;color:var(--muted)">${h.reject_reason ? `Причина: ${esc(low(h.reject_reason))}. План перестроен без этого объяснения.` : 'Почему не про тебя? Это поможет плану.'}</span>`
      + (!h.reject_reason ? `<div class="reasons">${REASONS.map(r => `<button class="chip" data-reason="${h.id}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : '')
      + `<label class="check"><input type="checkbox" data-rejmeet="${h.id}"${h.discuss_at_meeting ? ' checked' : ''}><span>Обсудить с руководителем<small>Добавим вопрос в раздел 6. Без отметки руководитель этот отказ не увидит.</small></span></label>`
      + `<button class="link" data-unrej="${h.id}">Вернуть</button></div></div>`;
  }
  const sup = h.supports.map(p => { const l = srcLabel(s, p.fact_id); return `<li><span class="src ${l.cls}">${esc(l.label)}</span>${esc(p.text)}</li>`; }).join('');
  let x = `<div class="why-blk"><div class="wt">Почему так может быть · ${esc(HTYPE[h.type] || '')}</div><div class="hf">${esc(h.statement)}</div>`
    + `<div class="hrow det"><b>Опоры</b><ul class="sup">${sup}${h.supports_hidden ? `<li class="later">Ещё ${h.supports_hidden} из личных заметок сотрудника скрыты.</li>` : ''}</ul></div>`
    + `<div class="hrow det"><b>Другое объяснение</b><span>${esc(h.alternative)}</span></div>`
    + `<div class="hrow det"><b>Как проверить</b><span><span class="chk2">${esc(h.check?.kind)}.</span> ${esc(h.check?.text)}</span></div>`;
  if (draft) x += `<div class="hfoot"><button class="notme" data-notme="${h.id}">Не про меня</button><span style="font-size:12.5px;color:var(--muted)">План перестроится</span></div>`;
  return x + '</div>';
}

function zonesHTML(s, o) {
  const { order, ref } = zoneNumbers(s);
  const draft = o.mode === 'draft';
  let x = `<p>Здесь то, что показали данные, и предположения, почему так. Каждое предположение описывает поведение в работе, опирается минимум на два документа и имеет другое объяснение.${draft ? ' Если что-то не про тебя, отметь, и план перестроится.' : ''} Действия собраны в разделе 3.</p>`;
  for (const id of order) {
    const h = hyp(s, id);
    if (h.rejected && !draft) continue;
    const inPlan = s.selected.includes(id) || (h.symptom_of && s.selected.includes(h.symptom_of));
    x += `<div class="zhead" id="z_${id}"><div><span class="zn">${ref[id]}</span><h3>${esc(h.topic)}${inPlan ? '' : '<span class="out">Не в плане</span>'}</h3></div></div>`;
    if (h.symptom_of && hyp(s, h.symptom_of)) x += `<p class="zone-note">Похоже на следствие пункта ${ref[h.symptom_of]}: направление по нему должно помочь и здесь.</p>`;
    x += whyBlock(s, h, o);
  }
  if (!draft && !o.manager) {
    const rc = s.hypotheses.filter(h => h.rejected).length;
    if (rc) x += `<p class="later" style="font-size:13.5px">${rc === 1 ? 'Одно объяснение' : rc + ' объяснения'} отмечено как «не про меня». План собран без них.</p>`;
  }
  if (s.guesses?.length) x += '<h4>Наблюдения без второй опоры</h4>' + s.guesses.map(g => `<div class="guess">${esc(g.text)} <span class="later">${esc(g.missing)}</span></div>`).join('') + '<p class="later" style="font-size:13px">Это догадки. В план они не входят.</p>';
  return x;
}

// ---------------------------------------------------------------- раздел 3

function stepLi(s, d, st, k, o) {
  const draft = o.mode === 'draft';
  const key = `${d.hypothesis_id}:${k}`;
  let li = `<li><span class="when2">${esc(st.when)}</span>${esc(st.text)}${st.origin === 'own' ? ' <span class="owntag">своё</span>' : ''}`;
  if (draft) {
    li += `<span class="wact"><button class="wbtn" data-wmove="${key}" aria-expanded="${o.wmOpen === key}">Перенести</button><button class="wbtn" data-wrm="${key}">Убрать</button></span>`;
    if (o.wmOpen === key) li += `<span class="wmonths" role="group" aria-label="Новый срок">${[...s.quarter.months, 'Каждую неделю'].map(m => `<button class="chip${m === st.when ? ' on' : ''}" data-wto="${key}|${esc(m)}">${esc(m)}</button>`).join('')}<button class="link" data-wmclose="1">Отмена</button></span>`;
  }
  if (k === 0 && d.first_month?.length) li += `<details class="wk det"><summary>По неделям</summary><ol>${d.first_month.map(q => `<li>${esc(q)}</li>`).join('')}</ol></details>`;
  return li + '</li>';
}

function directionsHTML(s, o) {
  const { ref } = zoneNumbers(s);
  const draft = o.mode === 'draft';
  const P = s.selected.filter(id => dir(s, id));
  let x = `<p>${P.length === 1 ? 'Одно направление' : P.length === 2 ? 'Два направления' : 'Три направления'} на год, шаги расписаны на ближайший квартал. Больше трёх навыков за квартал не берём.</p>`;
  P.forEach((id, i) => {
    const d = dir(s, id);
    const steps = d.steps.map((st, k) => ({ st, k })).filter(({ st }) => !st.removed);
    const removed = d.steps.length - steps.length;
    x += `<div class="${fl(o.flash, 'dir_' + id)}" id="dir_${id}"><div class="dirhead"><h3>3.${i + 1} ${esc(d.title)}</h3>${i === 0 && P.length > 1 ? '<span class="dirtag">Главное</span>' : ''}</div>`;
    x += '<table class="kv">'
      + `<tr><th>Навык</th><td>${esc(d.skill_label)}</td></tr>`
      + `<tr><th>Основание</th><td>${esc(String(d.basis).replace(/\.$/, ''))} (см. ${ref[id]}).</td></tr>`
      + (d.strength_basis ? `<tr><th>Опора на сильное</th><td>${esc(d.strength_basis)}</td></tr>` : '')
      + (d.other_approach ? `<tr><th>Другой подход</th><td>${esc(d.other_approach)}</td></tr>` : '')
      + `<tr><th>Цель развития</th><td>${esc(d.goal)}</td></tr>`
      + `<tr class="det"><th>Ключевой сдвиг</th><td>${esc(d.shift)}</td></tr>`
      + `<tr><th>На рабочем месте</th><td><ul class="wsteps">${steps.map(({ st, k }) => stepLi(s, d, st, k, o)).join('')}</ul>`
      + (draft && removed ? `<p class="rmline">Убрано шагов: ${removed}. Вернуть можно через историю версий.</p>` : '')
      + (draft ? `<div class="addtask own"><input type="text" data-ownin="${id}" aria-label="Своё действие" placeholder="Своё действие, например: обсудить формат отчёта в декабре"><button class="btn ghost sm" data-ownadd="${id}">Добавить</button></div>` : '')
      + '</td></tr>'
      + `<tr class="det"><th>Выход из зоны комфорта</th><td>${esc(d.comfort)}</td></tr>`
      + `<tr><th>Критерии достижения</th><td><ul>${d.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul></td></tr>`
      + `<tr><th>Риски и поддержка</th><td class="rk"><p><b>Риск:</b> ${esc(d.risk)}</p><p><b>Управление:</b> ${esc(d.control)}</p><p><b>Поддержка:</b> ${esc(d.if_rollback)}</p></td></tr>`
      + '</table>';
    if (draft) {
      x += `<p class="det"><button class="ask-t" data-askdir="${id}">Попросить тьютора поправить это направление</button>`
        + (P.length > 1 ? ` <button class="link" data-defer="${id}">Перенести на следующий квартал</button>` : '') + '</p>';
    }
    x += '</div>';
  });
  const g = s.answers.goal?.type;
  if ((g === 'compare' || g === 'search') && s.answers.time !== '0') {
    const e = EXPL[g];
    x += `<div id="dir_ex"><div class="dirhead"><h3>3.${P.length + 1} ${esc(e.title)}</h3></div><table class="kv"><tr><th>Зачем</th><td>${esc(e.why)}</td></tr><tr><th>Цель</th><td>${esc(e.goal)}</td></tr><tr><th>На рабочем месте</th><td><ul>${e.work.map((t, i) => `<li><span class="when2">${esc(s.quarter.months[i + 1] || '')}</span>${esc(t)}</li>`).join('')}</ul></td></tr></table></div>`;
  }
  return x;
}

// ---------------------------------------------------------------- документ целиком

export function planHTML(s, o = {}) {
  const draft = o.mode === 'draft';
  const P = s.selected.filter(id => dir(s, id));
  const main = dir(s, P[0]);
  const g = s.answers.goal || {};
  const materials = s.materials || [];
  const readable = materials.filter(m => m.status !== 'unreadable');
  let x = `<div class="ipr${draft ? ' draft' : ''}${s.compact ? ' compact' : ''}">`;
  x += `<div class="kick"><span>Индивидуальный план развития</span><span${draft ? ' style="color:var(--lt)"' : ''}>${draft ? 'Черновик' : o.manager ? 'Версия для руководителя' : 'Конфиденциально'}</span></div><h1>${esc(s.profile.name || 'Сотрудник')}</h1>`;
  x += `<p class="sub">${esc(s.profile.role)} · период: год, шаги расписаны на ${esc(listRu(s.quarter.months.map(low)))}</p>`;
  x += `<p class="sub">Собран из: ${esc(listRu(readable.map(m => low(TYPE_LABEL[m.type] || 'документ'))) || 'рассказа о работе')}</p><div class="conf">Конфиденциальный документ</div>`;
  x += mainHTML(s, o);
  if (draft) x += '<div class="toc"><a href="#s1"><span>01</span>Контекст</a><a href="#s2"><span>02</span>Зоны роста</a><a href="#s3"><span>03</span>Направления</a><a href="#s4"><span>04</span>Обучение</a><a href="#s5"><span>05</span>Точки контроля</a><a href="#s6"><span>06</span>Согласование</a></div>';
  x += `<details class="about det"${draft ? '' : ' open'}><summary>О плане и как его читать</summary>`
    + '<p>Этот документ подготовлен искусственным интеллектом с опорой на экспертизу и базу знаний ЭКОПСИ. Относись к нему как к источнику идей: оставь то, что откликается, и доработай под себя. Последнее слово за тобой и твоим руководителем.</p>'
    + '<p>План принадлежит тебе: его задача поддержать твою работу, а не оценить тебя. Развитие идёт неровно, откаты нормальны.</p></details>';

  // 1. Контекст
  const strengths = strengthsOf(s);
  x += `<h2 id="s1"><span class="sn">01</span>Контекст развития</h2><div class="${fl(o.flash, 'ctx')}">`;
  x += `<p>${s.tasks.length ? `В этом квартале у тебя ${esc(listRu(s.tasks.map(t => low(t.title))))}. ` : ''}План строится вокруг того, что сейчас важнее всего для работы.</p>`;
  if (strengths.length) {
    const peers = strengths.filter(l => l.level !== 'self'), self = strengths.filter(l => l.level === 'self');
    const li = l => `<li><span class="sc">${esc(l.topic)}.</span> ${esc(l.summary)}</li>`;
    x += '<h4>Сильные стороны, на которые опирается план</h4>';
    if (peers.length) x += `${self.length ? '<p class="sh2">По оценкам коллег</p>' : ''}<ul>${peers.map(li).join('')}</ul>`;
    if (self.length) x += `<p class="sh2">${SELF_NOTE}</p><ul>${self.map(li).join('')}</ul>`;
  }
  const goalRow = g.type === 'own' && g.hidden
    ? (o.manager ? '' : `<tr><th>Твои ожидания</th><td>${esc(g.text || 'Цель не записана')} <span class="owntag">руководитель не увидит</span></td></tr>`)
    : `<tr><th>Твои ожидания</th><td>${esc(goalShort(g))}</td></tr>`;
  x += `<table class="kv">${goalRow}${s.manager_inputs?.expectations ? `<tr><th>Ожидания руководителя</th><td>${esc(s.manager_inputs.expectations)} <span class="owntag">вводные руководителя</span></td></tr>` : ''}`
    + `<tr><th>Навыки в плане</th><td>${esc(cap(listRu(P.map(id => low(dir(s, id).skill_label)))))}</td></tr>`
    + (main ? `<tr><th>Ключевой сдвиг</th><td>${esc(main.shift)}</td></tr>` : '') + '</table>';
  const prev = s.facts.filter(f => f.kind === 'prev_goal');
  if (prev.length) {
    x += `<h4>Прошлый план</h4>${s.answers.role_changed ? '<p class="later">Роль сменилась: прошлый план учтён как контекст, без итогов.</p>' : ''}<table class="kv">`
      + prev.map(f => { const st = s.answers.prev?.[f.id] || f.status; return `<tr><th>${esc(f.source_label || f.behavior)}</th><td>${esc(PREV_ST.find(p => p.id === st)?.t || 'Итог не отмечен')}</td></tr>`; }).join('') + '</table>';
  }
  x += '<div class="basis det"><b>На чём построен план</b><ul>' + materials.map(m => `<li>${esc(m.file_name || TYPE_LABEL[m.type])}: ${m.status === 'unreadable' ? `<span class="later">${esc(m.status_reason || 'не удалось прочитать')}</span>` : esc(`${low(TYPE_LABEL[m.type] || 'документ')}${m.period ? ', ' + m.period : ''}${m.scale ? ', шкала ' + m.scale : ''}`)}</li>`).join('') + '</ul></div></div>';

  // 2. Зоны роста
  x += `<h2 id="s2"><span class="sn">02</span>Зоны роста и почему так</h2><div class="${fl(o.flash, 'hyp')}">${zonesHTML(s, o)}</div>`;
  // 3. Направления
  x += `<h2 id="s3"><span class="sn">03</span>Направления развития</h2>${directionsHTML(s, o)}`;
  // 4. Обучение
  x += '<h2 id="s4"><span class="sn">04</span>Обучение и источники</h2>';
  const withBooks = P.map(id => dir(s, id)).filter(d => d.books?.length);
  if (withBooks.length) x += '<h4>Книги</h4>' + withBooks.map(d => `<p><b>${esc(d.skill_label)}</b></p><ul>${d.books.map(b => `<li>${esc(b.t)}. ${esc(b.d)}</li>`).join('')}</ul>`).join('');
  x += '<h4>Форматы внутреннего обучения</h4><ul><li>Регулярные разборы рабочих случаев с руководителем</li><li>Разговоры с коллегами, у которых этот навык сильный</li></ul><p class="later" style="font-size:13px">Какие программы есть в компании, тьютор не знает. Вопрос об этом в разделе 6.</p>';
  // 5. Точки контроля
  const refl = main?.reflection?.length ? main.reflection : ['Что изменилось в этом навыке за квартал?', 'Приведи пример, когда новый подход сработал.', 'Вспомни ситуацию, когда вернулась старая привычка. Что помогло?', 'Что будешь делать иначе в следующем году?'];
  x += '<h2 id="s5"><span class="sn">05</span>Точки контроля: вопросы для саморефлексии</h2><p class="later">Раз в квартал отвечай на эти вопросы. Они постепенно становятся конкретнее.</p><ul>'
    + refl.slice(0, 4).map((q, i) => `<li><b>${QUARTERS[i]}.</b> ${esc(q)}</li>`).join('') + '</ul>';
  // 6. Согласование
  const Q = s.meeting_questions || [];
  x += '<h2 id="s6"><span class="sn">06</span>Согласование</h2><p>План предстоит обсудить с руководителем. После согласования он станет рабочим документом на год.</p>';
  x += `<div class="${fl(o.flash, 'meet', 'meetbox')}"><h4>Что обсудить на встрече</h4><ol>${Q.map(q => `<li>${esc(q.text)}<small>${esc(q.why)}</small></li>`).join('')}</ol></div>`;
  x += '<div class="sign"><div>Сотрудник / подпись, дата:</div><div>Руководитель / подпись, дата:</div><div>HR-партнёр / подпись, дата:</div></div></div>';
  return x;
}

/** Документ для скачивания: Word открывает HTML с расширением .doc */
export function exportHTML(s, o = {}) {
  const css = 'body{font-family:Arial,sans-serif;font-size:11pt;color:#111;max-width:760px;margin:24px auto;line-height:1.45}h1{font-size:20pt}h2{font-size:14pt;margin-top:22px;border-bottom:1px solid #999}h3{font-size:12pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}th{width:28%;background:#f3f3f3}.kick,.toc,.hfoot,.wact,.wmonths,.addtask,.ask-t,.conf,button{display:none}.src{font-size:9pt;background:#eee;padding:0 4px;margin-right:6px}small{display:block;color:#555}.later{color:#555}';
  const body = planHTML(s, { ...o, mode: 'final' }).replace(/<details[^>]*>/g, '<div>').replace(/<\/details>/g, '</div>').replace(/<summary>/g, '<p><b>').replace(/<\/summary>/g, '</b></p>');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>ИПР · ${esc(s.profile.name)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
