import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planHTML, exportHTML, methodologyHTML } from '../src/render.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../demo/plan_demo.json',import.meta.url),'utf8')).base;
const base=()=>({...structuredClone(fixture),methodology_version:1});
test('step display sorts across year boundary without changing API step indices',()=>{
 const s=base();s.quarter.months=['Ноябрь','Декабрь','Январь'];const d=s.directions.find(d=>d.hypothesis_id===s.selected[0]);
 d.steps=[{when:'Январь',text:'УНИКАЛЬНЫЙ ЯНВАРЬ'},{when:'Ноябрь',text:'УНИКАЛЬНЫЙ НОЯБРЬ'},{when:'Декабрь',text:'УНИКАЛЬНЫЙ ДЕКАБРЬ'}];
 const html=planHTML(s,{mode:'draft'});assert.ok(html.indexOf('УНИКАЛЬНЫЙ НОЯБРЬ')<html.indexOf('УНИКАЛЬНЫЙ ЯНВАРЬ'));assert.match(html,new RegExp(`data-wmove="${d.hypothesis_id}:1"`));assert.equal(d.steps[0].when,'Январь');
});
test('methodology and private practice render safely; exports have separated headings and no practice notes',()=>{
 const s=base(),d=s.directions[0];d.learning_goal='<script>bad</script>';d.feedback_plan='После пробы попросить коллегу проверить';d.review_plan='Через неделю разобрать результат';d.weekly_minutes=30;d.steps[0].practice={done:true,note:'ЧАСТНАЯ ЗАПИСЬ',review_date:'2026-12-01'};
 const html=planHTML(s,{mode:'draft'});assert.match(html,/&lt;script&gt;/);assert.match(html,/data-practice-save/);assert.match(html,/data-book-add/);assert.match(html,/30 мин/);
 const exp=exportHTML(s);assert.match(exp,/01\. /);assert.doesNotMatch(exp,/ЧАСТНАЯ ЗАПИСЬ|data-practice-save/);
 assert.match(methodologyHTML(),/пока не проверена/);
});
test('manager export excludes hidden goal',()=>{
 const s=base();s.answers.goal={type:'own',hidden:true,text:'ЧАСТНАЯ ЦЕЛЬ'};
 assert.doesNotMatch(exportHTML(s,{manager:true}),/ЧАСТНАЯ ЦЕЛЬ/);
});
