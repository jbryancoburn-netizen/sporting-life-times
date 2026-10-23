#!/usr/bin/env python3
"""Extract compact auditable historical player/game CSVs from NCAA Parquet releases."""
import argparse
import csv
import gzip
import json
import io
from pathlib import Path
BOX=('contest_id','game_date','home','away','team','player','player_id',
     'home_ncaa_team_id','away_ncaa_team_id','team_ncaa_team_id',
     'mins','pts','fga','fta','season')
ROSTER=('season','team_id','team','player_id','player','clean_name','name','jersey')
SCHEDULE=('contest_id','game_date','home','away','home_score','away_score','season')
def extract(source,destination,required,allow_missing=()):
    import pyarrow.parquet as pq
    table=pq.ParquetFile(source)
    available=set(table.schema.names)
    missing=set(required)-available-set(allow_missing)
    if missing:raise ValueError(f'{source.name}: missing required columns {sorted(missing)}')
    cols=[c for c in required if c in available]
    destination.parent.mkdir(parents=True,exist_ok=True)
    count=0
    # A reproducible gzip stream: no generated mtime or destination filename
    # in the header, so reruns from identical Parquet source keep the SAME SHA.
    with destination.open('wb') as raw:
        with gzip.GzipFile(fileobj=raw,mode='wb',filename='',mtime=0,compresslevel=6) as compressed:
            with io.TextIOWrapper(compressed,encoding='utf-8',newline='') as f:
                writer=csv.DictWriter(f,fieldnames=required)
                writer.writeheader()
                for batch in table.iter_batches(batch_size=10000,columns=cols):
                    for row in batch.to_pylist():
                        writer.writerow({k:row.get(k) for k in required})
                        count+=1
    return {'source':str(source),'result':str(destination),'rows':count,
            'file_bytes':destination.stat().st_size,'columns':cols,
            'unavailable_optional':sorted(set(required)-available)}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',type=Path,default=Path('historical-data'))
    ap.add_argument('--out',type=Path,default=Path('historical-normalized'))
    args=ap.parse_args()
    out=[]
    for season in (2023,2024,2025,2026):
        for name,fields in [('player_box',BOX),('team_rosters',ROSTER),('schedule',SCHEDULE)]:
            filename=f'ncaa_mbb_{name}_{season}'
            out.append(extract(args.source/(filename+'.parquet'),args.out/(filename+'.csv.gz'),fields,
                               allow_missing=('player_id','clean_name','name','jersey') if name=='team_rosters' else ()))
    dest=args.out/'normalization_manifest.json'
    dest.write_text(json.dumps({'source':'NCAA/SportsDataverse','retrospective_roster_snapshots':True,
                                'preseason_timestamp_verified':False,'datasets':out},indent=2)+'\n')
    print(json.dumps({'datasets':len(out),'rows':sum(x['rows'] for x in out)},indent=2))
if __name__=='__main__':main()
