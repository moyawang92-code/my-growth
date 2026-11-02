#!/usr/bin/env bash
#
# Publish the built site to the gh-pages branch.
#
# Used instead of a GitHub Actions workflow so that deploying needs only the
# `repo` token scope, not `workflow`. Run it after any change you want live:
#
#   npm run deploy
#
set -euo pipefail

BRANCH="gh-pages"
WORKTREE=".gh-pages-worktree"

cd "$(dirname "$0")/.."

REPO_PATH=$(git remote get-url origin | sed -E 's#.*github.com[:/]##; s#\.git$##')
REPO_NAME=${REPO_PATH##*/}

echo "==> Building for /${REPO_NAME}/"
npm run build -- --base="/${REPO_NAME}/"

# GitHub Pages has no rewrite rules, so a deep link such as /calendar would
# 404. Serving index.html as 404.html lets the app boot and the router resolve
# the path client-side.
cp dist/index.html dist/404.html

echo "==> Publishing to ${BRANCH}"
rm -rf "$WORKTREE"
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git worktree add -q "$WORKTREE" "$BRANCH"
else
  git worktree add -q --detach "$WORKTREE"
  git -C "$WORKTREE" checkout -q --orphan "$BRANCH"
fi

# Clear tracked files but keep the worktree's own .git pointer. A fresh orphan
# branch still carries the source tree staged from the previous checkout, so
# removal has to be forced.
git -C "$WORKTREE" rm -rqf --ignore-unmatch .
cp -R dist/. "$WORKTREE"/
# Tells Pages to serve the files as-is rather than running them through Jekyll,
# which would strip paths beginning with an underscore.
touch "$WORKTREE/.nojekyll"

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "==> No changes to publish"
else
  git -C "$WORKTREE" commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
  git -C "$WORKTREE" push -q origin "$BRANCH"
  echo "==> Pushed to ${BRANCH}"
fi

git worktree remove --force "$WORKTREE"
echo "==> Done: https://${REPO_PATH%%/*}.github.io/${REPO_NAME}/"
