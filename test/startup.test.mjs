import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as rendering from '../src/render.js';
import * as clarifications from '../src/clarifications.js';

const code = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
function start(authConfig) {
  const nodes = new Map();
  const node = s => { if (!nodes.has(s)) nodes.set(s, { innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){} }); return nodes.get(s); };
  class Api { session = null; authConfig = authConfig; clientLog(){} }
  const context = vm.createContext({ ...rendering, ...clarifications, HttpApi: Api, DemoApi: Api,
    document: { querySelector: node, addEventListener(){} }, window: { IPR_CONFIG: { apiBase:'/api' }, addEventListener(){} },
    location: { hash:'', pathname:'/', port:'' }, history: { replaceState(){} }, sessionStorage:{ getItem(){return null;} },
    URLSearchParams, console, setTimeout, clearTimeout, setInterval(){},
  });
  vm.runInContext(code, context);
  return { context, card:node('#scard') };
}
const tick = () => new Promise(r => setImmediate(r));
test('startup renders immediately while auth is pending, then displays sign-in', async () => {
  let resolve; const pending = new Promise(r => { resolve=r; });
  const {card} = start(() => pending);
  assert.match(card.innerHTML, /Подключаюсь/);
  resolve({mode:'guest',code_required:true}); await tick();
  assert.match(card.innerHTML, /Код доступа/);
});
test('startup failure is visible and retry recovers without reloading', async () => {
  let calls=0; const {context,card} = start(async () => { if (++calls===1) throw Error('Ошибка 503'); return {mode:'guest',code_required:true}; });
  await tick(); assert.match(card.innerHTML,/Ошибка 503/); assert.match(card.innerHTML,/data-retry-boot/);
  await vm.runInContext('boot()',context);
  assert.match(card.innerHTML,/Код доступа/);
});

test('failed build displays persistent recovery with escaped error and saved answers', async () => {
  const {context,card}=start(async()=>({mode:'guest',code_required:true})); await tick();
  vm.runInContext(`U.planId='saved'; U.clarifyAnswers={q1:'Мой пример'}; failedBuild({job_id:'old',phase:'finalize',error:'Сбой <script>'}); render();`,context);
  assert.match(card.innerHTML,/data-retry-build/); assert.match(card.innerHTML,/data-edit-clarifications/);
  assert.match(card.innerHTML,/&lt;script&gt;/); assert.doesNotMatch(card.innerHTML,/<script>/);
  assert.equal(vm.runInContext('U.clarifyAnswers.q1',context),'Мой пример');
});

test('empty task list does not block confirmation and own focus input is available', async () => {
  const {context}=start(async()=>({mode:'guest',code_required:true})); await tick();
  vm.runInContext(`U.plan={methodology_version:1,tasks:[],facts:[],answers:{confirmed:[],time:'3'},selected:[],ranking:[]}; U.pend={};`,context);
  assert.doesNotMatch(vm.runInContext("qBody('tasks')",context),/disabled/);
  assert.match(vm.runInContext("qBody('prio')",context),/data-own-focus/);
});

test('tutor shows pending state, suppresses duplicate sends and clears pending after failure', async () => {
 const {context}=start(async()=>({mode:'guest',code_required:true})); await tick();
 let resolve;let calls=0;const pending=new Promise(r=>resolve=r);
 context.tutorStub=()=>{calls++;return pending;};
 vm.runInContext("api.tutor=tutorStub; renderSide=()=>{}; U.planId='test';",context);
 const first=vm.runInContext("sendTutor('Почему это?')",context);
 assert.equal(vm.runInContext('U.tutorBusy',context),true);
 assert.match(vm.runInContext('tutorHTML()',context),/Тьютор готовит ответ/);
 await vm.runInContext("sendTutor('Повтор')",context); assert.equal(calls,1);
 resolve({reply:'Объяснение',changes:[]});await first;
 assert.equal(vm.runInContext('U.tutorBusy',context),false);
 context.tutorStub=()=>{throw Error('Нет соединения');};vm.runInContext('api.tutor=tutorStub',context);
 await vm.runInContext("sendTutor('Снова')",context);assert.equal(vm.runInContext('U.tutorBusy',context),false);
});
