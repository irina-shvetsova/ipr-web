// Экраны ИПР·AI: вход, материалы, сборка, уточнение, готовый план, вид руководителя.
import { HttpApi, DemoApi } from './api.js';
import { planHTML, exportHTML, esc, low, cap, listRu, plural, TYPE_LABEL, TIME, GOALS, PREV_ST, goalShort, hyp, dir } from './render.js';

const $ = s => document.querySelector(s);
const cfg = window.IPR_CONFIG || {};
const autoBase = cfg.apiBase ?? (location.port === '8787' ? '/api' : 'demo');
const api = autoBase === 'demo' ? new DemoApi() : new HttpApi(autoBase);

const U = {
  screen: 'start', plan: null, planId: null, tab: 'ask', open: null, pend: {}, msgs: [], flash: {}, changes: [],
  wmOpen: null, mview: false, mvPlan: null, mvHidden: [], files: [], tasks: [], story: '', name: '', role: '',
  preview: false, saved: null, loginSent: null, plans: [], job: null, managerOnly: false, busy: false,
};
const DEMO_FILES = [
  { file: 'm1_360_profocenka.md', label: 'Отчёт 360' },
  { file: 'm2_notes_october.md', label: 'Заметки' },
  { file: 'm3_ipr_2025.md', label: 'Прошлый ИПР' },
  { file: 'm4_job_description.md', label: 'Описание должности' },
];
const MONTH_WORD = { январ: 'Январь', феврал: 'Февраль', март: 'Март', апрел: 'Апрель', ма: 'Май', июн: 'Июнь', июл: 'Июль', август: 'Август', сентябр: 'Сентябрь', октябр: 'Октябрь', ноябр: 'Ноябрь', декабр: 'Декабрь' };

// ---------------------------------------------------------------- общее

let toastT;
function toast(t) { const el = $('#toast'); el.innerHTML = esc(t); el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3800); }
function fail(e) { toast(e.message || 'Что-то пошло не так'); }
const confirmed = () => U.plan?.answers?.confirmed || [];
function questions() {
  const q = [];
  if (U.plan?.facts?.some(f => f.kind === 'prev_goal')) q.push('prev');
  q.push('tasks');
  if (U.plan?.ask_strengths) q.push('strengths');
  q.push('time', 'goal', 'prio');
  return q;
}
const allDone = () => questions().every(k => confirmed().includes(k));
const QT = { prev: 'Как прошёл прошлый план?', tasks: 'Задачи квартала верны?', time: 'Сколько времени в неделю на развитие?', goal: 'Куда хочешь расти?', prio: 'С чего начать?', strengths: 'Что у тебя получается лучше всего?' };

async function change(ops, label) {
  if (U.busy) return;
  U.busy = true;
  $('#rb').innerHTML = `<div class="rebuild"><div class="rb"><b>Пересобираю план</b><span>Учитываю ${esc(label || 'изменения')}</span><div class="bar"><i></i></div></div></div>`;
  try {
    const r = await api.ops(U.planId, ops, label);
    applyResult(r);
    if (r.note) toast(r.note); else if (r.changes?.length) toast('План обновлён: ' + r.changes.map(c => c.text).join(', '));
  } catch (e) { fail(e); } finally { U.busy = false; $('#rb').innerHTML = ''; }
}
function applyResult(r) {
  if (!r?.plan) return;
  U.plan = r.plan;
  U.changes = r.changes || [];
  U.flash = {};
  for (const c of U.changes) {
    if (c.anchor === 'main' || c.anchor === 's3') U.flash.main = 1;
    if (c.anchor?.startsWith('dir_')) U.flash[c.anchor] = 1;
    if (c.anchor === 's1') U.flash.ctx = 1;
    if (c.anchor === 's2') U.flash.hyp = 1;
    if (c.anchor === 's6') U.flash.meet = 1;
  }
  render();
}

// ---------------------------------------------------------------- шапка

function renderTop() {
  const st = U.screen === 'final' ? 2 : U.screen === 'work' ? 1 : 0;
  const items = ['Материалы', 'Уточнение', 'Готово к встрече'];
  $('#stepper').innerHTML = U.managerOnly ? '' : items.map((it, i) => `${i ? '<span class="ln"></span>' : ''}<i class="${i < st ? 'done' : i === st ? 'on' : ''}"${(i === 1 && U.screen === 'final') || (i === 2 && U.screen === 'work' && allDone()) ? ` data-go="${i === 1 ? 'work' : 'final'}" style="cursor:pointer"` : ''}><b>0${i + 1}</b><span class="lbl">${it}</span></i>`).join('');
  $('#who').textContent = U.plan && (U.screen === 'work' || U.screen === 'final') ? `${U.plan.profile.name} · ${low(U.plan.profile.role)}` : '';
  $('.proto').textContent = api.demo ? 'демо' : 'бета';
}

// ---------------------------------------------------------------- старт и вход

