import copy,datetime as dt,unittest
from publish_college_soccer_dynamic import predict,poisson_draw,rates,prior_state,build
from college_soccer_fixture_source import fetch_scoreboards_with_audit

class DynamicPublisherTests(unittest.TestCase):
    def test_known_final_cannot_receive_new_prediction(self):
        b,source,clock=self.fixture()
        final={'match_id':'men-1','gender':'men','date':'2026-10-24','home_team':'a','away_team':'b','home_goals':2,'away_goals':0}
        self.assertEqual(build(b,[final],source,[],clock)[0],[])

    def test_cancelled_fixture_cannot_receive_prediction(self):
        b,source,clock=self.fixture()
        for state in ('cancelled','postponed','final','live','unknown',''):
            source['men-d1'][0]['game']['gameState']=state
            self.assertEqual(build(b,[],source,[],clock)[0],[])

    def test_partial_schedule_failure_is_explicit(self):
        def getter(url):
            if '/soccer-women/d2/' in url:raise OSError('source unavailable')
            return {'games':[{'source':url}]}
        source,errors=fetch_scoreboards_with_audit(dt.datetime.fromisoformat('2026-10-24T12:00:00+00:00'),getter)
        self.assertEqual(len(errors),3)
        self.assertEqual(source['women-d2'],[])
        self.assertEqual(len(source['men-d1']),3)

    def fixture(self):
        goal={'matches':10,'home_goals':15,'away_goals':10,'teams':{'a':{'home_n':5,'home_gf':8,'home_ga':3},'b':{'away_n':5,'away_gf':4,'away_ga':9}}}
        bundle={'goal_as_of':'2026-10-22','goals':{'men-d1':goal},
         'shadow':{'as_of':'2026-10-22','cohorts':{'men-d1':[{'team_id':'a','elo':1500},{'team_id':'b','elo':1500}]},
          'params':{'men-d1':{'home':50,'k':40,'goal_margin':.15}}},
         'calibration':{'status':'research_only','training_cutoff':'2026-10-01','cohorts':{'men-d1':{'coefficients':[-.2,.7,-.4]}}}}
        source={'men-d1':[{'game':{'gameID':'1','gameState':'pre','startDate':'10/24/2026','startTime':'4:00 PM ET',
                      'home':{'names':{'seo':'a','short':'Alpha'}},'away':{'names':{'seo':'b','short':'Beta'}}}}]}
        return bundle,source,dt.datetime.fromisoformat('2026-10-24T12:00:00+00:00')

    def test_poisson_known_diagonal(self):
        self.assertAlmostEqual(poisson_draw(1,1),.308508322553671,12)

    def test_normalized_and_symmetric(self):
        for p in (.01,.2,.5,.8,.99):
            r=predict(p,1,2,[-.2,.7,-.4]);op=predict(1-p,2,1,[-.2,.7,-.4])
            self.assertAlmostEqual(sum(r[k] for k in ('p_home','p_draw','p_away')),1)
            self.assertAlmostEqual(r['p_draw'],op['p_draw']);self.assertAlmostEqual(r['p_home'],op['p_away'])

    def test_draw_varies_with_matchup_and_scoring(self):
        self.assertGreater(predict(.5,1,1,[-.2,.7,-.4])['p_draw'],predict(.95,1,1,[-.2,.7,-.4])['p_draw'])
        self.assertGreater(predict(.5,1,1,[-.2,.7,-.4])['p_draw'],predict(.5,3,3,[-.2,.7,-.4])['p_draw'])

    def test_goal_rates_match_venue_prior_formula(self):
        b,_,_=self.fixture();h,a=rates(b['goals']['men-d1'],'a','b')
        self.assertAlmostEqual(h,1.5*((8+8*1.5)/13/1.5)*((9+8*1.5)/13/1.5))
        self.assertAlmostEqual(a,1*((4+8)/13)*((3+8)/13))

    def test_final_applied_once_and_prior_day_only(self):
        b,_,_=self.fixture();g={'match_id':'men-9','gender':'men','date':'2026-10-23','home_team':'a','away_team':'b','home_goals':2,'away_goals':0}
        ratings,goals=prior_state(b,[g],'2026-10-24')
        self.assertEqual(goals['men-d1']['matches'],11);self.assertGreater(ratings['men-d1']['a'],1500)
        self.assertEqual(prior_state(b,[g],'2026-10-23'),prior_state(b,[],'2026-10-23'))
        with self.assertRaises(ValueError):prior_state(b,[g,g],'2026-10-24')

    def test_immutable_forecasts_and_inputs(self):
        b,src,clock=self.fixture();before=copy.deepcopy((b,src))
        rows,new=build(b,[],src,[],clock);original=copy.deepcopy(rows)
        b['shadow']['cohorts']['men-d1'][0]['elo']=1800
        again,added=build(b,[],src,rows,clock)
        self.assertEqual(again,original);self.assertEqual(added,[]);self.assertEqual(rows,original)
        self.assertEqual(src,before[1]);self.assertEqual(len(new),1)

    def test_late_forecast_declined(self):
        b,src,clock=self.fixture();rows,_=build(b,[],src,[],clock+dt.timedelta(hours=24))
        self.assertEqual(rows,[])

    def test_uncertain_time_and_future_rating_declined(self):
        b,src,clock=self.fixture();src['men-d1'][0]['game']['startTime']='TBA'
        self.assertEqual(build(b,[],src,[],clock)[0],[])
        b,src,clock=self.fixture();b['shadow']['as_of']='2026-10-24'
        self.assertEqual(build(b,[],src,[],clock)[0],[])

if __name__=='__main__':unittest.main()
