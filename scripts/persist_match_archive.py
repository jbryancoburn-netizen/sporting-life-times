#!/usr/bin/env python3
"""Restore and persist the rolling Match Center archive on a dedicated Git branch.

The branch is deliberately outside main so scheduled data writes do not trigger
another site publishing workflow. GitHub Actions cache remains a speed optimization.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "match-center-archive"
ARCHIVE = "data/match_center_archive.json"


def git(*args, cwd=ROOT, check=True):
    return subprocess.run(["git", *args], cwd=cwd, check=check,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def fetch():
    return git("fetch", "--no-tags", "origin", f"refs/heads/{BRANCH}:refs/remotes/origin/{BRANCH}",
               check=False).returncode == 0


def restore():
    if not fetch():
        print("Durable archive branch not created yet; using cache/site recovery")
        return
    result = git("show", f"refs/remotes/origin/{BRANCH}:{ARCHIVE}", check=False)
    if result.returncode:
        raise RuntimeError("Durable archive branch exists but archive file is unreadable")
    saved = json.loads(result.stdout)
    if not isinstance(saved.get("games"), dict):
        raise ValueError("Durable archive branch contains invalid game map")
    destination = ROOT / ARCHIVE
    existing = {}
    if destination.exists():
        try:
            existing = json.loads(destination.read_text(encoding="utf-8")).get("games") or {}
        except (ValueError, OSError):
            pass
    games = dict(saved["games"])
    for key, record in existing.items():
        if key not in games and isinstance(record, dict):
            games[key] = record
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({"updated_at":saved.get("updated_at"), "games":games},
                                       ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Durable archive restored:", len(saved["games"]), "branch records;",
          len(games), "combined records")


def save():
    path = ROOT / ARCHIVE
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get("games"), dict):
        raise ValueError("Refusing to save invalid archive")
    existing_branch = fetch()
    with tempfile.TemporaryDirectory(prefix="match-center-branch-") as temp:
        worktree = Path(temp) / "worktree"
        if existing_branch:
            git("worktree", "add", "--detach", str(worktree), f"refs/remotes/origin/{BRANCH}")
        else:
            git("worktree", "add", "--detach", str(worktree), "HEAD")
        try:
            if not existing_branch:
                git("checkout", "--orphan", BRANCH, cwd=worktree)
                git("rm", "-rf", "--cached", ".", cwd=worktree)
            target = worktree / ARCHIVE
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            git("add", ARCHIVE, cwd=worktree)
            git("-c", "user.name=Sporting Life Times Bot",
                "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
                "commit", "-m", f"Preserve {len(data['games'])} Match Center game records",
                cwd=worktree, check=False)
            git("push", "origin", f"HEAD:refs/heads/{BRANCH}", cwd=worktree)
            print("Durable archive branch updated:", len(data["games"]), "records")
        finally:
            git("worktree", "remove", "--force", str(worktree), check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["restore", "save"])
    args = parser.parse_args()
    if args.command == "restore":
        restore()
    else:
        save()