function startHTML() {
  if (U.screen === 'build') {
    const steps = U.job?.steps?.length ? U.job.steps : ['Готовлю материалы'];
    const cur = U.job?.current ?? 0;
    $('#scard').className = 'scard center';
    return `<div class="build" role="status" aria-live="polite"><h2>${U.plan?.version ? 'Обновляю черновик' : 'Собираю черновик плана'}</h2><ul class="blist">${steps.map((b, i) => `<li class="${i < cur ? 'done' : i === cur ? 'now' : ''}"><span class="d">${i < cur ? '✓' : ''}</span>${esc(b)}</li>`).join('')}</ul><p class="later" style="margin-top:14px">Обычно это занимает пару минут. Страницу можно не держать открытой: черновик сохранится.</p></div>`;
  }
  $('#scard').className = 'scard';
  if (!api.session) {
    if (U.auth?.mode === 'guest') {
      return '<div class="sblock"><h3>Вход для пилота</h3><p class="sh2">Введи код доступа, который тебе дали. Почта не нужна.</p><div class="field2"><label for="code">Код доступа</label><input id="code" type="text" autocomplete="off"></div><button class="btn wide" data-guest="1">Войти</button><p class="hintline">Планы сохраняются в этом браузере. В другом браузере или в режиме инкогнито их видно не будет.</p></div>';
    }
    if (U.loginSent) {
      if (U.loginSent.manual) return `<div class="sblock"><h3>Вход для пилота</h3><p class="sh2">Почта пока не подключена, поэтому ссылка для входа показана здесь. Она действует 20 минут.</p><p><a class="btn" href="${esc(U.loginSent.dev_link)}">Войти как ${esc(U.loginSent.email)}</a></p><button class="link" data-relogin="1">Другой адрес</button></div>`;
      return `<div class="sblock"><h3>Проверь почту</h3><p class="sh2">Ссылка для входа отправлена на ${esc(U.loginSent.email)}. Она действует 20 минут.</p>${U.loginSent.dev_link ? `<p><a class="btn" href="${esc(U.loginSent.dev_link)}">Войти (ссылка для разработки)</a></p>` : ''}<button class="link" data-relogin="1">Другой адрес</button></div>`;
    }
    return '<div class="sblock"><h3>Вход по ссылке на почту</h3><p class="sh2">Пароль не нужен: пришлём ссылку для входа.</p><div class="field2"><label for="email">Рабочая почта</label><input id="email" type="email" autocomplete="email" placeholder="name@company.ru"></div><button class="btn wide" data-login="1">Получить ссылку</button></div>';
  }
  let h = '';
  const last = U.plans.filter(p => p.role === 'owner').at(-1);
  if (last && last.version) {
    h += `<div class="resume"><div><span class="svc2">Сохранённый план</span><b>${esc(last.name || 'Без имени')} · версия ${last.version}</b><small>Все версии хранятся в истории.</small></div><div class="rb2"><button class="btn" data-openplan="${esc(last.plan_id)}">Открыть</button></div></div>`;
  }
  const mgrPlans = U.plans.filter(p => p.role === 'manager');
  if (mgrPlans.length) h += `<div class="resume"><div><span class="svc2">Планы сотрудников</span><b>${mgrPlans.map(p => esc(p.name || p.plan_id)).join(', ')}</b><small>Версии, которые сотрудники отправили к встрече.</small></div><div class="rb2">${mgrPlans.map(p => `<button class="btn ghost" data-openmgr="${esc(p.plan_id)}">${esc(p.name || 'Открыть')}</button>`).join('')}</div></div>`;
  const hasFiles = U.files.length > 0;
  h += '<div class="sblock"><h3>Материалы <span style="font-weight:400;color:var(--muted)">· по желанию</span></h3><p class="sh2">Отчёт 360, Delta, прошлый ИПР, самооценка, описание должности, заметки после встреч. Тип документа определим сами.</p>';
  if (hasFiles) h += '<div class="files">' + U.files.map(fileRow).join('') + '</div>';
  h += '<button class="drop sm" id="drop" type="button"><b>Перетащи файлы или выбери</b><small>TXT, MD, CSV. Можно несколько. PDF, Word и Excel скоро</small></button>';
  h += `<div class="demos">Примеры: ${DEMO_FILES.map((f, i) => { const on = U.files.some(x => x.name === f.file); return `<button class="chip${on ? ' on' : ''}" data-demof="${i}" aria-pressed="${on}">${esc(f.label)}</button>`; }).join('')}</div>`;
  const badOn = U.files.some(x => x.demoBad);
  h += `<p class="badlink"><button class="link" data-demobad="1" type="button">${badOn ? 'Убрать пример ошибки' : 'Показать, что будет, если файл не прочитается'}</button></p>`;
  if (!hasFiles) h += '<p class="hintline">Не знаешь, что загрузить? Подойдёт любой документ о тебе и работе. Если ничего нет, просто расскажи о работе ниже.</p>';
  h += '</div>';
  h += `<div class="sblock"><h3>О работе</h3><p class="sh2">${hasFiles ? 'Дополнит материалы. Можно пропустить.' : 'Если загрузить нечего, этого хватит для черновика.'}</p>`;
  h += `<div class="field2"><label for="meName">Как тебя зовут</label><input id="meName" type="text" placeholder="Необязательно" value="${esc(U.name)}"></div>`;
  h += `<div class="field2"><label for="meRole">Роль</label><input id="meRole" type="text" placeholder="Например: руководитель группы аналитики или эксперт" value="${esc(U.role)}"><div class="rolechips">${ROLES.map(r => `<button class="chip${U.role === r ? ' on' : ''}" data-role="${esc(r)}" type="button">${esc(r)}</button>`).join('')}</div></div>`;
  h += `<div class="field2"><label>Какие задачи у тебя в этом квартале</label>${tasksHTML()}</div>`;
  h += `<div class="field2"><label for="story">Что сейчас забирает больше всего времени</label><textarea id="story" rows="2" placeholder="Например: недельный отчёт собираю без команды, потому что так быстрее">${esc(U.story)}</textarea><small>Из этого ответа строится объяснение того, куда на самом деле уходит время.</small></div></div>`;
  if (U.buildError) h += `<div class="bdiag" style="border-color:#c0392b;color:#8a2b20"><b>${esc(U.buildError.text)}</b>${U.buildError.detail ? `<p>Подробности: ${esc(U.buildError.detail)}</p>` : ''}</div>`;
  h += `<div class="basis" id="basis">${basisInner()}</div>`;
  h += `<button class="btn wide" data-start="1" type="button"${canBuild() ? '' : ' disabled'}>Собрать черновик</button>`;
  h += `<p class="demoline">Заполнить примером: <button class="link" data-demo="lead" type="button">руководитель группы</button>${api.demo ? '' : '<button class="link" data-demo="spec" type="button">ведущий аналитик</button>'}</p>`;
  return h;
}

// ---------------------------------------------------------------- старт: задачи, файлы, основание

