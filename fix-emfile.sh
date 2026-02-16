#!/bin/bash
# Fix EMFILE (too many open files) error on macOS
# This script increases the system file descriptor limits

echo "🔧 Fixing EMFILE error..."
echo ""

# Check current limits
echo "Current limits:"
launchctl limit maxfiles

echo ""
echo "Setting new limits..."

# Increase system-wide file limit (requires sudo)
sudo launchctl limit maxfiles 65536 200000

# Increase per-process limit for current session
ulimit -n 10240

echo ""
echo "New limits:"
launchctl limit maxfiles

echo ""
echo "✅ Done! Please restart your dev server:"
echo "   npm run dev"
