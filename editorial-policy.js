/* Shared editorial standards for publisher feeds.
   Keep gambling/prediction-market tips and affiliate copy out of the newspaper.
   Reporting ABOUT regulation or business remains eligible when not a betting guide. */
(function(root){
  const brand=/\b(?:draftkings|betmgm|mgm bets?|fanduel|fanatics sportsbook|caesars sportsbook|bet365|kalshi|polymarket|prizepicks|underdog fantasy|hard rock bet|betr|betfair|pointsbet)\b/i;
  const offer=/\b(?:promo(?:tional)? codes?|bonus bets?|free bets?|first wager|wagering bonus|betting bonus|odds boosts?|sign.up bonus|deposit match|risk.free bet|new.user offer|sportsbook deals?)\b/i;
  const picks=/\b(?:betting odds|odds and picks|odds,? (?:picks|predictions)|first touchdown scorer|anytime touchdown scorer|player prop bets?|prop bet picks?|best bets?|betting picks?|parlay picks?|same.game parlay|sports betting picks?|prediction markets?|betting markets?|betting lines?|wagering tips?)\b/i;
  const guide=/\b(?:how to bet|where to bet|bet on (?:the|this|tonight)|place (?:your|a) bet|betting guide|betting preview|betting predictions|odds to win)\b/i;
  function isPromotion(a){
    const headline=String(a?.title||'');
    const summary=String(a?.summary||'');
    const url=String(a?.url||'');
    const text=[headline,summary,url].join(' ');
    const journalism=/\b(?:regulation|regulator|legislation|lawsuit|investigation|antitrust|earnings|financial results|fraud|ban(?:ned)?|court ruling|policy|congress)\b/i.test(headline);
    if(offer.test(text)||guide.test(text))return true;
    if(picks.test(headline)&&!journalism)return true;
    if(brand.test(headline)&&/\b(?:odds|picks?|predictions?|bet(?:s|ting)?|wager|bonus|markets?|promo)\b/i.test(text))return !journalism;
    if(picks.test(summary)&&/\b(?:odds|picks?|predictions?|bet(?:s|ting)?|wager|markets?)\b/i.test(headline))return !journalism;
    return false;
  }
  root.SportingEditorial={isPromotion};
})(window);
