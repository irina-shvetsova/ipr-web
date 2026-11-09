// Клиент шлюза и демо-режим без шлюза.

const clone = x => JSON.parse(JSON.stringify(x));

export class HttpApi {
  constructor(base) {
    this.base = base.replace(/\/$/, '');
    this.session = null;
    try { this.session = localStorage.getItem('ipr_session'); } catch { /* хранилище недоступно */ }
  }
  setSession(t) { this.session = t; try { t ? localStorage.setItem('ipr_session', t) : localStorage.removeItem('ipr_session'); } catch { /* */ } }
  async req(method, path, body) {
    const res = await fetch(this.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.session ? { Authorization: `Bearer ${this.session}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) this.setSession(null);
    if (!res.ok) { const e = new Error(data.error || `Ошибка ${res.status}`); e.status = res.status; throw e; }
    return data;
  }
  login(email) { return this.req('POST', '/auth/login', { email }); }
  async verify(token) { const r = await this.req('POST', '/auth/verify', { token }); this.setSession(r.session); return r; }
  listPlans() { return this.req('GET', '/plans'); }
  createPlan(b) { return this.req('POST', '/plans', b); }
  upload(planId, name, base64) { return this.req('POST', `/plans/${planId}/materials`, { file_name: name, content_base64: base64 }); }
  build(planId) { return this.req('POST', `/plans/${planId}/build`); }
  job(jobId) { return this.req('GET', `/jobs/${jobId}`); }
  getPlan(planId, view) { return this.req('GET', `/plans/${planId}${view ? `?view=${view}` : ''}`); }
  ops(planId, ops, label) { return this.req('POST', `/plans/${planId}/ops`, { ops, label }); }
  tutor(planId, message) { return this.req('POST', `/plans/${planId}/tutor`, { message }); }
  versions(planId) { return this.req('GET', `/plans/${planId}/versions`); }
  restore(planId, v) { return this.req('POST', `/plans/${planId}/versions/${v}/restore`); }
  send(planId, email) { return this.req('POST', `/plans/${planId}/send`, { manager_email: email }); }
}

/** Демо без шлюза: снимки, посчитанные движком правил заранее (demo/plan_demo.json) */
export class DemoApi {
  constructor(url = 'demo/plan_demo.json') { this.url = url; this.demo = true; this.session = 'demo'; this.versionsList = []; }
  async load() { if (!this.snap) this.snap = await (await fetch(this.url)).json(); }
  setSession() {}
  async login() { return { ok: true }; }
  async verify() { return { email: 'demo' }; }
  async listPlans() { return { plans: this.state ? [{ plan_id: 'demo', role: 'owner', version: this.state.version, name: this.state.profile.name }] : [] }; }
  async createPlan(b) {
    await this.load();
    this.profile = b.profile;
    return { plan: { plan_id: 'demo', version: 0, profile: b.profile } };
  }
  async upload(planId, name) { return { material: { id: 'm', file_name: name, readable: !/\.(pdf|docx?|xlsx?|jpe?g|png)$/i.test(name), reason: 'В демо читаются только текстовые файлы' } }; }
  async build() {
    await this.load();
    this.jobStart = Date.now();
    return { job_id: 'demo-job' };
  }
  async job() {
    const labels = ['Читаю: отчёт 360', 'Читаю: заметки', 'Читаю: прошлый план', 'Читаю: описание должности', 'Ищу связи между документами', 'Собираю объяснения', 'Выбираю главное и что пока не трогать', 'Пишу направления и вопросы к встрече', 'Проверяю текст'];
    const i = Math.floor((Date.now() - this.jobStart) / 550);
    if (i >= labels.length) {
      if (!this.state) this.commit(clone(this.snap.base), 'первый черновик');
      return { job: { status: 'done', steps: labels, current: labels.length } };
    }
    return { job: { status: 'running', steps: labels, current: i } };
  }
  commit(state, label) {
    state.version = this.versionsList.length + 1;
    this.versionsList.push({ version: state.version, label, created_at: new Date().toISOString(), state: clone(state) });
    this.state = state;
  }
  async getPlan(planId, view) {
    await this.load();
    if (view === 'manager') return { plan: this.snap.manager.state, view: 'manager', hidden: this.snap.manager.hidden };
    return { plan: this.state, view: 'owner' };
  }
  async ops(planId, ops, label) {
    const before = this.state;
    let next = clone(before);
    let note = null;
    for (const op of ops) {
      if (op.op === 'set_answer' && op.key === 'time') next = { ...clone(this.snap.variants[`time:${op.value}`]), answers: { ...next.answers, time: op.value }, compact: next.compact };
      else if (op.op === 'set_answer') next.answers[op.key] = op.value;
      else if (op.op === 'set_compact') next.compact = op.value;
      else note = 'В демо без шлюза эта правка не пересобирает план. На локальном шлюзе или в облаке работает полностью.';
    }
    const changes = before.selected.join() !== next.selected.join() ? [{ text: 'направления', anchor: 's3' }] : [];
    this.commit(next, label || 'правка');
    return { plan: this.state, changes, note };
  }
  async tutor(planId, message) {
    if (/короче|сократи/i.test(message)) { const r = await this.ops(planId, [{ op: 'set_compact', value: true }], 'короче'); return { ...r, reply: 'Сделал документ короче: подробности свёрнуты.' }; }
    if (/подробн|полност/i.test(message)) { const r = await this.ops(planId, [{ op: 'set_compact', value: false }], 'подробнее'); return { ...r, reply: 'Вернул полный документ.' }; }
    return { plan: this.state, changes: [], reply: 'В демо тьютор понимает только «сделай короче» и «подробнее». С шлюзом он переносит и убирает шаги, добавляет свои действия и объясняет выбор.' };
  }
  async versions() { return { versions: this.versionsList.map(({ state, ...v }) => v) }; }
  async restore(planId, v) { const ver = this.versionsList.find(x => x.version === Number(v)); this.commit(clone(ver.state), `возврат к версии ${v}`); return { plan: this.state, changes: [] }; }
  async send() { return { ok: true, demo: true }; }
}
