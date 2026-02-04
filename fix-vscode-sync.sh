#!/bin/bash

# VS Code File Sync Issue - Permanent Fix Script
# This script forces VS Code to reload files from disk

echo "🔄 Forcing VS Code to reload files from disk..."

# Method 1: Touch all files to update timestamps
echo "📝 Updating file timestamps..."
find /Users/tusharsurwase/Documents/GitHub/CarVrooom2/frontend/src -type f -name "*.jsx" -exec touch {} \;
find /Users/tusharsurwase/Documents/GitHub/CarVrooom2/frontend/src -type f -name "*.js" -exec touch {} \;

echo "✅ File timestamps updated!"
echo ""
echo "🔧 To permanently fix this issue:"
echo ""
echo "1. In VS Code, open Settings (Cmd+,)"
echo "2. Search for: 'files.watcherExclude'"
echo "3. Remove any overly aggressive exclusions"
echo ""
echo "4. Search for: 'files.autoSave'"
echo "5. Set to: 'afterDelay' (recommended)"
echo ""
echo "6. Add to VS Code settings.json:"
echo '   "files.watcherExclude": {'
echo '     "**/.git/objects/**": true,'
echo '     "**/.git/subtree-cache/**": true,'
echo '     "**/node_modules/**": true'
echo '   }'
echo ""
echo "7. Reload VS Code window: Cmd+Shift+P → 'Developer: Reload Window'"
echo ""
echo "🌐 Your frontend should now show the animated grid background!"
echo "Visit: http://localhost:5173"
