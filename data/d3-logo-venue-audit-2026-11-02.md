# DIII 2026-27 logo, fixtures, arena and location audit

Repository source inspection 2026-11-02. Counts are per published official fixture and represent **missing fields**, not proof that an arena does not exist.

| Dimension | Men's DIII | Women's DIII |
|---|---:|---:|
| NCAA member programs | 406 | 415 |
| Team entries with logo URL | 0 | 0 |
| Team entries with NCAA logo slug | 0 | 0 |
| Entries with primary color | 0 | 0 |
| Entries with secondary color | 0 | 0 |
| Entries with hometown city | 0 | 0 |
| Unique fixture IDs | 4,367 | 4,494 |
| Missing arena name | 2,202 | 2,299 |
| Missing venue location | 79 | 93 |
| Missing tipoff text | 111 | 77 |
| Source disagreements on location/home side | 55 | 36 |

## Root cause: emblems
The browser emblem uses team.slug to call the public NCAA image service, else falls back to an ESPN CDN URL. Neither slug nor ESPN URL is populated for any of the 821 program records. School colors and color source are likewise empty, so the double-ring branded logo state is never activated. **Do not invent slugs, logos, or school colors.** Introduce a member-org-ID keyed official NCAA logo slug crosswalk with independently verified image availability and provenance; store two verified distinct school colors per school. The shared team assets should be reused between women's and men's programs with matching NCAA org ID.

## Schedule and arena release requirements
1. Every NCAA-confirmed school gets a source status: full school source, conference source, opponent-only evidence, or unresolved. A source responding successfully does not itself certify that all games are present.
2. Game identity is gender/date/unordered pair. Keep one game per identity, preserve source evidence, venue, and time. Never invent scores, outcomes, home/away, or local time zones.
3. For all home games missing arena names, consult the actual hosting school's season schedule and athletics facilities page. Distinguish an on-campus default facility from a specific neutral or tournament venue. Do not bulk-fill an arena based solely on the home institution.
4. For missing location, retain honest `LOCATION NOT VERIFIED` until a first-party university or conference source confirms it.
5. Every game with conflicting home/away reports remains matchup-only until resolved independently.
6. Export a machine-readable per-school exception queue sorted by missing home venue count, location count, and source conflicts, including NCAA org IDs and official-source URLs.
7. Publishing must assert `fixture_count === fixtures.length`, every deterministic fixture ID unique, and (date, unordered opponent pair) unique before GitHub Pages deployment.

## Immediate website correction
The shared DIII renderer now explicitly labels absent arena/location as unverified instead of quietly omitting the fields. This is a presentation-level safeguard, not a claim that the underlying source data is complete.
