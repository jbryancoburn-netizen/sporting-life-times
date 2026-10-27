# Public Ratings Engine — Initial Migration

The original, dependency-free soccer goals model is now maintained here in `public_ratings/soccer_goal_model.py`. It was transferred from the private Universal Sports Rating System repository without the research database replay component or third-party match data.

- The portable module implements Poisson score probabilities, optional Dixon–Coles low-score correction, and history-based goal-rate estimation.
- `tests/test_public_soccer_goal_model.py` uses **synthetic fixtures only**.
- `Public soccer rating engine integrity` tests this module on source changes and pull requests, without writing to the repository.
- **This is a tested public engine component, not a replacement for the live EPL or NCAA soccer production feeds.** Existing schedules, Elo outputs, published predictions, research databases, and private archives remain unchanged.

## Promotion safeguards

Before shifting any live computation into the public workflow: identify the exact data inputs and permissions; verify redistribution rights; run an identical input comparison against the existing model; compare probability distributions and ratings; prove fresh output reaches the newspaper; and establish a rollback path. Do not disable a private workflow until the public job is independently passing with correct outputs.