const ROLES = ['Руководитель группы', 'Руководитель отдела', 'Эксперт', 'Менеджер проекта'];
const ROLE_TASKS = {
  'Руководитель группы': ['Квартальная отчётность', 'Проверка работы команды', 'Согласования с дирекцией', 'Запуск нового направления', 'Найм в команду', 'Развитие команды'],
  'Руководитель отдела': ['Согласования с дирекцией', 'Запуск нового направления', 'Найм в команду', 'Развитие команды', 'Квартальная отчётность'],
  'Эксперт': ['Экспертиза по проектам', 'Методология и стандарты', 'Обучение коллег', 'Запуск нового направления', 'Согласования с дирекцией'],
  'Менеджер проекта': ['Сроки проекта', 'Работа с заказчиком', 'Запуск нового направления', 'Квартальная отчётность', 'Развитие команды'],
};
const GENERIC_TASKS = ['Квартальная отчётность', 'Запуск нового направления', 'Согласования с дирекцией', 'Развитие команды', 'Обучение коллег'];
function roleKey() {
  const r = U.role.trim();
  if (ROLE_TASKS[r]) return r;
  if (/руковод.*отдел/i.test(r)) return 'Руководитель отдела';
  if (/руковод/i.test(r)) return 'Руководитель группы';
  if (/эксперт|аналитик|специалист/i.test(r)) return 'Эксперт';
  if (/проект/i.test(r)) return 'Менеджер проекта';
  return null;
}
function tasksHTML() {
  const rk = roleKey();
  const sug = rk ? ROLE_TASKS[rk] : GENERIC_TASKS;
  const all = [...sug, ...U.tasks.filter(t => !sug.includes(t))];
  const src = rk ? `Подсказки для роли «${low(U.role.trim() || rk)}». Отметь подходящие или впиши своё.` : 'Типовые задачи: укажи роль, и подсказки станут точнее. Отметь подходящие или впиши своё.';
  return `<p class="cloudsrc">${esc(src)}</p><div class="chips">${all.map(t => { const on = U.tasks.includes(t); return `<button class="chip${on ? ' on' : ''}" data-tk="${esc(t)}" aria-pressed="${on}" type="button">${esc(t)}${sug.includes(t) ? '' : '<span class="stag">своё</span>'}</button>`; }).join('')}</div>`
    + '<div class="addtask"><input id="taskIn" type="text" aria-label="Своя задача" placeholder="Своя задача, например: переезд на новую систему"><button class="btn ghost" data-addtask="1" type="button">Добавить</button></div>';
}
function fileRow(f, i) {
  if (f.readable === false) return `<div class="file bad"><span class="fi">!</span><span class="fn"><b>${esc(f.name)}</b><small>${esc(f.reason || 'Не удалось прочитать файл')}. Остальные документы ждать не будут.</small></span><button class="x" data-rmfile="${i}" aria-label="Убрать файл">×</button></div>`;
  return `<div class="file"><span class="fi">${/360/.test(f.name) ? '360' : 'DOC'}</span><span class="fn"><b>${esc(f.label || f.name)}</b><small>Тип документа и о ком он, определим при сборке</small></span><button class="x" data-rmfile="${i}" aria-label="Убрать файл">×</button></div>`;
}
const okFiles = () => U.files.filter(f => f.readable !== false);
const canBuild = () => okFiles().length > 0 || (U.role.trim() && U.tasks.length > 0);
function basisInner() {
  const n = okFiles().length;
  const bp = [];
  if (n) bp.push(`${n} ${plural(n, 'файла', 'файлов', 'файлов')}`);
  if (U.role.trim()) bp.push('роли');
  if (U.tasks.length) bp.push('задач квартала');
  if (U.story.trim()) bp.push('рассказа о работе');
  if (!bp.length || !canBuild()) return 'Загрузи хотя бы один файл или укажи роль и задачи.';
  return `Черновик соберём из: <b>${esc(listRu(bp))}</b>.` + (n ? '' : '<span class="warnl">Без документов не будет объяснений того, как тебя видят коллеги. Документ скажет об этом прямо.</span>');
}
function refreshBasis() {
  const b = $('#basis'); if (b) b.innerHTML = basisInner();
  const s = document.querySelector('[data-start]'); if (s) s.disabled = !canBuild();
}

// ---------------------------------------------------------------- боковая панель

