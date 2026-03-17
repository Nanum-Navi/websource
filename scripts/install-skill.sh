#!/usr/bin/env bash
# Installs websource and franchise Claude Code skills to ~/.claude/skills/
# Usage: bash scripts/install-skill.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS=("websource" "franchise")

for skill in "${SKILLS[@]}"; do
  SKILL_SRC="$PROJECT_DIR/skills/$skill/SKILL.md"
  SKILL_DST="$HOME/.claude/skills/$skill/SKILL.md"

  if [[ ! -f "$SKILL_SRC" ]]; then
    echo "SKIP: $SKILL_SRC not found"
    continue
  fi

  mkdir -p "$(dirname "$SKILL_DST")"
  cp "$SKILL_SRC" "$SKILL_DST"

  # Cross-platform sed in-place replacement
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|/path/to/websource|$PROJECT_DIR|" "$SKILL_DST"
  else
    sed -i "s|/path/to/websource|$PROJECT_DIR|" "$SKILL_DST"
  fi

  echo "Installed: $SKILL_DST"
done

echo "PROJECT_DIR set to: $PROJECT_DIR"
