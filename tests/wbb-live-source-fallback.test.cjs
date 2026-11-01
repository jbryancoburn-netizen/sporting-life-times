'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path='.github/workflows/wbb-retro-live.yml';
const workflow=fs.readFileSync(path,'utf8');
test('women-only RETRO reruns when NCAA-origin evidence in shared source changes',()=>{
  const push=workflow.match(/\n  push:\s*\n    paths:\s*\n([\s\S]*?)(?=\n  schedule:)/);
  assert.ok(push,'push source filters must be declared');
  assert.match(push[1],/['"]data\/mbb-live\.json['"]/);
  assert.doesNotMatch(push[1],/data\/ncaaw-2026-27-(?:games|verified-games|retro-primary)\.json/,
    'women-only publisher outputs cannot retrigger their own workflow');
});
test('women’s publishing is strictly restricted to merged main (never source branch)',()=>{
  assert.match(workflow,/publish:\s*\n[\s\S]*?if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
  assert.match(workflow,/validate:[\s\S]*?if: github\.event_name == 'pull_request'/);
});