const pend = k => (U.pend[k] !== undefined ? U.pend[k] : current(k));
function current(k) {
  const a = U.plan.answers;
  if (k === 'time') return a.time;
  if (k === 'goal') return { ...a.goal };
  if (k === 'prio') return a.prio?.touched ? [...a.prio.selected] : [...U.plan.selected];
  if (k === 'strengths') return { selected: [...(a.strengths?.selected || [])], own: [...(a.strengths?.own || [])] };
  if (k === 'prev') return { st: { ...Object.fromEntries(U.plan.facts.filter(f => f.kind === 'prev_goal').map(f => [f.id, a.prev?.[f.id] || f.status])) }, rc: !!a.role_changed };
  return null;
}
function qSummary(k) {
  if (k === 'prev') { const p = pend('prev'); return p.rc ? 'Роль сменилась, прошлый план как контекст' : Object.values(p.st).map(v => low(PREV_ST.find(x => x.id === v)?.t || 'не отмечено')).join(', '); }
  if (k === 'tasks') return cap(listRu(U.plan.tasks.map(t => low(t.title)))) || 'Не указаны';
  if (k === 'time') { const t = TIME.find(x => x.id === pend('time')); return t.id === '0' ? t.t : `${t.t} в неделю`; }
  if (k === 'goal') return goalShort(pend('goal'));
  if (k === 'prio') return pend('prio').map(id => hyp(U.plan, id)?.topic).filter(Boolean).join(', ');
  if (k === 'strengths') { const p = pend('strengths'); const t = [...(U.plan.strength_candidates || []).filter(c => p.selected.includes(c.id)).map(c => c.topic), ...p.own]; return t.length ? t.join(', ') : 'Пока не отмечено'; }
  return '';
}
function okBtn(k, dis) {
  const done = confirmed().includes(k);
  const last = !done && questions().filter(q => !confirmed().includes(q)).length === 1;
  const lbl = done ? 'Готово' : last ? 'Да, так. План готов' : 'Да, так';
  return `<div class="qact"><button class="btn" data-next="${k}"${dis ? ' disabled' : ''}>${lbl}</button><small class="qnote">${U.pend[k] !== undefined ? 'Есть изменения. ' : ''}План перестроится после «${lbl}».</small></div>`;
}
function qBody(k) {
  let h = '';
  if (k === 'prev') {
    const p = pend('prev');
    const prev = U.plan.facts.filter(f => f.kind === 'prev_goal');
    h += `<p class="qhint">В прошлом плане нашли ${prev.length} ${plural(prev.length, 'цель', 'цели', 'целей')}. Проверь итоги: от этого зависит, что продолжать, а что закрыть.</p>`;
    h += `<label class="check" style="margin:0 0 12px"><input type="checkbox" id="prevRc"${p.rc ? ' checked' : ''}><span>С тех пор сменилась роль<small>Прошлые цели возьмём как контекст, без итогов.</small></span></label>`;
    if (!p.rc) h += '<div class="prevlist">' + prev.map(f => `<div class="prevrow"><b>${esc(f.source_label || f.behavior)}</b><div class="pseg" role="group">${PREV_ST.map(s => `<button class="chip${p.st[f.id] === s.id ? ' on' : ''}" data-pst="${esc(f.id)}|${s.id}">${s.t}</button>`).join('')}</div></div>`).join('') + '</div>';
    return h + okBtn(k);
  }
  if (k === 'tasks') {
    h += '<p class="qhint">Задачи с первого экрана. От них зависят объяснения и то, с чего начать. Чтобы поменять задачи, пересобери план с первого экрана.</p>';
    h += '<ul class="vlist">' + U.plan.tasks.map(t => `<li>${esc(t.title)}</li>`).join('') + '</ul>';
    return h + okBtn(k, !U.plan.tasks.length);
  }
  if (k === 'time') {
    const tv = pend('time');
    h += '<p class="qhint">От этого зависит, сколько направлений мы советуем. Больше трёх за квартал не берём.</p>';
    h += '<div class="seg">' + TIME.map(t => `<button class="opt${tv === t.id ? ' on' : ''}" data-time="${t.id}" aria-pressed="${tv === t.id}"><b>${esc(t.t)}</b><small>${esc(t.d)}</small></button>`).join('') + '</div>';
    return h + okBtn(k);
  }
  if (k === 'goal') {
    const g = pend('goal');
    h += '<p class="qhint">Куда хочешь двигаться в целом. Любой вариант подходит.</p>';
    h += '<div class="opts">' + GOALS.map(x => `<button class="opt${g.type === x.id ? ' on' : ''}" data-goal="${x.id}" aria-pressed="${g.type === x.id}"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></button>`).join('') + '</div>';
    if (g.type === 'own') h += `<div class="goalbox"><input type="text" id="goalText" aria-label="Твоя цель" placeholder="Например: руководить отделом аналитики" value="${esc(g.text || '')}"><label class="check"><input type="checkbox" id="goalHide"${g.hidden ? ' checked' : ''}><span>Не показывать руководителю<small>Цель учтём в плане, но в версии для руководителя её не будет.</small></span></label></div>`;
    return h + okBtn(k, g.type === 'own' && !(g.text || '').trim());
  }
  if (k === 'strengths') {
    const p = pend('strengths');
    const cands = U.plan.strength_candidates || [];
    h += '<p class="qhint">В материалах нет оценки коллег, поэтому сильные стороны отмечаешь ты. План будет на них опираться. В документе будет подпись, что это твои слова.</p>';
    if (cands.length) h += '<div class="plist">' + cands.map(c => { const on = p.selected.includes(c.id); return `<button class="popt${on ? ' on' : ''}" data-str="${esc(c.id)}" aria-pressed="${on}"><span class="pbox">${on ? '✓' : ''}</span><span class="pt"><b>${esc(c.topic)}</b><small>${esc(c.summary)}</small></span></button>`; }).join('') + '</div>';
    else h += '<p class="qhint">В документах подходящих примеров не нашлось. Впиши своими словами.</p>';
    if (p.own.length) h += '<ul class="vlist">' + p.own.map((t, i) => `<li>${esc(t)} <button class="link" data-rmstr="${i}">убрать</button></li>`).join('') + '</ul>';
    if (p.own.length < 3) h += '<div class="addtask"><input id="strIn" type="text" aria-label="Своя сильная сторона" placeholder="Своё, например: быстро разбираюсь в новых данных"><button class="btn ghost" data-addstr="1" type="button">Добавить</button></div>';
    return h + okBtn(k);
  }
  if (k === 'prio') {
    const P = pend('prio');
    const n = { '1': 1, '3': 2, '5': 3, '0': 1 }[U.plan.answers.time];
    h += `<p class="qhint">Порядок предложен по опорам, задачам квартала и прошлому плану. Советуем ${n === 1 ? 'одно направление' : n === 2 ? 'два' : 'три'}. Первое отмеченное станет главным.</p>`;
    h += '<div class="plist">' + (U.plan.ranking || []).map(r => {
      const on = P.includes(r.hypothesis_id);
      const num = P.indexOf(r.hypothesis_id) + 1;
      return `<button class="popt${on ? ' on' : ''}" data-prio="${r.hypothesis_id}" aria-pressed="${on}"${!on && P.length >= 3 ? ' disabled' : ''}><span class="pbox">${on ? num : ''}</span><span class="pt"><b>${esc(hyp(U.plan, r.hypothesis_id)?.topic)}${U.plan.selected.includes(r.hypothesis_id) && !U.plan.answers.prio?.touched ? '<span class="rec">Советуем</span>' : ''}</b><small>${esc(cap(r.reasons.join('; ')))}.</small></span></button>`;
    }).join('') + '</div>';
    if (P.length > n) h += `<div class="warnline"><b>Плотно</b> для выбранного времени. Можно оставить: тогда к встрече добавим вопрос о времени.</div>`;
    return h + okBtn(k, !P.length);
  }
  return h;
}
function askHTML() {
  let h = '';
  const left = questions().filter(q => !confirmed().includes(q)).length;
  if (!left) h += '<div class="ready"><b>Всё уточнено</b><span>Документ готов. Открой его, проверь целиком и скачай для встречи.</span><div class="readybtn"><button class="btn wide" data-go="final">Открыть готовый план</button></div></div>';
  else h += `<div class="intro"><div class="svc">Шаг 02 · уточнение<button class="matbtn" data-hist="1">История</button></div><h2>Осталось ${left} ${plural(left, 'вопрос', 'вопроса', 'вопросов')}</h2><p>Черновик уже собран. Ответы подставлены: проверь и подтверди, после этого план перестроится. Если объяснение в документе не про тебя, отметь это кнопкой «Не про меня».</p></div>`;
  questions().forEach((k, i) => {
    const done = confirmed().includes(k);
    const open = U.open === k;
    h += `<div class="q${open ? ' open' : ''}${done ? ' done' : ''}"><button class="qh" data-q="${k}" aria-expanded="${open}"><span class="qn">${done && !open ? '✓' : '0' + (i + 1)}</span><span class="qt"><b>${QT[k]}</b>${open ? '' : `<small>${esc(qSummary(k))}${U.pend[k] !== undefined ? ' · не подтверждено' : ''}</small>`}</span>${open ? '' : `<span class="qe">${done ? 'Изменить' : 'Ответить'}</span>`}</button>`;
    if (open) h += `<div class="qb">${qBody(k)}</div>`;
    h += '</div>';
  });
  return h;
}
function tutorHTML() {
  return '<div class="msgs" aria-live="polite">' + U.msgs.map(m => `<div class="m ${m.w}">${esc(m.t)}</div>`).join('') + '</div>';
}
function tutorFoot() {
  const sg = ['Почему главное именно это?', `Перенеси шаг 1 на ${low(U.plan.quarter.months[1])}`, 'Сделай короче'];
  return `<div class="sugg">${sg.map(s => `<button class="sg" data-say="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
    + '<div class="inp"><textarea id="ta" rows="1" aria-label="Сообщение тьютору" placeholder="Например: убери шаг 2 или перенеси шаг 1 на январь"></textarea>'
    + '<button class="ib mic" id="mic" title="Сказать голосом" aria-label="Сказать голосом"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>'
    + '<button class="ib send" id="send" title="Отправить" aria-label="Отправить"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
}
function renderSide() {
  document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('on', b.dataset.tab === U.tab); b.setAttribute('aria-selected', b.dataset.tab === U.tab); });
  $('#sbody').innerHTML = U.tab === 'ask' ? askHTML() : tutorHTML();
  $('#sfoot').innerHTML = U.tab === 'ask'
    ? (allDone() ? '<button class="btn wide" data-go="final">Открыть готовый план</button>' : `<button class="btn wide" disabled>Осталось ответить: ${questions().filter(q => !confirmed().includes(q)).length}</button>`)
    : tutorFoot();
  if (U.tab === 'tutor') { const m = $('#sbody'); m.scrollTop = m.scrollHeight; bindTutor(); }
  const rc = $('#prevRc'); if (rc) rc.addEventListener('change', () => { const p = pend('prev'); U.pend.prev = { ...p, rc: rc.checked }; renderSide(); });
  const gt = $('#goalText'); if (gt) gt.addEventListener('input', () => { U.pend.goal = { ...pend('goal'), text: gt.value }; const b = document.querySelector('[data-next="goal"]'); if (b) b.disabled = !gt.value.trim(); });
  const gh = $('#goalHide'); if (gh) gh.addEventListener('change', () => { U.pend.goal = { ...pend('goal'), hidden: gh.checked }; });
}
// Диагностика сборки для пилота: сколько чего получилось и какие шаги дали ошибку
function buildDiagHTML() {
  const p = U.plan;
  const probs = Object.entries(p.build_problems || {}).filter(([, v]) => v && v.length);
  const mats = p.materials || [];
  const read = mats.filter(m => m.readable !== false && m.status !== 'unreadable').length;
  const counts = `Документов: ${mats.length}, прочитано: ${read}. Фактов: ${(p.facts || []).length}. Связей: ${(p.links || []).length}. Объяснений: ${(p.hypotheses || []).length}. Догадок: ${(p.guesses || []).length}. Направлений: ${(p.directions || []).length}.`;
  const list = probs.length
    ? `<ul>${probs.map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v.slice(0, 4).join('; ').slice(0, 600))}</li>`).join('')}</ul>`
    : '<p>Ошибок на шагах сборки нет.</p>';
  return `<details class="bdiag"${probs.length ? ' open' : ''}><summary>Диагностика сборки${probs.length ? ` · шагов с ошибками: ${probs.length}` : ''}</summary><p>${esc(counts)}</p>${list}</details>`;
}

function bandHTML() {
  const chg = U.changes.length ? `<small>Только что обновлено: ${U.changes.map(c => `<button data-jump="${esc(c.anchor)}">${esc(c.text)}</button>`).join(', ')}</small>` : '';
  const tools = `<span class="btools"><button data-compact="1">${U.plan.compact ? 'Подробнее' : 'Короче'}</button><button data-hist="1">История версий · ${U.plan.version}</button><button data-dl="docx">Скачать черновик</button></span>`;
  if (allDone()) return `<div class="band ok"><span class="bl">Готов к встрече</span><span class="bt">Все уточнения учтены. Проверь документ целиком и скачай его.${chg}</span>${tools}<button class="btn" data-go="final">Открыть готовый план</button></div>`;
  const left = questions().filter(q => !confirmed().includes(q)).length;
  return `<div class="band"><span class="bl">Черновик</span><span class="bt">Это ещё не план. Ответь на ${left} ${plural(left, 'вопрос', 'вопроса', 'вопросов')} слева, и он перестроится под тебя.${chg}</span>${tools}<span class="dots">${questions().map(k => `<i class="${confirmed().includes(k) ? 'on' : ''}"></i>`).join('')}</span></div>`;
}
function renderDoc() {
  // Каждая часть рисуется отдельно: сбой в одной не оставляет экран пустым и показывает причину
  const part = (name, fn) => { try { return fn(); } catch (e) { console.error(name, e); return `<div class="bdiag" open><p><b>Не удалось отрисовать: ${esc(name)}.</b> Пришли этот текст: ${esc(e?.message)} ${esc(String(e?.stack || '').split('\n').slice(1, 3).join(' '))}</p></div>`; } };
  $('#paper').innerHTML = part('полоса состояния', bandHTML) + part('диагностика сборки', buildDiagHTML) + part('план', () => planHTML(U.plan, { mode: 'draft', flash: U.flash, wmOpen: U.wmOpen }));
  setTimeout(() => { U.flash = {}; }, 60);
}

// ---------------------------------------------------------------- готовый план

function renderFinal() {
  if (U.preview) {
    $('.fbar-in').innerHTML = '<span class="pvnote">Это пример готового плана. Твой будет собран из твоих данных.</span><div class="fsp"></div><button class="btn sm" data-endpreview="1">Собрать свой план</button>';
    $('#fdoc').innerHTML = planHTML(U.plan, { mode: 'final' });
    $('#fside').innerHTML = '<div class="fcard"><h3>Как устроен план</h3><ol><li>«Главное»: с чего начать и почему.</li><li>Разделы 1–2: на чём построен план и объяснения по зонам роста.</li><li>Раздел 3: направления с шагами на квартал.</li><li>Разделы 4–6: обучение, точки контроля и вопросы к руководителю.</li></ol></div><div class="fcard"><h3>Как начать</h3><p>Загрузи материалы или расскажи о работе. Черновик соберётся сразу, потом его можно уточнить.</p><button class="btn ghost wide" data-endpreview="1">Собрать свой план</button></div>';
    return;
  }
  const mv = U.mview || U.managerOnly;
  const p = mv ? U.mvPlan : U.plan;
  $('.fbar-in').innerHTML = U.managerOnly
    ? '<span class="pvnote">Версия плана, которую сотрудник отправил к встрече.</span><div class="fsp"></div><button class="btn ghost sm" data-dl="docx">Скачать Word</button><button class="btn sm" data-dl="pdf">Скачать PDF</button>'
    : `<button class="btn ghost sm" data-back="1">Вернуться к правкам</button><div class="fsp"></div><button class="btn ghost sm" data-mview="1" aria-pressed="${!!U.mview}">${U.mview ? 'Моя версия' : 'Глазами руководителя'}</button><button class="btn ghost sm" data-dl="docx">Скачать Word</button><button class="btn sm" data-dl="pdf">Скачать PDF</button>`;
  $('#fdoc').innerHTML = (U.mview && !U.managerOnly ? `<div class="mvnote"><b>Так план увидит руководитель.</b> ${U.mvHidden.length ? `Скрыто: ${esc(listRu(U.mvHidden))}.` : 'Отличий от твоей версии нет.'}</div>` : '') + planHTML(p, { mode: 'final', manager: mv });
  if (U.managerOnly) {
    $('#fside').innerHTML = '<div class="fcard"><h3>К встрече</h3><p>Прочитай «Главное» и раздел 2. Вопросы для разговора собраны в разделе 6.</p><p class="later">Скрытые цели сотрудника, его личные заметки и отклонённые объяснения в эту версию не входят.</p></div>';
    return;
  }
  const Q = U.plan.meeting_questions || [];
  const P = U.plan.selected;
  const A = U.plan.hypotheses.filter(h => !h.rejected);
  $('#fside').innerHTML = `<div class="fcard"><h3>Готово к встрече</h3><p class="ok">${allDone() ? 'Все вопросы уточнены' : 'Есть неподтверждённые ответы'}</p><p>${P.length} ${plural(P.length, 'направление', 'направления', 'направлений')}, ${A.length} ${plural(A.length, 'объяснение', 'объяснения', 'объяснений')}, ${Q.length} ${plural(Q.length, 'вопрос', 'вопроса', 'вопросов')} к руководителю.</p></div>`
    + `<div class="fcard"><h3>Отправить руководителю</h3><p class="later">Руководитель увидит версию без скрытой цели, твоих заметок и отклонённых объяснений.</p>${U.auth?.mode === 'guest' ? '<button class="btn wide" data-sendmgr="1">Получить ссылку для руководителя</button>' : '<div class="field2"><input id="mgrEmail" type="email" placeholder="почта руководителя"></div><button class="btn wide" data-sendmgr="1">Отправить черновик</button>'}${U.mgrLink ? `<div class="field2" style="margin-top:10px"><label for="mgrLink">Ссылка для руководителя</label><input id="mgrLink" type="text" readonly value="${esc(U.mgrLink)}" onclick="this.select()"><small>Скопируй и отправь руководителю. Ссылка действует 14 дней и показывает версию, отправленную последней.</small></div>` : ''}<p style="margin:8px 0 0"><button class="link" data-mview="1">${U.mview ? 'Вернуться к своей версии' : 'Сначала посмотреть глазами руководителя'}</button></p></div>`
    + '<div class="fcard"><h3>Как подготовиться</h3><ol><li>Прочитай «Главное» и раздел 2. Отметь объяснения, которые не про тебя.</li><li>Проверь, как план увидит руководитель, и отправь его за день до встречи.</li><li>На встрече пройдите по вопросам из раздела 6.</li><li>После встречи внеси договорённости и пересобери план.</li></ol></div>'
    + '<div class="fcard"><h3>Что-то не так?</h3><p>Ответы и объяснения можно поменять, план перестроится. Прошлые версии сохранены в истории.</p><button class="btn ghost wide" data-back="1">Вернуться к правкам</button></div>';
}

function renderMbar() {
  let h = '';
  if (U.screen === 'work') h = allDone() ? '<button class="btn" data-go="final">Готовый план</button>' : '<button class="btn" data-goq="1">Ответить на вопросы</button>';
  else if (U.screen === 'final' && U.preview) h = '<button class="btn" data-endpreview="1">Собрать свой план</button>';
  else if (U.screen === 'final' && !U.managerOnly) h = '<button class="btn ghost" data-back="1">К правкам</button><button class="btn" data-dl="pdf">Скачать</button>';
  $('#mbar').innerHTML = h;
}

function render() {
  renderTop();
  ['startScr', 'workScr', 'finalScr'].forEach(id => $('#' + id).classList.add('hidden'));
  if (['start', 'build'].includes(U.screen)) { $('#startScr').classList.remove('hidden'); $('#scard').innerHTML = startHTML(); bindStart(); }
  else if (U.screen === 'work') { $('#workScr').classList.remove('hidden'); renderSide(); renderDoc(); }
  else { $('#finalScr').classList.remove('hidden'); renderFinal(); }
  renderMbar();
}

// ---------------------------------------------------------------- действия

function bindStart() {
  const keep = (id, key) => { const el = $('#' + id); if (el) el.addEventListener('input', () => { U[key] = el.value; refreshBasis(); }); };
  keep('meName', 'name'); keep('meRole', 'role'); keep('story', 'story');
  const ri = $('#meRole'); if (ri) ri.addEventListener('change', () => render());
  const ti = $('#taskIn'); if (ti) ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-addtask]').click(); } });
  const em = $('#email'); if (em) em.addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('[data-login]').click(); });
  const drop = $('#drop');
  if (drop) {
    drop.onclick = () => $('#file').click();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); addFiles(e.dataTransfer.files); };
  }
}
async function addFiles(list) {
  for (const f of list) {
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const readable = /\.(txt|md|csv|tsv|json)$/i.test(f.name);
    U.files.push({ name: f.name, base64: btoa(bin), readable, reason: readable ? null : 'Этот формат пока не читается. Скопируй текст в .txt' });
  }
  render();
}
async function addDemo(i) {
  const f = DEMO_FILES[i];
  if (U.files.some(x => x.name === f.file)) { U.files = U.files.filter(x => x.name !== f.file); render(); return; }
  const text = await (await fetch(`demo/materials/${f.file}`)).text();
  U.files.push({ name: f.file, base64: btoa(unescape(encodeURIComponent(text))), readable: true, demoIndex: i });
  U.files.sort((a, b) => (a.demoIndex ?? 99) - (b.demoIndex ?? 99));
  render();
}
async function startBuild() {
  try {
    const c = await api.createPlan({ profile: { name: U.name.trim(), role: U.role.trim(), persona: /руковод/i.test(U.role) ? 'lead' : 'spec' }, tasks: U.tasks, story: U.story });
    U.planId = c.plan.plan_id;
    for (const f of U.files.filter(x => !x.demoBad)) {
      const r = await api.upload(U.planId, f.name, f.base64);
      if (!r.material.readable) toast(`${f.name}: ${r.material.reason}`);
    }
    const b = await api.build(U.planId);
    U.screen = 'build'; U.job = null; render();
    await poll(b.job_id);
  } catch (e) { fail(e); }
}
async function poll(jobId) {
  for (;;) {
    const { job } = await api.job(jobId);
    U.job = job;
    if (U.screen === 'build') $('#scard').innerHTML = startHTML();
    if (job.status === 'done') break;
    if (job.status === 'failed') { U.buildError = { text: job.error || 'Не получилось собрать черновик', detail: job.detail || '' }; U.screen = 'start'; render(); return; }
    await new Promise(r => setTimeout(r, 900));
  }
  await openPlan(U.planId);
  U.msgs = [{ w: 't', t: 'Я помогу поправить план своими словами: перенести или убрать шаг, добавить своё действие, сделать документ короче, объяснить, почему главное именно это.' }];
}
async function openPlan(planId) {
  const r = await api.getPlan(planId);
  U.planId = planId; U.plan = r.plan; U.pend = {}; U.changes = [];
  U.open = questions().find(q => !confirmed().includes(q)) || null;
  U.screen = allDone() ? 'final' : 'work';
  render();
}
async function confirmQ(k) {
  const ops = [];
  if (k === 'time') ops.push({ op: 'set_answer', key: 'time', value: pend('time') });
  if (k === 'goal') ops.push({ op: 'set_answer', key: 'goal', value: pend('goal') });
  if (k === 'prio') ops.push({ op: 'set_answer', key: 'prio', value: { selected: pend('prio') } });
  if (k === 'strengths') ops.push({ op: 'set_answer', key: 'strengths', value: pend('strengths') });
  if (k === 'tasks') ops.push({ op: 'set_answer', key: 'tasks_confirmed', value: true });
  if (k === 'prev') { const p = pend('prev'); ops.push({ op: 'set_answer', key: 'prev', value: p.st }, { op: 'set_answer', key: 'role_changed', value: p.rc }); }
  ops.push({ op: 'set_answer', key: 'confirmed', value: [...new Set([...confirmed(), k])] });
  delete U.pend[k];
  await change(ops, `ответ: ${low(QT[k]).replace(/\?$/, '')}`);
  U.open = questions().find(q => !confirmed().includes(q)) || null;
  renderSide();
}
function monthIn(text) {
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(MONTH_WORD)) if (new RegExp(`(^|\\s)${k}`).test(t)) return v;
  return null;
}
async function sendTutor(text) {
  text = (text || '').trim();
  if (!text) return;
  U.msgs.push({ w: 'u', t: text }); renderSide();
  try {
    const r = await api.tutor(U.planId, text);
    U.msgs.push({ w: 't', t: r.reply });
    applyResult(r);
  } catch (e) { U.msgs.push({ w: 't', t: e.message }); renderSide(); }
}
function bindTutor() {
  const ta = $('#ta');
  if (!ta) return;
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutor(ta.value); } });
  $('#send').onclick = () => sendTutor(ta.value);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('#mic');
  if (!SR) { mic.style.display = 'none'; return; }
  mic.onclick = () => {
    const r = new SR(); r.lang = 'ru-RU'; r.interimResults = true;
    mic.classList.add('rec');
    r.onresult = e => { ta.value = [...e.results].map(x => x[0].transcript).join(' '); };
    r.onend = () => mic.classList.remove('rec');
    r.start();
  };
}
async function showHistory() {
  const { versions } = await api.versions(U.planId);
  $('#hist').innerHTML = '<div class="histp"><div class="hh"><b>История версий</b><button class="x" data-hclose="1" aria-label="Закрыть">×</button></div><p>Каждое изменение сохраняется. Любую версию можно вернуть: текущая при этом тоже останется в истории.</p><ol>'
    + versions.slice().reverse().map(v => `<li><span class="vn">${v.version}</span><span class="vt"><b>${esc(cap(v.label))}</b><small>${esc(new Date(v.created_at).toLocaleString('ru-RU'))}</small></span>${v.version === U.plan.version ? '<span class="vcur">текущая</span>' : `<button class="btn ghost sm" data-restore="${v.version}">Вернуть</button>`}</li>`).join('')
    + '</ol></div>';
}
function download(kind) {
  const p = U.mview || U.managerOnly ? U.mvPlan : U.plan;
  if (kind === 'pdf') { if (U.screen !== 'final') { U.screen = 'final'; render(); } setTimeout(() => window.print(), 100); return; }
  const blob = new Blob(['﻿' + exportHTML(p, { manager: U.mview || U.managerOnly })], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ИПР ${p.profile.name || ''} v${p.version}.doc`.replace(/\s+/g, ' ');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function loadManagerView() {
  const r = await api.getPlan(U.planId, 'manager');
  U.mvPlan = r.plan; U.mvHidden = r.hidden || r.plan.hidden_in_view || [];
}

