# Changelog

## Unreleased

### Added
- Timeline month header row with hover tooltip.
- Timeline bars open the source file on click.
- Clickable stats cards that apply status filters.

### Changed
- TaskListComponent now requires callback object (onToggle/onEdit/onDelete).
- TimelineComponent constructor now requires the App instance.
- Status filtering uses TaskStatus for non-Open statuses.
- Settings scan folders placeholder is now generic.

### Fixed
- Timeline grid lines render using borders to avoid theme gaps.
- Settings button no longer uses the highlight class.

## Version 1.0.0 - Fixed Build Issues

### Fixed TypeScript Errors

#### 1. Fixed containerEl visibility issue
**Problem**: `Property 'containerEl' is private in type 'DashboardView' but not in type 'ItemView'`

**Solution**: 
- Removed private `containerEl` declaration in DashboardView
- Use inherited `this.contentEl` from ItemView instead
- All references updated throughout the view

**Files changed**:
- `views/DashboardView.ts`

#### 2. Fixed null check for WorkspaceLeaf
**Problem**: `Type 'null' is not assignable to type 'WorkspaceLeaf'`

**Solution**:
- Added proper null checking for `getRightLeaf(false)`
- Added fallback to `getLeaf(true)` if right leaf unavailable
- Ensures leaf is always defined before use

**Files changed**:
- `main.ts`

#### 3. Fixed isolatedModules error
**Problem**: `'index.ts' cannot be compiled under '--isolatedModules'`

**Solution**:
- Removed unnecessary `src/index.ts` file
- It was not part of the plugin and caused compilation issues

**Files changed**:
- Deleted `src/index.ts`

#### 4. Fixed createDiv array syntax
**Problem**: `Argument of type 'string[]' is not assignable to parameter`

**Solution**:
- Changed from `createDiv(['class1', 'class2'])`
- To `createDiv('class1')` then `addClass('class2')`
- Matches Obsidian API correctly

**Files changed**:
- `views/DashboardView.ts`

### Updated Dependencies

**Problem**: Multiple deprecated dependency warnings from npm

**Solution**: Updated all dependencies to latest stable versions:

```json
{
  "@types/node": "^20.11.5" (was ^16.11.6),
  "@typescript-eslint/eslint-plugin": "^6.19.0" (was 5.29.0),
  "@typescript-eslint/parser": "^6.19.0" (was 5.29.0),
  "builtin-modules": "^3.3.0" (was 3.3.0),
  "esbuild": "^0.19.11" (was 0.17.3),
  "tslib": "^2.6.2" (was 2.4.0),
  "typescript": "^5.3.3" (was 4.7.4)
}
```

**Files changed**:
- `package.json`

### Improved TypeScript Configuration

**Problem**: Outdated compiler options and missing exclusions

**Solution**:
- Updated target to ES2018 (from ES6)
- Updated lib to ES2018 (from ES5/ES6/ES7)
- Added skipLibCheck for faster compilation
- Added exclude for node_modules

**Files changed**:
- `tsconfig.json`

### Added Build Tools

#### 1. Version Bump Script
Added `version-bump.mjs` for automated version management

**Purpose**:
- Syncs version between package.json and manifest.json
- Updates versions.json automatically
- Used by `npm version` command

#### 2. Build Verification Scripts
Added verification scripts for both platforms:

**verify-build.sh** (Mac/Linux):
- Checks Node.js and npm versions
- Verifies all required files exist
- Runs TypeScript check
- Builds the plugin
- Shows file sizes
- Provides next steps

**verify-build.bat** (Windows):
- Same functionality as .sh version
- Windows-compatible commands
- Pause at end for user review

#### 3. Comprehensive Documentation

**TROUBLESHOOTING.md**:
- Solutions for all common build errors
- Runtime issue fixes
- Installation problems
- Performance optimization tips
- Step-by-step debugging guide

**Updated README.md**:
- Added prerequisites section
- Build instructions with verification scripts
- Link to troubleshooting guide

**QUICKSTART.md**:
- Fast-track setup guide
- Common use cases
- Tips and tricks

### All Errors Resolved

✅ Type compatibility errors - Fixed
✅ Null assignment errors - Fixed
✅ IsolatedModules errors - Fixed
✅ Array argument errors - Fixed
✅ Deprecated dependencies - Updated
✅ Missing build scripts - Added

### Build Status

The plugin now builds successfully with:
```bash
npm install
npm run build
```

Or use the verification scripts:
- Windows: `verify-build.bat`
- Mac/Linux: `./verify-build.sh`

### Testing Checklist

Before release, verify:
- [x] TypeScript compiles without errors
- [x] Plugin builds successfully
- [x] All dependencies up to date
- [x] Documentation complete
- [x] Build scripts work on both platforms
- [ ] Plugin loads in Obsidian (test manually)
- [ ] Tasks parse correctly (test manually)
- [ ] Dashboard renders properly (test manually)
- [ ] Filters and sorting work (test manually)
- [ ] Settings page functional (test manually)

### Breaking Changes

None - This is the initial release with fixes applied.

### Migration Guide

Not applicable - Initial release.

### Known Issues

None currently. See TROUBLESHOOTING.md for solutions to potential runtime issues.

### Future Improvements

See README.md "Future Extensions" section for planned features:
- Timeline/Gantt view
- Calendar view
- Course color coding
- Semester switching
- Advanced statistics

---

## Development Commands

```bash
# Install dependencies
npm install

# Development build (watches for changes)
npm run dev

# Production build
npm run build

# Verify build (with checks)
./verify-build.sh   # Mac/Linux
verify-build.bat    # Windows

# Update version (updates manifest and versions.json)
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

## File Structure

```
semester-dashboard/
├── main.ts                 # Plugin entry (FIXED)
├── manifest.json           # Plugin metadata
├── package.json            # Dependencies (UPDATED)
├── tsconfig.json           # TypeScript config (UPDATED)
├── esbuild.config.mjs      # Build configuration
├── version-bump.mjs        # Version sync script (NEW)
├── styles.css              # Dashboard styles
├── verify-build.sh         # Build verification (NEW)
├── verify-build.bat        # Build verification Windows (NEW)
├── models/
│   └── Task.ts            # Data models
├── services/
│   ├── TaskParser.ts      # File parsing
│   └── TaskManager.ts     # State management
├── views/
│   └── DashboardView.ts   # UI rendering (FIXED)
├── settings/
│   ├── Settings.ts        # Settings model
│   └── SettingsTab.ts     # Settings UI
└── docs/
    ├── README.md          # User guide (UPDATED)
    ├── ARCHITECTURE.md    # Technical docs
    ├── QUICKSTART.md      # Setup guide
    ├── EXAMPLES.md        # Usage examples
    └── TROUBLESHOOTING.md # Issue solutions (NEW)
```

## Credits

Built to replace fragile Dataview-based semester dashboards with a proper, maintainable Obsidian plugin.
