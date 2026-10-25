#!/usr/bin/env python3
"""Small deterministic safety regression for cross-season athlete reconciliation."""
import unittest
from reconcile_ncaam_players import reconcile

def box(name,school,player_id=""):
 return {"player":name,"team":school,"player_id":player_id,"mins":"20"}

class IdentityReconciliationTest(unittest.TestCase):
 def test_unique_name_transfer(self):
  matches,counts,details=reconcile([{"player":"A. Smith","team":"Florida","player_id":""}],[box("A Smith","Liberty")])
  self.assertEqual(counts["matched_unique_name"],1)
  self.assertEqual(details[0]["prior_school"],"liberty")
  self.assertEqual(len(matches),1)
 def test_ambiguous_name_rejected(self):
  _,counts,_=reconcile([{"player":"John Brown","team":"Florida"}],
     [box("John Brown","UCF"),box("John Brown","Miami")])
  self.assertEqual(counts["ambiguous_same_name_multiple_schools"],1)
 def test_same_name_identifiable_id(self):
  _,counts,d=reconcile([{"player":"John Brown","team":"Florida","player_id":"id2"}],
     [box("John Brown","UCF","id1"),box("John Brown","Miami","id2")])
  self.assertEqual(counts["matched_name_and_source_id"],1)
  self.assertEqual(d[0]["prior_school"],"miami")
 def test_id_name_disagreement_rejected(self):
  _,counts,_=reconcile([{"player":"John Brown","team":"Florida","player_id":"id2"}],
     [box("John Brown","UCF","id1"),box("Jack Brown","Miami","id2")])
  self.assertEqual(counts["matched_unique_name"],1) # only named John evidence
 def test_no_history_not_labeled_freshman(self):
  _,counts,_=reconcile([{"player":"Incoming Player","team":"Florida"}],[box("Someone Else","Miami")])
  self.assertEqual(counts["unmatched_no_previous_box"],1)
 def test_all_roster_players_accounted_once(self):
  _,counts,details=reconcile([{"player":"John Brown","team":"Florida"},
    {"player":"John Brown","team":"Florida"},{"player":"Freshman","team":"Florida"}],
    [box("John Brown","UCF")])
  self.assertEqual(sum(counts.values()),2)
  self.assertEqual(len(details),2)

if __name__=="__main__":unittest.main()
