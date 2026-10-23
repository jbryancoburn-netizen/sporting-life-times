#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const scope={window:{},Date,Intl};runInNewContext(read('news-format.js'),scope);
const fmt=scope.window.SportingNewsFormat;
const story={source:'Heavy.com',published_at:'2026-10-23T11:18:37+00:00',title:'Lakers&#39; Luka Don&#269;i&#263; &amp; the Knicks',summary:'&#39;Test&#39; &nbsp;&nbsp; &amp; more &lt;b&gt;detail&lt;/b&gt;'};
assert.equal(fmt.meta(story),'Heavy.com · Oct 23, 7:18 AM ET');
assert.equal(fmt.title(story),'Lakers&#39; Luka Dončić &amp; the Knicks');
assert.equal(fmt.summary(story),'&#39;Test&#39; &amp; more detail');
assert.ok(!fmt.summary(story).includes('nbsp;'));
for(const js of ['app.js','nba-home.js','department-stories.js']){new Function(read(js));assert.match(read(js),/SportingNewsFormat/);}
for(const html of ['index.html','nba.html'])assert.match(read(html),/news-format.js/);
console.log('Clean newsroom format PASS: decoded entities, Eastern timestamps, escaped output, all desks wired.');
