#!/usr/bin/env python3
"""MEDSL historical results desk; independent computation, never a 2026 prediction.

Historical data via electiondata.dev's MIT Election Data + Science Lab CC0 tables:
  https://electiondata.dev/datasets/house-results/
  https://electiondata.dev/datasets/senate-results/
Rows with no numeric votes are not silently imputed.
"""
from __future__ import annotations
import collections
import datetime as dt
import json
import math
import pathlib
import statistics
import sys
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"politics-history.json"
YEARS=(2018,2020,2022,2024)
URL_ROOT="https://api.electiondata.dev/v1"
UTC=dt.timezone.utc
SOURCE="MIT Election Data and Science Lab (MEDSL), via electiondata.dev"
CREDIT_HOUSE="MIT Election Data and Science Lab, 2017, U.S. House 1976–2024, Harvard Dataverse V15, https://doi.org/10.7910/DVN/IG0UN2"
CREDIT_SENATE="MIT Election Data and Science Lab, 2017, U.S. Senate statewide 1976–2024, Harvard Dataverse V8, https://doi.org/10.7910/DVN/PEJ5QU"

def flag(value):
    if isinstance(value,bool):return value
    return str(value).strip().lower() in ("true","1","yes")

def number(value):
    if value is None or value=="":return None
    try:
        v=int(float(value))
        return v if v>=0 else None
    except (ValueError,TypeError,OverflowError):
        return None

def classify(raw):
    value=str(raw or "").upper().strip().replace("_"," ").replace("-"," ")
    if value in ("DEMOCRAT","DEMOCRATIC","DEMOCRATIC PARTY","DEMOCRATIC FARMER LABOR","DFL","DEM"):return "D"
    if value in ("REPUBLICAN","REPUBLICAN PARTY","GOP","REP"):return "R"
    return "O"

def load_year(chamber,year):
    url=f"{URL_ROOT}/{chamber}-results/table/{year}.json"
    req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"Political-Life-and-Times/1.0 (source attribution)"})
    with urllib.request.urlopen(req,timeout=34) as response:
        if response.status!=200:raise ValueError(f"HTTP {response.status} for {chamber} {year}")
        raw=response.read(15_000_001)
        if len(raw)>15_000_000:raise ValueError(f"Dataset too large: {chamber} {year}")
    obj=json.loads(raw)
    if isinstance(obj,dict):rows=obj.get("rows")
    elif isinstance(obj,list):rows=obj
    else:rows=None
    if not isinstance(rows,list) or len(rows)<(200 if chamber=="house" else 25):
        raise ValueError(f"No usable {chamber} data for {year}: {type(rows)} {len(rows) if isinstance(rows,list) else '?'}")
    if not all(isinstance(row,dict) for row in rows):
        raise ValueError(f"{chamber} rows are not objects")
    return rows

def collate(rows,chamber,year):
    grouped=collections.defaultdict(list)
    unofficial=0
    for row in rows:
        if number(row.get("year"))!=year:continue
        if str(row.get("stage") or "").strip().upper() not in ("GEN","GENERAL"):continue
        if flag(row.get("special")):continue
        if flag(row.get("runoff")):continue
        state=str(row.get("state_po") or "").upper().strip()
        if not len(state)==2:continue
        if flag(row.get("unofficial")):unofficial+=1
        if chamber=="house":
            district=number(row.get("district"))
            if district is None:continue
            key=f"{state}-{district:02d}"
        else:
            key=state
        grouped[key].append(row)
    contests=[]
    skipped={"missing_votes":0,"ambiguous_candidates":0,"missing_party":0}
    for key,items in sorted(grouped.items()):
        # Select one candidate record per name. MEDSL stores fusion ticket lines;
        # candidate_total_votes includes all lines, avoid double counting.
        candidates={}
        for row in items:
            candidate=str(row.get("candidate") or "").strip().upper()
            if not candidate or candidate=="WRITEIN":continue
            party=classify(row.get("party") if chamber=="house" else row.get("party_simplified"))
            if chamber=="house" and party=="O" and row.get("party") is None:
                skipped["missing_party"]+=1
            vote=number(row.get("candidate_total_votes"))
            if vote is None:vote=number(row.get("candidatevotes"))
            if vote is None:continue
            normalized=candidate.replace(" ","")
            previous=candidates.get(normalized)
            next_candidate={"name":candidate,"party":party,"votes":vote,"fusion":flag(row.get("fusion_ticket"))}
            if previous is None or (previous["fusion"] and not next_candidate["fusion"]) or (previous["party"]=="O" and next_candidate["party"] in ("D","R")):
                candidates[normalized]=next_candidate
            elif vote>previous["votes"] and previous["party"]==next_candidate["party"]:
                candidates[normalized]=next_candidate
        candidates=list(candidates.values())
        if not candidates or sum(x["votes"] for x in candidates)==0:
            skipped["missing_votes"]+=1;continue
        # If multiple records represent the same party's candidates (jungle, top-two
        # primaries) sum votes by party, but do not count winning party from vote sum:
        # the highest vote-getting individual candidate is the contest winner.
        parties=collections.Counter()
        for row in candidates:
            parties[row["party"]]+=row["votes"]
        d,r=parties["D"],parties["R"]
        top=max(candidates,key=lambda v:v["votes"])
        two_party=d+r
        contests.append({"id":key,"state":key[:2],"district":number(key[3:]) if chamber=="house" else None,
                         "party_winner":top["party"],"winner_name":top["name"],
                         "dem_votes":d,"rep_votes":r,"other_votes":parties["O"],
                         "total_votes":sum(parties.values()),"two_party_margin":round(100*(d-r)/two_party,2) if d>0 and r>0 else None,
                         "both_major_parties":bool(d>0 and r>0)})
    return contests,{"input_rows":len(rows),"unofficial_rows":unofficial,"skipped":skipped,
                      "valid_contests":len(contests),"two_party_contests":sum(c["both_major_parties"] for c in contests)}

