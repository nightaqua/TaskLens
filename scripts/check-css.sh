#!/bin/bash
# Check that src/styles.css contains no `cursor: pointer` rules.
# Obsidian convention: interactive elements use the default cursor; pointer is reserved
# for hyperlinks. See commit 6aa13ca for context.
set -euo pipefail

CSS_FILE="src/styles.css"
PATTERN='cursor[[:space:]]*:[[:space:]]*pointer'

if grep -En "$PATTERN" "$CSS_FILE"; then
    echo ""
    echo "ERROR: cursor: pointer found in $CSS_FILE (pointer is reserved for links)."
    echo "Use the default cursor on interactive elements."
    exit 1
fi

echo "CSS check passed: no cursor: pointer in $CSS_FILE"
