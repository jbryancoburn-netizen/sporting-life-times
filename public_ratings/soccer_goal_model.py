"""Zero-dependency Poisson soccer model with leak-safe walk-forward fitting.

All fitted parameters are computed only from games finalized before kickoff.
League-specific attack/defence shrinkage prevents tiny-sample overconfidence.
"""
from math import exp, factorial, log


def poisson_probs(lam, cap=12):
    if not 0 < lam < 20: raise ValueError('Invalid goal intensity')
    probs=[exp(-lam)]
    for k in range(1,cap): probs.append(probs[-1]*lam/k)
    probs.append(max(0.,1-sum(probs))) # last bucket >= cap, never silently discard mass
    return probs


def score_distribution(home_goals, away_goals, cap=12, rho=0.):
    """Independent Poisson; optional Dixon-Coles correction to cells 0/1.
    rho must yield nonnegative four corrected probabilities.
    Last bucket represents cap or more goals.
    """
    h=poisson_probs(home_goals,cap);a=poisson_probs(away_goals,cap)
    grid=[[x*y for y in a] for x in h]
    if rho:
        factors={(0,0):1-home_goals*away_goals*rho,(0,1):1+home_goals*rho,
                 (1,0):1+away_goals*rho,(1,1):1-rho}
        if min(factors.values())<0:raise ValueError('Invalid Dixon-Coles rho')
        for (i,j),v in factors.items():grid[i][j]*=v
    norm=sum(map(sum,grid));grid=[[p/norm for p in row] for row in grid]
    win=sum(grid[i][j] for i in range(len(grid)) for j in range(len(grid)) if i>j)
    draw=sum(grid[i][i] for i in range(len(grid)))
    loss=1-win-draw
    return {'p_home':win,'p_draw':draw,'p_away':loss,'grid':grid,
            'expected_home':home_goals,'expected_away':away_goals,
            'over_2_5':sum(grid[i][j] for i in range(len(grid)) for j in range(len(grid)) if i+j>2),
            'btts':sum(grid[i][j] for i in range(1,len(grid)) for j in range(1,len(grid)))}


def fit_rates(history, home_id, away_id, prior_games=8, min_rate=.15,max_rate=5., league_prior_matches=0):
    """Empirical-Bayes goals for/against rates; uses league prior and partial pooling.
    history must be a single competition's previously finalized games.
    """
    if prior_games<=0:raise ValueError('prior_games must be positive')
    if league_prior_matches<0:raise ValueError('league_prior_matches cannot be negative')
    # Normalize both supported venue encodings to actual home/away orientation.
    # home=-1 means team b hosts; dropping these games silently biased rates.
    home_matches=[]
    for g in history:
        if g['home']==1:
            home_matches.append(g)
        elif g['home']==-1:
            home_matches.append({**g,'a':g['b'],'b':g['a'],
                                 'sa':g['sb'],'sb':g['sa'],'home':1})
    # Home/away split is learned only from explicit venue-coded matches.
    if home_matches:
        avg_home=(sum(g['sa'] for g in home_matches)+league_prior_matches*1.45)/(len(home_matches)+league_prior_matches)
        avg_away=(sum(g['sb'] for g in home_matches)+league_prior_matches*1.15)/(len(home_matches)+league_prior_matches)
    else:avg_home,avg_away=1.45,1.15 # documented cold-start assumptions, not learned
    avg_home=max(.2,avg_home);avg_away=max(.2,avg_away)
    hf=ha=af=aa=0.;nh=na=0
    for g in home_matches:
        if g['a']==home_id: hf+=g['sa'];ha+=g['sb'];nh+=1
        if g['b']==away_id: af+=g['sb'];aa+=g['sa'];na+=1
    h_att=(hf+prior_games*avg_home)/(nh+prior_games)/avg_home
    h_def=(ha+prior_games*avg_away)/(nh+prior_games)/avg_away
    a_att=(af+prior_games*avg_away)/(na+prior_games)/avg_away
    a_def=(aa+prior_games*avg_home)/(na+prior_games)/avg_home
    lam_h=max(min_rate,min(max_rate,avg_home*h_att*a_def))
    lam_a=max(min_rate,min(max_rate,avg_away*a_att*h_def))
    return lam_h,lam_a,{'prior_home_goals':avg_home,'prior_away_goals':avg_away,
                         'home_samples':nh,'away_samples':na,'prior_games':prior_games}