def describe(contests,year,chamber,quality):
    votes_d=sum(c["dem_votes"] for c in contests)
    votes_r=sum(c["rep_votes"] for c in contests)
    winner_counts=collections.Counter(c["party_winner"] for c in contests)
    denom=votes_d+votes_r
    return {"year":year,"chamber":chamber,"contests":len(contests),
            "dem_wins":winner_counts["D"],"rep_wins":winner_counts["R"],"other_wins":winner_counts["O"],
            "dem_votes":votes_d,"rep_votes":votes_r,
            "dem_two_party_share":round(100*votes_d/denom,2) if denom else None,
            "dem_margin_pp":round(100*(votes_d-votes_r)/denom,2) if denom else None,
            "data_quality":quality}

def baseline_check(earlier,later,first_year,second_year):
    a={x["id"]:x for x in earlier if x["two_party_margin"] is not None}
    b={x["id"]:x for x in later if x["two_party_margin"] is not None}
    matches=sorted(set(a)&set(b))
    errors=[]
    flips=0
    for key in matches:
        prev=a[key]["two_party_margin"]
        current=b[key]["two_party_margin"]
        errors.append(abs(current-prev))
        if (prev>0)!=(current>0):flips+=1
    return {"training_year":first_year,"test_year":second_year,
            "sample_size":len(errors),
            "mean_absolute_margin_error":round(statistics.mean(errors),2) if errors else None,
            "median_absolute_margin_error":round(statistics.median(errors),2) if errors else None,
            "sign_changes":flips,
            "interpretation":"Lagged district margin arithmetic benchmark only. Same district ID does not prove same district boundaries; map changes and contestedness are unverified. Not a calibrated election model."}