async function openPreview() {
  const snap = await (await fetch('demo/plan_demo.json')).json();
  U.saved = { plan: U.plan, planId: U.planId, screen: U.screen, mview: U.mview };
  const plan = snap.variants?.['time:3'] || snap.base;
  plan.answers = { ...plan.answers, confirmed: ['prev', 'tasks', 'time', 'goal', 'prio'] };
  U.plan = plan; U.planId = null; U.preview = true; U.mview = false; U.screen = 'final';
  render(); window.scrollTo(0, 0);
}
function endPreview() {
  Object.assign(U, U.saved || {}, { preview: false, saved: null, screen: 'start' });
  render(); window.scrollTo(0, 0);
}
function showHelp() {
  $('#hist').innerHTML = '<div class="histp help"><div class="hh"><b>Как пользоваться</b><button class="x" data-hclose="1" aria-label="Закрыть">×</button></div>'
    + '<p>Три шага, анкеты нет.</p><ol>'
    + '<li><span class="vn">1</span><span class="vt"><b>Загрузи материалы или расскажи о работе</b><small>Подойдут отчёт 360 любой методики, прошлый ИПР, заметки после встреч, описание должности. Если документов нет, хватит роли и задач квартала.</small></span></li>'
    + '<li><span class="vn">2</span><span class="vt"><b>Уточни черновик</b><small>Слева несколько коротких вопросов. После каждого ответа план перестраивается. Объяснения, которые не про тебя, можно отклонить. Тьютору можно написать своими словами: перенести шаг, сделать короче.</small></span></li>'
    + '<li><span class="vn">3</span><span class="vt"><b>Подготовься к встрече</b><small>Проверь, как план увидит руководитель, скачай документ или отправь ссылку. Все версии хранятся в истории.</small></span></li>'
    + '</ol><p><button class="link" data-preview="1">Посмотреть пример готового плана</button></p></div>';
}

