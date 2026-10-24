@echo off
setlocal enabledelayedexpansion
rem ============================================================
rem  Liu Lu Grade Book - App Launcher
rem  Double-click: opens the app in a borderless window
rem  (Edge/Chrome --app mode: no address bar, no tabs).
rem  Windows may show a security warning on first run because
rem  the file came from the internet - click "Run"/"Open".
rem ============================================================
cd /d "%~dp0"
set "APP_HTML="
for %%f in (*.html) do if /i not "%%~nxf"=="index.html" if not defined APP_HTML set "APP_HTML=%%~nxf"
if not defined APP_HTML set "APP_HTML=index.html"
rem Percent-encode the file:// URL (non-ASCII breaks --app).
rem Path is taken inside PowerShell, never from %CD% (cmd substring on %CD%
rem without quotes does not substitute, leaving backslashes in the URL).
for /f "delims=" %%u in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$sep=[char]92; $p=((Get-Location).Path).Replace($sep,[char]47); [uri]::EscapeUriString($p+[char]47+$env:APP_HTML)"') do endlocal & set "APP_PATH=%%u" & setlocal
set "APP_URL=file:///%APP_PATH%"
rem Edge/Chrome are usually NOT on PATH: probe install dirs directly.
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if defined EDGE (start "" "%EDGE%" --app="%APP_URL%" & exit /b 0)
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined CHROME (start "" "%CHROME%" --app="%APP_URL%" & exit /b 0)
rem Last resort: default browser (loses the borderless look, still usable).
start "" "%APP_URL%"