def experimental_holdout(train_before,train_after,test_before,test_after):
    """Train a small, regularized lagged-margin logistic model ONLY on 2018->2020.
    Evaluate on 2022->2024; no validation of district-boundary continuity yet.
    This is an EXPERIMENTAL diagnostic, never a 2026 win probability.
    """
    def sample(first,second):
        prev={x["id"]:x for x in first if x.get("two_party_margin") is not None and x.get("party_winner") in ("D","R")}
        nxt={x["id"]:x for x in second if x.get("two_party_margin") is not None and x.get("party_winner") in ("D","R")}
        return [(prev[k]["two_party_margin"]/10.0, 1.0 if nxt[k]["party_winner"]=="D" else 0.0)
                for k in sorted(set(prev)&set(nxt))]
    train=sample(train_before,train_after)
    test=sample(test_before,test_after)
    if len(train)<100 or len(test)<100 or len({y for x,y in train})<2:
        raise ValueError("Insufficient separate training and holdout cycles for experimental model")
    a,b=0.0,0.0
    reg=0.025
    def sigmoid(z):
        return 1.0/(1+math.exp(-max(-30,min(30,z))))
    for _ in range(1800):
        gradient_a=sum(sigmoid(a+b*x)-y for x,y in train)/len(train)
        gradient_b=sum((sigmoid(a+b*x)-y)*x for x,y in train)/len(train)+reg*b
        a-=0.045*gradient_a
        b-=0.045*gradient_b
    predicted=[sigmoid(a+b*x) for x,y in test]
    observed=[y for x,y in test]
    brier=statistics.mean((p-y)**2 for p,y in zip(predicted,observed))
    base_rate=statistics.mean(y for x,y in train)
    baseline_brier=statistics.mean((base_rate-y)**2 for y in observed)
    absolute_votes=statistics.mean(abs(p-y) for p,y in zip(predicted,observed))
    bins=[]
    for index in range(5):
        entries=[(p,y) for p,y in zip(predicted,observed) if (index/5)<=p<=((index+1)/5 if index==4 else (index+1)/5-1e-12)]
        bins.append({"from":index*20,"to":(index+1)*20,"count":len(entries),
                     "mean_probability":round(statistics.mean(p for p,y in entries),3) if entries else None,
                     "realized_win_rate":round(statistics.mean(y for p,y in entries),3) if entries else None})
    return {"status":"experimental_holdout_only","training_period":"2018 House -> 2020 House",
        "test_period":"2022 House -> 2024 House","training_samples":len(train),"test_samples":len(test),
        "model":"L2-regularized logistic regression, predictor = previous election's two-party district margin / 10",
        "intercept":round(a,5),"margin_coefficient":round(b,5),
        "holdout_brier_score":round(brier,4),
        "unconditional_baseline_brier_score":round(baseline_brier,4),
        "holdout_mean_absolute_probability_error":round(absolute_votes,4),
        "calibration_bins":bins,
        "uncertainty_flags":["Train/holdout are different cycles; does not prove generalizability to 2026.",
             "District boundary changes and candidate incumbency are NOT accounted for.",
             "Uncontested and missing-vote districts are excluded and must be audited.",
             "House races have correlated election-year errors; independent race draws would misstate chamber-control probabilities.",
             "No simulated 2026 seat counts or election probabilities are authorized by this diagnostic."],
        "forecast_2026_certified":False,"backtest_certified":False}

def build(loader=load_year,now=None):
    now=now or dt.datetime.now(UTC)
    output={"status":"awaiting_verified_history","updated_at":now.isoformat(timespec="seconds"),
            "attribution":SOURCE,"data_license":"CC0 1.0",
            "sources":{"house":CREDIT_HOUSE,"senate":CREDIT_SENATE},
            "years":list(YEARS),"house":[],"senate":[],"historical_house_baselines":[],
            "closest_house_2024":[],"coverage":{},"warnings":[],"backtest_certified":False,
            "forecast_2026_certified":False}
    house={}
    for chamber in ("house","senate"):
        years={}
        for year in YEARS:
            rows=loader(chamber,year)
            contests,quality=collate(rows,chamber,year)
            # 2024 House should have >425 distinct seats and 2018 etc likewise.
            min_contests=425 if chamber=="house" else 24
            if len(contests)<min_contests:
                raise ValueError(f"Insufficient historical coverage {chamber} {year}: {len(contests)} < {min_contests}")
            years[year]=contests
            output[chamber].append(describe(contests,year,chamber,quality))
        if chamber=="house":house=years
        output["coverage"][chamber]={str(year):len(items) for year,items in years.items()}
    for first,second in ((2018,2020),(2022,2024)):
        output["historical_house_baselines"].append(baseline_check(house[first],house[second],first,second))
    output["experimental_holdout"]=experimental_holdout(house[2018],house[2020],house[2022],house[2024])
    output["closest_house_2024"]=sorted(
        ({"id":x["id"],"state":x["state"],"dem_margin_pp":x["two_party_margin"],
          "2024_winner_party":x["party_winner"],"2024_winner_name":x["winner_name"]}
         for x in house[2024] if x["both_major_parties"]),
        key=lambda x:abs(x["dem_margin_pp"]))[:18]
    output["warnings"]=[
      "These are HISTORICAL election returns, not 2026 forecasts or 2026 district ratings.",
      "National vote share is a derived two-party tally of MEDSL candidate votes; races with unreported votes are omitted, not guessed.",
      "MEDSL candidate labels and fusion votes are normalized; any unverified races, districts and sources remain disclosed in data_quality.",
      "The 2018→2020 and 2022→2024 same-ID margin baselines have NOT been certified for boundary changes or uncontested races. Do not use them as predictive calibration."
    ]
    output["status"]="ok"
    return output

def main():
    try:result=build()
    except (ValueError,TimeoutError,OSError,json.JSONDecodeError) as error:
        print("Historical ingestion failed; existing published file retained:",error,file=sys.stderr)
        return 1
    OUTPUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Historical results published:",result["coverage"],"baseline=",result["historical_house_baselines"])
    return 0

if __name__=="__main__":sys.exit(main())