document.addEventListener('click', async e => {
  const el = e.target.closest('button,[data-go]');
  if (!el) return;
  const d = el.dataset;
  try {
    if (d.go) { if (d.go === 'final' && !allDone()) { toast('Сначала ответь на вопросы'); return; } U.screen = d.go; U.mview = false; render(); window.scrollTo(0, 0); return; }
    if (d.back) { U.screen = 'work'; U.mview = false; render(); return; }
    if (el.closest('[data-home]')) { if (U.preview) { endPreview(); return; } if (!U.managerOnly) { U.screen = 'start'; render(); } return; }
    if (d.login) { const email = $('#email').value.trim(); U.loginSent = { email, ...(await api.login(email)) }; render(); return; }
    if (d.relogin) { U.loginSent = null; render(); return; }
    if (d.guest) { await api.guest($('#code').value); await loadPlans(); render(); return; }
    if (d.addtask) { const v = cap($('#taskIn').value.trim()); if (v.length > 2 && !U.tasks.includes(v)) { U.tasks.push(v); render(); $('#taskIn').focus(); } return; }
    if (d.tk) { const i = U.tasks.indexOf(d.tk); if (i > -1) U.tasks.splice(i, 1); else U.tasks.push(d.tk); render(); return; }
    if (d.role) { U.role = U.role === d.role ? '' : d.role; render(); return; }
    if (d.demobad) {
      if (U.files.some(x => x.demoBad)) U.files = U.files.filter(x => !x.demoBad);
      else U.files.push({ name: 'Скан_заметок.jpg', readable: false, demoBad: true, reason: 'Не удалось прочитать файл' });
      render(); return;
    }
    if (d.preview) { $('#hist').innerHTML = ''; await openPreview(); return; }
    if (d.endpreview) { endPreview(); return; }
    if (d.help) { showHelp(); return; }
    if (d.rmfile) { U.files.splice(+d.rmfile, 1); render(); return; }
    if (d.demof) { await addDemo(+d.demof); return; }
    if (d.demo === 'lead') {
      U.name = 'Марина'; U.role = 'Руководитель группы';
      U.tasks = ['Квартальная отчётность', 'Проверка работы команды', 'Согласования с дирекцией', 'Пилот модели прогноза спроса'];
      U.story = 'Недельный отчёт для дирекции собираю сама, потому что так быстрее, чем объяснять группе.';
      for (let i = 0; i < DEMO_FILES.length; i++) if (!U.files.some(x => x.name === DEMO_FILES[i].file)) await addDemo(i);
      return;
    }
    if (d.demo === 'spec') {
      U.name = 'Алексей'; U.role = 'Ведущий аналитик';
      U.tasks = ['Экспертиза по проектам', 'Методология и стандарты', 'Обучение коллег'];
      U.story = 'Большую часть недели отвечаю на вопросы коллег по методике расчёта, на собственные проекты остаются вечера.';
      U.files = U.files.filter(x => x.demoIndex === undefined && !x.demoBad);
      render(); return;
    }
    if (d.start) {
      U.buildError = null; el.disabled = true; await startBuild(); return; }
    if (d.openplan) { await openPlan(d.openplan); return; }
    if (d.openmgr) { U.planId = d.openmgr; U.managerOnly = true; await loadManagerView(); U.screen = 'final'; render(); return; }
    if (d.tab) { U.tab = d.tab; renderSide(); return; }
    if (d.q) { U.open = U.open === d.q ? null : d.q; renderSide(); return; }
    if (d.next) { await confirmQ(d.next); return; }
    if (d.time) { U.pend.time = d.time; renderSide(); return; }
    if (d.goal) { U.pend.goal = { ...pend('goal'), type: d.goal }; renderSide(); return; }
    if (d.str) { const p = pend('strengths'); const i = p.selected.indexOf(d.str); if (i > -1) p.selected.splice(i, 1); else p.selected.push(d.str); U.pend.strengths = p; renderSide(); return; }
    if (d.addstr) { const v = cap(($('#strIn')?.value || '').trim()); const p = pend('strengths'); if (v.length > 2 && p.own.length < 3 && !p.own.includes(v)) { p.own.push(v); U.pend.strengths = p; renderSide(); $('#strIn')?.focus(); } return; }
    if (d.rmstr) { const p = pend('strengths'); p.own.splice(+d.rmstr, 1); U.pend.strengths = p; renderSide(); return; }
    if (d.prio) { const P = pend('prio').slice(); const i = P.indexOf(d.prio); if (i > -1) { if (P.length === 1) { toast('Нужно хотя бы одно направление'); return; } P.splice(i, 1); } else if (P.length < 3) P.push(d.prio); U.pend.prio = P; renderSide(); return; }
    if (d.pst) { const [fid, st] = d.pst.split('|'); const p = pend('prev'); U.pend.prev = { ...p, st: { ...p.st, [fid]: st } }; renderSide(); return; }
    if (d.goq) { document.querySelector('.side').scrollIntoView({ behavior: 'smooth' }); return; }
    if (d.notme) { await change([{ op: 'reject_hypothesis', hypothesis_id: d.notme }], 'отказ от объяснения'); return; }
    if (d.reason) { const h = hyp(U.plan, d.reason); await change([{ op: 'reject_hypothesis', hypothesis_id: d.reason, reason: d.r, discuss: h.discuss_at_meeting }], 'причину отказа'); return; }
    if (d.unrej) { await change([{ op: 'restore_hypothesis', hypothesis_id: d.unrej }], 'возврат объяснения'); return; }
    if (d.wmove) { U.wmOpen = U.wmOpen === d.wmove ? null : d.wmove; renderDoc(); return; }
    if (d.wmclose) { U.wmOpen = null; renderDoc(); return; }
    if (d.wto) { const [key, when] = d.wto.split('|'); const [hid, idx] = key.split(':'); U.wmOpen = null; await change([{ op: 'move_step', hypothesis_id: hid, index: +idx, when }], 'перенос шага'); return; }
    if (d.wrm) { const [hid, idx] = d.wrm.split(':'); await change([{ op: 'remove_step', hypothesis_id: hid, index: +idx }], 'удаление шага'); return; }
    if (d.ownadd) { const inp = document.querySelector(`[data-ownin="${d.ownadd}"]`); const text = inp.value.trim(); if (text.length < 5) { toast('Опиши действие подробнее'); return; } await change([{ op: 'add_step', hypothesis_id: d.ownadd, text: cap(text), when: monthIn(text) }], 'своё действие'); return; }
    if (d.defer) { await change([{ op: 'defer_direction', hypothesis_id: d.defer }], 'перенос направления'); return; }
    if (d.compact) { await change([{ op: 'set_compact', value: !U.plan.compact }], U.plan.compact ? 'полный документ' : 'короткий документ'); return; }
    if (d.askdir) { const t = dir(U.plan, d.askdir)?.title; U.tab = 'tutor'; renderSide(); $('#ta').value = `В направлении «${t}» `; $('#ta').focus(); return; }
    if (d.say) { await sendTutor(d.say); return; }
    if (d.jump) { const id = { main: 'main', top: 'paper', s1: 's1', s2: 's2', s3: 's3', s6: 's6' }[d.jump] || d.jump; document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (d.hist) { await showHistory(); return; }
    if (d.hclose) { $('#hist').innerHTML = ''; return; }
    if (d.restore) { $('#hist').innerHTML = ''; applyResult(await api.restore(U.planId, d.restore)); toast(`Вернул версию ${d.restore}`); return; }
    if (d.mview) { if (!U.mview) await loadManagerView(); U.mview = !U.mview; render(); return; }
    if (d.dl) { download(d.dl); return; }
    if (d.sendmgr) {
      const email = $('#mgrEmail')?.value.trim() || '';
      const r = await api.send(U.planId, email);
      if (r.manual && r.dev_link) {
        U.mgrLink = r.dev_link; renderFinal();
        toast('Ссылка готова: скопируй её и отправь руководителю');
        return;
      }
      toast(r.demo ? 'В демо письмо не отправляется' : `Отправлено: ${email}`);
      if (r.dev_link) console.log('Ссылка руководителя (dev):', r.dev_link);
      return;
    }
  } catch (err) { fail(err); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.rejmeet) { const h = hyp(U.plan, t.dataset.rejmeet); await change([{ op: 'reject_hypothesis', hypothesis_id: h.id, reason: h.reject_reason, discuss: t.checked }], 'отметку для встречи'); }
});
$('#file').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });

// ---------------------------------------------------------------- запуск

async function loadPlans() {
  if (!api.session) return;
  try { U.plans = (await api.listPlans()).plans; } catch (e) { if (e.status !== 401) toast(e.message); }
}
async function boot() {
  if (!api.demo) { try { U.auth = await api.authConfig(); } catch { U.auth = { mode: 'email' }; } }
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('login')) {
    const plan = hash.get('plan');
    const own = api.session;
    // ссылка руководителя открывается во временной сессии и не затирает свою сессию браузера
    try { await api.verify(hash.get('login'), !plan); } catch (e) { toast(e.message); }
    history.replaceState(null, '', location.pathname);
    if (plan && api.session && api.session !== own) {
      try { U.planId = plan; U.managerOnly = true; await loadManagerView(); U.screen = 'final'; render(); return; } catch (e) { U.managerOnly = false; toast(e.message); }
    }
  }
  if (!api.session && U.auth?.mode === 'guest' && !U.auth.code_required) {
    try { await api.guest(''); } catch (e) { toast(e.message); }
  }
  await loadPlans();
  render();
}
window.addEventListener('hashchange', () => { if (location.hash.includes('login=')) boot(); });
boot();
