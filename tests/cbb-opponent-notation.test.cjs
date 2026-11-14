'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const form=require('../cbb-team-form.js');

test('Form Book is the only CBB team-page section that adds @, vs. and neutral (N)',()=>{
  const sample=[
    [{location:'away',opponent:'Missouri'},'@ Missouri'],
    [{location:'home',opponent:'Missouri'},'vs. Missouri'],
    [{location:'neutral',opponent:'Missouri'},'vs. Missouri (N)'],
    [{location:'unverified',listedSide:'away',opponent:'Missouri'},'@ Missouri']
  ];
  for(const [g,expected] of sample)assert.equal(form.opponentLabel(g),expected);
  const men=fs.readFileSync('mbb-team-calendar-boot.js','utf8');
  const women=fs.readFileSync('wbb-team-newspaper.js','utf8');
  assert(!men.includes('matchupPrefix')&&!men.includes('matchupSuffix'));
  assert(!women.includes('matchupPrefix')&&!women.includes('matchupSuffix'));
  assert.match(men,/'<span class="victorian-heading-school">'\+\(school\?/);
  assert.match(women,/'<span class="wbb-opponent-name">'\+\(opp\?/);
  assert.match(men,/const certifiedNeutral=e\.neutralSite===true&&e\.site_verified===true/);
  assert.match(women,/wbb-site-label/);
});

test('team pages refresh only the schedule scripts, retaining shared Form Book',()=>{
  const men=fs.readFileSync('ncaam-team.html','utf8');
  const women=fs.readFileSync('ncaaw-team.html','utf8');
  for(const html of [men,women])assert(html.includes('cbb-team-form.js?v=site-notation-neutral-proof-20261113'));
  assert(men.includes('mbb-team-calendar-boot.js?v=form-only-notation-20261114'));
  assert(women.includes('wbb-team-newspaper.js?v=form-only-notation-20261114'));
});
