# Troubleshooting Guide

## Build Errors

### Error: "Type 'DashboardView' is not assignable to type 'View'"

**Fixed in latest version.** If you still see this:
- Make sure you're using the latest code
- The `containerEl` property should NOT be redeclared in DashboardView
- Use `this.contentEl` instead (inherited from ItemView)

### Error: "Type 'null' is not assignable to type 'WorkspaceLeaf'"

**Fixed in latest version.** The code now includes proper null checks:
```typescript
const rightLeaf = workspace.getRightLeaf(false);
if (rightLeaf) {
    // use rightLeaf
} else {
    // fallback
}
```

### Error: "index.ts cannot be compiled under '--isolatedModules'"

**Fixed.** The `src/index.ts` file has been removed. It was not needed.

### npm WARN deprecated

Deprecated dependency warnings are normal and don't affect functionality. The latest package.json uses current versions:
- TypeScript 5.3+
- esbuild 0.19+
- @types/node 20+

## Installation Issues

### Plugin doesn't appear in Obsidian

1. Check file location:
   ```
   YourVault/.obsidian/plugins/semester-dashboard/
   ```

2. Required files:
   - `manifest.json`
   - `main.js` (built from TypeScript)
   - `styles.css`

3. Try:
   - Settings → Community Plugins → Reload
   - Restart Obsidian
   - Check developer console (Ctrl+Shift+I) for errors

### "npm install" fails

Try:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### "npm run build" fails

1. Make sure TypeScript is installed:
   ```bash
   npm install -g typescript
   ```

2. Check Node.js version:
   ```bash
   node --version
   # Should be 16+ 
   ```

3. Try cleaning and rebuilding:
   ```bash
   npm run build
   ```

## Runtime Issues

### Dashboard won't open

**Symptoms**: Command runs but nothing happens

**Solutions**:
1. Check plugin is enabled in Settings
2. Try different open method:
   - Command palette
   - Ribbon icon
   - Custom hotkey
3. Check console for errors (Ctrl+Shift+I)
4. Restart Obsidian

### Tasks not appearing

**Symptoms**: Dashboard is empty or missing tasks

**Check**:
1. Task format is correct:
   ```markdown
   - [ ] Task text due:: 2024-03-15
   ```
   (Note: space after checkbox)

2. Date format is YYYY-MM-DD

3. Files are in scanned folders:
   - Settings → Scan folders
   - Empty = scan entire vault
   - Specific paths = only those folders

4. Course detection method matches your setup:
   - Per File: tasks in `Course.md` → course = "Course"
   - Per Folder: tasks in `Courses/CS101/notes.md` → course = "CS101"
   - Frontmatter: requires `course:` in YAML

### Tasks not updating

**Symptoms**: Changes to files don't reflect in dashboard

**Solutions**:
1. Click "Refresh" button in dashboard
2. Close and reopen dashboard
3. Check file was actually saved (Obsidian auto-saves)
4. Restart plugin:
   - Disable in settings
   - Enable again

### Checkbox toggle doesn't work

**Symptoms**: Clicking checkbox doesn't update file

**Check**:
1. File is not read-only
2. You have write permissions
3. File is not open in multiple windows
4. Check console for errors

### Performance issues

**Symptoms**: Dashboard is slow, lags, or freezes

**Solutions**:
1. Limit scan folders to relevant directories:
   ```
   Settings → Scan folders
   Add: Uni/Current-Semester
   (instead of entire vault)
   ```

2. Disable showing completed tasks by default:
   ```
   Settings → Show completed tasks by default → OFF
   ```

3. Archive old semester files:
   - Move to Archive folder
   - Update scan folders to exclude Archive

4. Check vault size:
   - Plugin tested with 1000+ files
   - If you have 10,000+ files, scanning may be slow

## Date and Metadata Issues

### Dates not parsing correctly

**Required format**: `YYYY-MM-DD`

**Valid**:
```markdown
- [ ] Task due:: 2024-03-15
- [ ] Task 📅 2024-03-15
- [ ] Task start:: 2024-03-01 due:: 2024-03-20
```

**Invalid**:
```markdown
- [ ] Task due:: 03/15/2024  ❌ (wrong format)
- [ ] Task due:: 2024-3-15   ❌ (missing zero-padding)
- [ ] Task due::2024-03-15   ❌ (missing space after ::)
```

### Metadata appears in task title

**Problem**: Title shows "Assignment due:: 2024-03-15"

**Causes**:
1. Missing space after `::`
   - Wrong: `due::2024-03-15`
   - Right: `due:: 2024-03-15`

