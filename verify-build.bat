@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ========================================
REM Resolve Node / npm (PATH or manual)
REM ========================================
set "NODE_PATH=node"
set "NPM_PATH=npm"
set "NODE_USING_MANUAL=0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node not found in PATH. Using manual Node.js location...
    set "NODE_PATH=C:\Program Files\nodejs\node.exe"
    set "NPM_PATH=C:\Program Files\nodejs\npm.cmd"
    set "NODE_USING_MANUAL=1"
)

REM If we're using manual node, make sure PATH includes node's folder
if "!NODE_USING_MANUAL!"=="1" (
    call :AddNodeDirToPath
)

REM ========================================
REM Check Node.js
REM ========================================
echo Checking Node.js version...
"%NODE_PATH%" -v
if %errorlevel% neq 0 goto :fail_node
echo ✓ Node.js found
echo.

REM ========================================
REM Check npm
REM ========================================
echo Checking npm version...
call "%NPM_PATH%" -v
if %errorlevel% neq 0 goto :fail_npm
echo ✓ npm found
echo.

REM ========================================
REM Check files
REM ========================================
echo Checking project files...

if not exist package.json goto :fail_pkg
echo ✓ package.json found

if not exist manifest.json goto :fail_manifest
echo ✓ manifest.json found

if not exist main.ts goto :fail_main_ts
echo ✓ main.ts found
echo.

REM ========================================
REM Install dependencies if needed
REM ========================================
if not exist node_modules (
    echo Installing dependencies...
    call "%NPM_PATH%" install
    if %errorlevel% neq 0 goto :fail_install
    echo ✓ Dependencies installed
) else (
    echo ✓ node_modules exists
)
echo.

REM ========================================
REM Run TypeScript check (avoid npx)
REM ========================================
echo Running TypeScript check...

if not exist "node_modules\typescript\bin\tsc" (
    if not exist "node_modules\typescript\bin\tsc.js" goto :fail_no_typescript
)

if exist "node_modules\typescript\bin\tsc" (
    call "%NODE_PATH%" "node_modules\typescript\bin\tsc" --noEmit --skipLibCheck
) else (
    call "%NODE_PATH%" "node_modules\typescript\bin\tsc.js" --noEmit --skipLibCheck
)

if %errorlevel% neq 0 goto :fail_tsc
echo ✓ TypeScript check passed
echo.

REM ========================================
REM Build
REM ========================================
echo Building plugin...
call "%NPM_PATH%" run build
if %errorlevel% neq 0 goto :fail_build
echo ✓ Build successful
echo.

REM ========================================
REM Check output
REM ========================================
if not exist main.js goto :fail_main_js
echo ✓ main.js created
echo.

echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Copy this folder to: YourVault\.obsidian\plugins\semester-dashboard\
echo 2. Open Obsidian Settings - Community Plugins
echo 3. Reload plugins and enable "Semester Dashboard"
echo 4. Use Ctrl+P and type "Open Semester Dashboard"
echo.
echo Documentation:
echo - README.md - User guide
echo - QUICKSTART.md - Setup guide
echo - TROUBLESHOOTING.md - Common issues
echo.
goto :end_success

REM ========================================
REM Subroutines
REM ========================================
:AddNodeDirToPath
for %%I in ("%NODE_PATH%") do set "NODE_DIR=%%~dpI"
REM Remove trailing backslash if present
if "!NODE_DIR:~-1!"=="\" set "NODE_DIR=!NODE_DIR:~0,-1!"
REM Prepend node dir to PATH if not already there
echo !PATH! | find /I "!NODE_DIR!" >nul
if errorlevel 1 (
    set "PATH=!NODE_DIR!;!PATH!"
)
exit /b 0

REM ========================================
REM Error handlers
REM ========================================
:fail_node
echo ERROR: Node.js not found! Please install Node.js 16 or higher.
goto :end_fail

:fail_npm
echo ERROR: npm not found!
goto :end_fail

:fail_pkg
echo ERROR: package.json not found!
echo Make sure you're in the plugin directory.
goto :end_fail

:fail_manifest
echo ERROR: manifest.json not found!
goto :end_fail

:fail_main_ts
echo ERROR: main.ts not found!
goto :end_fail

:fail_install
echo ERROR: npm install failed!
goto :end_fail

:fail_no_typescript
echo ERROR: TypeScript compiler not found in node_modules!
echo Expected: node_modules\typescript\bin\tsc or tsc.js
echo Try running: "%NPM_PATH%" install
goto :end_fail

:fail_tsc
echo ERROR: TypeScript check failed!
echo See errors above.
goto :end_fail

:fail_build
echo ERROR: Build failed!
goto :end_fail

:fail_main_js
echo ERROR: main.js was not created!
goto :end_fail

REM ========================================
REM Exit points (always "press any key")
REM ========================================
:end_fail
echo.
echo ========================================
echo Build FAILED.
echo ========================================
echo.
pause
exit /b 1

:end_success
echo.
echo Press any key to exit...
pause >nul
exit /b 0
