'use strict';
/* A green Pages build must mean the shared CBB crest contract passed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('mbb-logo-system.css','utf8');
const js=fs.readFileSync('mbb-logo-system.js','utf8');
const workflow=fs.readFileSync('.github/workflows/publish-newspaper.yml','utf8');
const checks=[
  ['.mbb-mark--art-flat', 'flat artwork must have an explicit sizing rule'],
  ['.mbb-mark--art-embedded_roundel', 'embedded roundel must have an explicit sizing rule'],
  ['object-fit:contain!important', 'logo artwork must be contained'],
  ['border-radius:50%!important', 'all crest frames must be circular'],
  ['--mbb-secondary', 'two distinct colored rings are required']
];
for(const [token,message] of checks)assert(css.includes(token),message);
assert(js.includes('mbb-mark--art-'), 'renderer must emit artwork-specific classes');
assert(js.includes('data-ring-count="2"'), 'renderer must declare two rings');
const index=workflow.indexOf('      - name: Verify published shared college basketball logo system\n');
assert(index>=0,'public Pages logo verification step missing');
const next=workflow.indexOf('\n      - name:',index+10);
const section=workflow.slice(index,next<0?undefined:next);
assert(!section.includes('continue-on-error: true'),
       'critical CBB logo verification must fail the Pages workflow');
assert(section.includes('Artwork-aware MBB renderer not published'),
       'Pages must verify that artwork-specific rules were actually published');
console.log('PASS: CBB artwork-specific crest rules and public Pages fail-closed logo gate');
