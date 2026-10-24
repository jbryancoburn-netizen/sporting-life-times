#!/usr/bin/env python3
"""Embed a visible NBL Elo leaderboard in the built HTML.

The static GitHub Pages newspaper must not depend on mobile JavaScript cache to
show the already computed standings and research ratings. This pre-rendered table
is replaced by fresh JSON on capable clients; failure leaves a meaningful edition.
"""
import argparse, html, json, math
from pathlib import Path

ANCHOR='<div id="nbl-elo-table"></div>'
MARKER='data-nbl-static-elo="ready"'

def render(page, model):
    if ANCHOR not in page:
        raise ValueError("NBL Power Index HTML anchor not found")
    if page.count(ANCHOR)!=1:
        raise ValueError("NBL Power Index anchor is ambiguous")
    if model.get("status")!="RESEARCH_ONLY_UNCERTIFIED" or model.get("prediction_certified") is not False or model.get("production_approved") is not False:
        raise ValueError("Research Elo publication policy violated")
    rows=model.get("ratings")
    if not isinstance(rows,list) or len(rows)!=10:
        raise ValueError("NBL research table must contain all 10 teams")
    if [r.get("rank") for r in rows]!=list(range(1,11)):
        raise ValueError("NBL research ranks must be consecutive")
    if len(set(r.get("team") for r in rows))!=10:
        raise ValueError("Duplicate NBL clubs")
    for r in rows:
        if not isinstance(r.get("elo"),(int,float)) or not math.isfinite(r["elo"]):
            raise ValueError("Invalid Elo number")
        if type(r.get("wins"))!=int or type(r.get("losses"))!=int:
            raise ValueError("Invalid NBL record")
    games=model.get("current_regular_season_games")
    if type(games)!=int or games<1:
        raise ValueError("No regular-season games")
    cells=[]
    for r in rows:
        team=html.escape(r["team"],quote=True)
        cells.append('<tr><td>'+str(r["rank"])+'</td><th scope="row">'+team+'</th><td>'+
                     str(r["wins"])+'–'+str(r["losses"])+'</td><td>'+f'{r["elo"]:.1f}'+'</td></tr>')
    content=('<div id="nbl-elo-table" '+MARKER+'>'+
       '<p class="hub-small">Current game-based Elo ratings · '+str(games)+
       ' completed 2026–27 regular-season games · descriptive research, not certified forecasts.</p>'+
       '<div class="nba-current-table-wrap"><table class="nba-mini-table">'+
       '<thead><tr><th scope="col">Rank</th><th scope="col">Club</th><th scope="col">W–L</th><th scope="col">Elo</th></tr></thead>'+
       '<tbody>'+''.join(cells)+'</tbody></table></div></div>')
    return page.replace(ANCHOR,content)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--page',default='nbl.html')
    p.add_argument('--model',default='data/nbl-elo-research.json')
    a=p.parse_args()
    page=Path(a.page)
    result=render(page.read_text(),json.loads(Path(a.model).read_text()))
    page.write_text(result)
    print('Embedded all ten NBL research Elo rows in public HTML')

if __name__=='__main__':main()
