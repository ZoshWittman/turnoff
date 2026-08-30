#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if command -v xcodegen >/dev/null 2>&1; then
  xcodegen generate
else
  python3 scripts/generate_xcodeproj.py
fi
echo "ParentLock.xcodeproj is ready."
