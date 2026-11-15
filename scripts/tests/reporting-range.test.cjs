const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const esbuild = require('esbuild');
process.env.TZ = 'America/Edmonton';
const context = { module:{exports:{}}, Date, Intl, URLSearchParams };
vm.runInNewContext(esbuild.transformSync(fs.readFileSync('src/utils/reportingRange.ts','utf8'),{loader:'ts',format:'cjs'}).code,context);
const { rangeQuery, recentDays } = context.module.exports;
function params(from,to) { return Object.fromEntries(new URLSearchParams(rangeQuery({from,to}))); }
test('single-day end date includes the whole day in the reporting timezone',()=>{
  const p=params('2026-11-14','2026-11-14');
  assert.equal(p.startDate,'2026-11-14T07:00:00.000Z'); assert.equal(p.endDate,'2026-11-15T07:00:00.000Z');
  assert.equal(p.timezone,'America/Edmonton');
});
test('DST transition days use calendar boundaries instead of a fixed 24 hours',()=>{
  const spring=params('2026-03-08','2026-03-08'),fall=params('2026-11-01','2026-11-01');
  assert.equal(Date.parse(spring.endDate)-Date.parse(spring.startDate),23*3600000);
  assert.equal(Date.parse(fall.endDate)-Date.parse(fall.startDate),25*3600000);
});
test('presets include today and reject impossible/reversed/oversized ranges',()=>{
  const r=recentDays(7,new Date(2026,10,14));assert.equal(r.from,'2026-11-08');assert.equal(r.to,'2026-11-14');
  for(const [from,to] of [['2026-02-30','2026-03-01'],['2026-11-14','2026-11-13'],['2024-01-01','2026-01-01'],['','']]) assert.throws(()=>params(from,to));
});
