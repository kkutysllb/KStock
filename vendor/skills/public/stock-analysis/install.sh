#!/bin/sh
# Install script for stock-analysis
set -e

echo "→ Installing stock-analysis..."

# Check Python
if ! command -v python3 > /dev/null 2>&1; then
    echo "  ⚠  Python 3 is required but not found."
    exit 1
fi

# Python dependencies are pre-installed in the built-in Python client
# (see SKILL.md frontmatter requires.packages for the authoritative list).

echo "  ✓  stock-analysis installed successfully."
echo ""
echo "  Environment variables needed:"
echo "    See SKILL.md frontmatter for details."
