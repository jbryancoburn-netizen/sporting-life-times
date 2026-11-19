(() => {
'use strict';
const conferenceLogos={
  "America East":["America East Conference", "america_east"],
  "Atlantic Coast":["Atlantic Coast Conference", "acc"],
  "Atlantic 10":["Atlantic 10 Conference", "atlantic_10"],
  "Big East":["Big East Conference", "big_east"],
  "Big Sky":["Big Sky Conference", "big_sky"],
  "Big South":["Big South Conference", "big_south"],
  "Big Ten":["Big Ten Conference", "big_ten"],
  "Big 12":["Big 12 Conference", "big_12"],
  "Big West":["Big West Conference", "big_west"],
  "Coastal Athletic Association":["Coastal Athletic Association", "coastal"],
  "Conference USA":["Conference USA", "conference_usa"],
  "Ivy League":["Ivy League", "ivy"],
  "Metro":["Metro Conference", "metro"],
  "Mid-American":["Mid-American Conference", "mid_american"],
  "Mid-Eastern Athletic":["Mid-Eastern Athletic Conference", "meac"],
  "Missouri Valley":["Missouri Valley Conference", "missouri_valley"],
  "Northeast":["Northeast Conference", "northeast"],
  "Ohio Valley":["Ohio Valley Conference", "ohio_valley"],
  "Pac-12":["Pac-12 Conference", "pac_12"],
  "Patriot League":["Patriot League", "patriot_league"],
  "Southeastern":["Southeastern Conference", "sec"],
  "Southern":["Southern Conference", "southern"],
  "Southland":["Southland Conference", "southland"],
  "Southwestern Athletic":["Southwestern Athletic Conference", "swac"],
  "Sun Belt":["Sun Belt Conference", "sun_belt"],
  "West Coast":["West Coast Conference", "west_coast"],
  "United Athletic":["United Athletic Conference", "uac"],
  "Mountain West":["Mountain West Conference", "mountain_west"],
  "Horizon League":["Horizon League", "horizon"],
  "Atlantic Sun":["Atlantic Sun Conference", "atlantic_sun"],
  "Summit League":["Summit League", "summit_league"],
  "American":["American Conference", "american"],
};
const conferenceAliases={"ACC": "Atlantic Coast", "AAC": "American", "ASUN": "Atlantic Sun", "CAA": "Coastal Athletic Association", "C-USA": "Conference USA", "Horizon": "Horizon League", "MAC": "Mid-American", "MEAC": "Mid-Eastern Athletic", "MVC": "Missouri Valley", "MWC": "Mountain West", "NEC": "Northeast", "OVC": "Ohio Valley", "Patriot": "Patriot League", "SEC": "Southeastern", "SoCon": "Southern", "SWAC": "Southwestern Athletic", "UAC": "United Athletic", "WCC": "West Coast"};
const key = value => {
 const name = String(value || '').replace(/ Conference$/, '');
 return conferenceAliases[name] || name;
};
window.SLTConferenceMarks = {
 key,
 lookup(value) {
  const entry = conferenceLogos[key(value)];
  return entry ? {name:entry[0], url:'https://a.espncdn.com/i/teamlogos/ncaa_conf/500/'+entry[1]+'.png'} : null;
 },
 header(value) {
  const mark = this.lookup(value);
  return mark ? '<img class="slt-conference-crest" src="'+mark.url+'" alt="'+mark.name+'">' : '';
 }
};
})();
