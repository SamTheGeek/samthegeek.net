#!/usr/bin/env bash
# Push processed gallery images in batches and open a pull request.
#
# Usage: push-gallery-pr.sh <gallery> <branch>
#
# Required environment variables:
#   GH_TOKEN   - GitHub token with contents:write and pull-requests:write
#   PR_TITLE   - Pull request title
#   PR_BODY    - Pull request body (may be multi-line)
#
# Optional environment variables:
#   PR_LABELS      - Comma-separated label names to apply to the PR
#   BATCH_SIZE     - Number of files to commit per push (default: 50)
#   COMMIT_MESSAGE - Commit subject, minus the batch suffix
#                    (default: "chore: process <gallery> images")
#
# Exit codes:
#   0 - Success (changes pushed and PR created/updated, or no changes found)
#   1 - Missing required argument or environment variable

set -euo pipefail

GALLERY="${1:?Gallery name required}"
BRANCH="${2:?Branch name required}"
BATCH_SIZE="${BATCH_SIZE:-50}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: process $GALLERY images}"

# Verify required env vars
: "${PR_TITLE:?PR_TITLE environment variable required}"
: "${GH_TOKEN:?GH_TOKEN environment variable required}"

# Check for any changes at all
if git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No changes for gallery: $GALLERY"
  exit 0
fi

# Configure git identity for commits
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Create or reset the PR branch from current HEAD, preserving working tree changes
git checkout -B "$BRANCH"

# Collect all files to commit: modified tracked files + new untracked files
mapfile -t MODIFIED < <(git diff --name-only || true)
mapfile -t UNTRACKED < <(git ls-files --others --exclude-standard || true)
ALL_FILES=("${MODIFIED[@]+"${MODIFIED[@]}"}" "${UNTRACKED[@]+"${UNTRACKED[@]}"}")

TOTAL=${#ALL_FILES[@]}
if [ "$TOTAL" -eq 0 ]; then
  echo "No files to commit for gallery: $GALLERY"
  exit 0
fi

TOTAL_BATCHES=$(( (TOTAL + BATCH_SIZE - 1) / BATCH_SIZE ))
echo "Pushing $TOTAL files in $TOTAL_BATCHES batch(es) of up to $BATCH_SIZE"

BATCH=0
i=0
FIRST_PUSH=true

while [ "$i" -lt "$TOTAL" ]; do
  BATCH_END=$(( i + BATCH_SIZE < TOTAL ? i + BATCH_SIZE : TOTAL ))

  for (( j=i; j<BATCH_END; j++ )); do
    git add -- "${ALL_FILES[$j]}"
  done

  BATCH=$(( BATCH + 1 ))
  git commit -m "$COMMIT_MESSAGE [batch $BATCH/$TOTAL_BATCHES]"

  if [ "$FIRST_PUSH" = true ]; then
    # Force-push on first batch to overwrite any stale remote branch
    git push -u --force-with-lease origin "$BRANCH" || git push -u --force origin "$BRANCH"
    FIRST_PUSH=false
  else
    git push
  fi

  echo "Pushed batch $BATCH/$TOTAL_BATCHES (files $((i+1))-$BATCH_END of $TOTAL)"
  i=$BATCH_END
done

# Build gh pr create label arguments
LABEL_ARGS=()
if [ -n "${PR_LABELS:-}" ]; then
  IFS=',' read -ra LABELS <<< "$PR_LABELS"
  for label in "${LABELS[@]}"; do
    LABEL_ARGS+=(--label "$label")
  done
fi

# Create PR if one does not already exist for this branch
EXISTING_PR=$(gh pr list --head "$BRANCH" --base main --json number --jq '.[0].number' 2>/dev/null || echo "")
if [ -z "$EXISTING_PR" ]; then
  gh pr create \
    --title "$PR_TITLE" \
    --body "${PR_BODY:-}" \
    --base main \
    --head "$BRANCH" \
    "${LABEL_ARGS[@]+"${LABEL_ARGS[@]}"}"
  echo "Created PR for branch: $BRANCH"
else
  echo "PR #$EXISTING_PR already exists for branch: $BRANCH"
fi
