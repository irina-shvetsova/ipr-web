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
