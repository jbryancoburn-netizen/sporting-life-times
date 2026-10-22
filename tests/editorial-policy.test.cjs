/* Regression tests for the newspaper's shared editorial screening.
   Run: node --test tests/editorial-policy.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('editorial-policy.js','utf8'),context,{filename:'editorial-policy.js'});
const isPromotion=context.window.SportingEditorial.isPromotion;
test('rejects gambling bonus and promo copy',()=>{
 for(const title of ['Use DraftKings promo code to land $200 bonus','BetMGM bonus bets for new users','Best sportsbook deals for NFL Sunday'])
  assert.equal(isPromotion({title}),true,title);
});
test('rejects prediction-market and betting picks',()=>{
 for(const title of ['Patriots vs. Bears odds, first touchdown scorer picks, predictions for NFL Week 7','Kalshi prediction markets for NFL games','Player prop bets and best bets for tonight'])
  assert.equal(isPromotion({title,summary:'We look over prediction markets at Kalshi'}),true,title);
});
test('rejects promotion hidden in summary or URL',()=>{
 assert.equal(isPromotion({title:'NFL Week 7 preview',summary:'Get free bets with a promo code'}),true);
 assert.equal(isPromotion({title:'Football betting guide',url:'https://example.org/article'}),true);
});
test('allows legitimate sports reporting',()=>{
 for(const title of ['Bears beat Packers in overtime','Indiana wins Big Ten championship','Tottenham announce new manager'])
  assert.equal(isPromotion({title,summary:'Match report and team analysis'}),false,title);
});
test('allows genuine reporting about betting regulation',()=>{
 assert.equal(isPromotion({title:'Congress opens investigation into Kalshi prediction markets',summary:'Lawmakers discuss regulation'}),false);
});