2. Invalid date format
   - Plugin won't parse invalid dates
   - They remain in title

### Start dates not showing

**Check**:
1. Format is correct: `start:: 2024-03-01`
2. Date is valid
3. Both start and due can be on same task:
   ```markdown
   - [ ] Project start:: 2024-03-01 due:: 2024-03-20
   ```

## UI and Display Issues

### Dashboard looks broken

**Symptoms**: Overlapping text, missing styles, weird layout

**Solutions**:
1. Make sure `styles.css` is in plugin folder
2. Try different theme (Settings → Appearance)
3. Check for theme conflicts:
   - Disable custom CSS snippets temporarily
   - Test with default Obsidian theme

4. Clear Obsidian cache:
   - Close Obsidian
   - Delete `.obsidian/workspace` (backs up automatically)
   - Restart Obsidian

### Colors don't match theme

**Settings → Color scheme**:
- "Inherit from theme" (default) - uses Obsidian theme colors
- "Custom colors" - use your own colors

### Statistics wrong

**Symptoms**: Numbers don't match expected counts

**Check**:
1. Filter is set to "All Tasks" (not filtered view)
2. Scan folders include all relevant files
3. Click "Refresh" to rebuild from current vault state
4. Check completed tasks aren't hidden

## Course Detection Issues

### Wrong course names

**Scenario 1: Using "Per File"**
- File: `CS101-Notes.md`
- Course shown: `CS101-Notes`
- This is correct! File basename is used.

**Scenario 2: Using "Per Folder"**
- File: `Courses/CS101/Week1.md`
- Course shown: `CS101`
- Correct! Parent folder name is used.

**Scenario 3: Using "Frontmatter"**
- Need YAML at top of file:
  ```yaml
  ---
  course: CS101
  ---
  ```
- Set "Frontmatter property" in settings to match (default: `course`)

### Tasks grouped incorrectly

**Solution**: Choose the right detection method for your structure

**File-based**:
```
vault/
├── CS101.md  → course: CS101
├── Math201.md → course: Math201
└── Physics.md → course: Physics
```
Use: "Per File"

**Folder-based**:
```
vault/Courses/
├── CS101/
│   ├── notes.md  → course: CS101
│   └── labs.md   → course: CS101
└── Math201/
    └── homework.md → course: Math201
```
Use: "Per Folder"

## Advanced Issues

### Memory usage high

**Symptoms**: Obsidian uses a lot of RAM

**Causes**:
- Very large vault (10,000+ files)
- Many tasks in memory

**Solutions**:
1. Limit scan folders
2. Archive old semesters
3. Increase Node.js memory (developers only):
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

### Click-to-open doesn't work

**Symptoms**: Clicking task title doesn't open note

**Check**:
1. File still exists in vault
2. File wasn't moved/renamed after dashboard opened
3. Try refreshing dashboard
4. Check console for errors

### Plugin conflicts

**Symptoms**: Dashboard breaks when other plugins enabled

**Test**:
1. Disable all other plugins
2. Enable Semester Dashboard only
3. If it works, re-enable plugins one by one
4. Report conflict in GitHub issues

## Getting Help

### Before opening an issue:

1. **Check this guide** for your specific problem
2. **Try the basics**:
   - Refresh dashboard
   - Restart Obsidian
   - Check file format
   - Verify settings

3. **Check developer console**:
   - Press Ctrl+Shift+I (or Cmd+Option+I on Mac)
   - Look for red errors
   - Copy error messages

### When opening an issue, include:

```
**Obsidian version**: 
**Plugin version**: 1.0.0
**Operating System**: 

**Problem description**:


**Steps to reproduce**:
1. 
2. 
3. 

**Example task** (if relevant):
```markdown
- [ ] My task due:: 2024-03-15
```

**Console errors** (if any):


**Settings screenshot**: (if relevant)
```

### Common questions

**Q: Can I use this with Dataview?**
A: Yes, but it's designed to replace Dataview. They won't interfere with each other.

**Q: Does this sync across devices?**
A: Yes! It reads directly from your vault, so any sync solution (iCloud, Dropbox, Obsidian Sync) works.

**Q: Can I customize the dashboard layout?**
A: Currently no, but it's designed to support this in the future. You can modify `styles.css` for appearance changes.

**Q: Does this work on mobile?**
A: Yes! The plugin is designed to work on mobile Obsidian.

**Q: How do I uninstall?**
A: Settings → Community Plugins → Semester Dashboard → Uninstall
