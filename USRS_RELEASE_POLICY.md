# USRS release gate — locked decision

Decision date: 2026-10-22

## Status
**Implementation committed; production release NOT approved.** Do not describe the USRS project as finished or production-ready until the updated release decision is verified and the model meets the production readiness criteria below. This is a status gate, not a finding that the model is defective.

## Release requirements
1. Identify the exact implementation commit and data snapshot used in validation.
2. Execute and document reproducible tests for data integrity, leakage, determinism, and complete fixture coverage.
3. Validate against historical out-of-sample results and a documented baseline, with performance metrics and error analysis; do not invent results.
4. Verify that the model uses its own USRS calculations and approved source hierarchy; do not substitute third-party ratings.
5. Verify the updated release decision with recorded evidence and an explicit pass/fail outcome.
6. Confirm the production pipeline, monitoring, fallback behavior, and rollback procedure.

Until every criterion has documented evidence, label outputs **experimental / not production approved**. A passing code commit alone is not release approval. Do not repeatedly claim completion or change this status without verification.

## Engineering practice
Reuse the existing validation and workflow infrastructure. Prefer one reproducible automated release gate to repeated manual assurances. Record evidence and unresolved blockers in the repository.
