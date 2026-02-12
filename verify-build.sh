#!/bin/bash
set -e

# Build Verification Script for Semester Dashboard Plugin (PATH + off-PATH support)

echo "🔍 Semester Dashboard - Build Verification"
echo "=========================================="
echo ""

# -----------------------------
# Resolve node/npm (PATH or manual)
# You can override with:
#   NODE_BIN="/full/path/to/node" NPM_BIN="/full/path/to/npm" ./verify-build.sh
# -----------------------------
NODE_BIN="${NODE_BIN:-node}"
NPM_BIN="${NPM_BIN:-npm}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "⚠️  node not found in PATH. Trying common install locations..."

  CANDIDATE_NODES=(
    "/usr/local/bin/node"
    "/opt/homebrew/bin/node"
    "/usr/bin/node"
    "/snap/bin/node"
  )

  for p in "${CANDIDATE_NODES[@]}"; do
    if [ -x "$p" ]; then
      NODE_BIN="$p"
      break
    fi
  done
fi

# If node is an absolute path, add its folder to PATH so npm scripts that call "node" work
if [[ "$NODE_BIN" == /* ]]; then
  NODE_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd)"
  export PATH="$NODE_DIR:$PATH"

  # Prefer npm from same dir if present
  if [ -x "$NODE_DIR/npm" ]; then
    NPM_BIN="$NODE_DIR/npm"
  fi
fi

# Final sanity checks
if ! "$NODE_BIN" -v >/dev/null 2>&1; then
  echo "❌ ERROR: Node.js not found! Install Node.js 16+ or set NODE_BIN to its full path."
  exit 1
fi

if ! "$NPM_BIN" -v >/dev/null 2>&1; then
  echo "❌ ERROR: npm not found! Install npm or set NPM_BIN to its full path."
  exit 1
fi

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION="$("$NODE_BIN" -v)"
echo "Node.js: $NODE_VERSION"

NODE_MAJOR="$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d'.' -f1)"
if [ "$NODE_MAJOR" -lt "16" ]; then
  echo "⚠️  Warning: Node.js 16+ recommended (you have v$NODE_MAJOR)"
else
  echo "✅ Node.js version OK"
fi
echo ""

# Check npm version
echo "📦 Checking npm version..."
NPM_VERSION="$("$NPM_BIN" -v)"
echo "npm: $NPM_VERSION"
echo "✅ npm installed"
echo ""

# Check project files
echo "📄 Checking project files..."
if [ ! -f "package.json" ]; then
  echo "❌ package.json not found!"
  echo "Make sure you're in the plugin directory."
  exit 1
fi
echo "✅ package.json found"

if [ ! -f "manifest.json" ]; then
  echo "❌ manifest.json not found!"
  exit 1
fi
echo "✅ manifest.json found"

if [ ! -f "main.ts" ]; then
  echo "❌ main.ts not found!"
  exit 1
fi
echo "✅ main.ts found"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📥 node_modules not found. Running npm install..."
  "$NPM_BIN" install
  echo "✅ Dependencies installed"
else
  echo "✅ node_modules exists"
fi
echo ""

# Run TypeScript check (avoid npx relying on PATH; call tsc via node)
echo "🔨 Running TypeScript check..."
if [ ! -f "node_modules/typescript/bin/tsc" ] && [ ! -f "node_modules/typescript/bin/tsc.js" ]; then
  echo "❌ TypeScript compiler not found in node_modules!"
  echo "Expected: node_modules/typescript/bin/tsc or tsc.js"
  echo "Try: $NPM_BIN install"
  exit 1
fi

if [ -f "node_modules/typescript/bin/tsc" ]; then
  "$NODE_BIN" "node_modules/typescript/bin/tsc" --noEmit --skipLibCheck
else
  "$NODE_BIN" "node_modules/typescript/bin/tsc.js" --noEmit --skipLibCheck
fi
echo "✅ TypeScript check passed"
echo ""

# Build the plugin (PATH already includes node dir if needed, so scripts that call "node" work)
echo "🏗️  Building plugin..."
"$NPM_BIN" run build
echo "✅ Build successful"
echo ""

# Check output
if [ ! -f "main.js" ]; then
  echo "❌ main.js was not created!"
  exit 1
fi
echo "✅ main.js created"
echo ""

# Check file sizes
echo "📊 Build output:"
echo "----------------"
ls -lh main.js styles.css manifest.json 2>/dev/null | awk '{print $5 "\t" $9}'
echo ""

# Final success message
echo "✅ =========================================="
echo "✅ All checks passed!"
echo "✅ =========================================="
echo ""
echo "📋 Next steps:"
echo "1. Copy the plugin folder to: YourVault/.obsidian/plugins/semester-dashboard/"
echo "2. Enable 'Semester Dashboard' in Obsidian settings"
echo "3. Use Ctrl+P → 'Open Semester Dashboard'"
echo ""
echo "📚 Documentation:"
echo "- README.md - User guide and features"
echo "- QUICKSTART.md - Quick setup guide"
echo "- ARCHITECTURE.md - Technical details"
echo "- TROUBLESHOOTING.md - Common issues"
echo ""
echo "Press Enter to exit..."
read -r
