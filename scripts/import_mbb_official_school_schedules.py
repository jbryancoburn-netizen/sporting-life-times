#!/usr/bin/env python3
"""Enrich existing MBB calendars without replacing their verified game records.

The former importer rebuilt whole calendars from generic nested HTML elements.
It could import promotions as opponents and discard previously recovered fields.
This compatibility entry point now uses the exact-game, season-checked reader.
"""
import argparse,collections,concurrent.futures,datetime,json,pathlib,os
import mbb_complete_official_fields as official

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--limit',type=int,default=len(official.TEAMS))
 parser.add_argument('--workers',type=int,default=8)
 args=parser.parse_args()
 if args.limit<1 or args.workers<1:parser.error('limit and workers must be positive')
 selected=official.TEAMS[:args.limit]
 # New fixtures must pass the same named-opponent, date-collision, exhibition,
 # and conditional-round checks used by the manually verified recovery passes.
 os.environ['ADD_MISSING']='1'
 with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers,12)) as pool:
  results=list(pool.map(official.run,selected))
 report={'attempted_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Enrich exact official date/opponent matches; preserve existing records and all unannounced fields. No complete-calendar certification implied.','summary':{'schools_checked':len(results),'schools_with_readable_official_rows':sum(x['status']=='parsed' for x in results),'schools_changed':sum(x['fields']>0 for x in results),'fields_updated':sum(x['fields'] for x in results),'games_added':sum(x.get('games_added',0) for x in results),'statuses':dict(collections.Counter(x['status'] for x in results))},'results':results}
 path=official.DATA/'mbb-schedules-2026-27/official-school-sources-status.json'
 path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary'],indent=2))
 if not report['summary']['schools_with_readable_official_rows']:raise SystemExit('No official rows were readable; existing calendars were preserved')
if __name__=='__main__':main()
