"""Original Florida 2020 census block plan comparisons must never become vote estimates."""
import unittest
from scripts.politics_fl_block_crosswalk import parse_block_file,compare_blocks,build,SOURCES

class FloridaBlockCrosswalkTests(unittest.TestCase):
    def test_real_legislative_headers_are_plain_15_digit_blocks(self):
        data=b"120010002011000,3\r\n120010002011001,3\r\n120010002011002,17\r\n"
        blocks,counts=parse_block_file(data,min_rows=3)
        self.assertEqual(blocks["120010002011002"],"17")
        self.assertEqual(counts["03"],2)

    def test_correctly_count_reassignments_without_inferring_votes(self):
        old={"120010002011000":"03","120010002011001":"03","120010002011002":"17"}
        new={"120010002011000":"03","120010002011001":"17","120010002011002":"17"}
        report=compare_blocks(old,new)
        self.assertEqual(report["total_2020_census_blocks"],3)
        self.assertEqual(report["blocks_assigned_to_different_numbered_district"],1)
        self.assertEqual(report["pct_blocks_assignment_changed_unweighted"],33.3333)
        self.assertEqual(len(report["districts_2026"]),28)
        self.assertTrue(all(x["presidential_2024_votes_on_2026_boundary"] is None for x in report["districts_2026"]))
        self.assertTrue(all(x["2026_district_vote_baseline_certified"] is False for x in report["districts_2026"]))

    def test_overlap_and_missing_blocks_fail_closed(self):
        old={"120010002011000":"03","120010002011001":"03"}
        new={"120010002011000":"03","120010002011002":"03"}
        with self.assertRaises(ValueError):compare_blocks(old,new)

    def test_duplicate_blocks_not_allowed_even_if_district_matches(self):
        with self.assertRaises(ValueError):
            parse_block_file(b"120010002011000,3\n120010002011000,3\n",min_rows=1)

    def test_non_florida_and_unsupported_districts_rejected(self):
        for line in (b"110010002011000,3\n",b"120010002011000,29\n",b"120010002011000,00\n",
                     b"120010002011000,3,unexpected\n",b"12001000201100,3\n"):
            with self.assertRaises(ValueError):parse_block_file(line,min_rows=1)

    def test_truncated_files_fail(self):
        with self.assertRaises(ValueError):parse_block_file(b"120010002011000,3\n")
        with self.assertRaises(ValueError):parse_block_file(b"bad\n",min_rows=1)

    def test_uncorroborated_source_hash_is_rejected(self):
        with self.assertRaises(ValueError):
            build(fetch=lambda _:b"120010002011000,3\n")
        self.assertEqual(set(SOURCES),{"2024","2026"})
        self.assertTrue(all(x["url"].startswith("https://edr.state.fl.us/Content/redistricting/") for x in SOURCES.values()))
if __name__=="__main__":unittest.main()
