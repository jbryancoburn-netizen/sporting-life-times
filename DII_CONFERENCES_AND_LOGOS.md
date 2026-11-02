# DII conference pages and logo certification — staging checkpoint

## Implemented in staging
- `d2-mens-conferences.html` and `d2-womens-conferences.html` with a shared responsive newspaper style.
- `d2-conference.js` loads existing men/women JSON ledgers, generates conference selection, Elo-sorted team table, overall W–L/PCT and a game desk linking team and Gamefile pages.
- Both basketball front pages link to their conference pages.
- The table explicitly distinguishes overall records and provisional Elo sorting from official conference-only standings and tie-breaking.

## Outstanding logo release gate
Directly inspected 2026–27 staging men's and women's ledger metadata:
| Gender | Team records | Missing slug, missing/invalid color, or identical primary/secondary |
| Men | 301 | 49 |
| Women | 298 | 51 |
| Total | 599 | 100 |

These 100 are metadata exceptions, **not** necessarily 100 confirmed broken image requests; additionally, currently valid slug metadata does not prove that the remote SVG loads correctly. The existing all-page standard is exactly two concentric circular rings of two distinct verified school colors, centered unclipped logo with fallback. Audit remote SVG availability, add source-backed school aliases/colors, and verify on conference, home, team and Gamefile surfaces. Do not invent school colors, claim universal logos complete, or create unverified assets.

## Release hold
Conference pages and navigation are source commits, not browser-tested deployment. Run JavaScript and page tests; verify both pages with current published JSON in a browser; confirm every conference identity and home/away game link. Then conduct school logo audit and full independent schedule certification before the one tested squash merge to main. No workflow changes or paid services.
