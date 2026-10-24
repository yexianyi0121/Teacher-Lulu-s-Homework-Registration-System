@echo off
rem ============================================================
rem  Liu Lu Grade Book - App Launcher
rem  Double-click: opens the app in a borderless window
rem  (Edge/Chrome --app mode: no address bar, no tabs).
rem  Windows may show a security warning on first run because
rem  the file came from the internet - click "Run"/"Open".
rem ============================================================
cd /d "%~dp0"
set "APP_HTML="
for %%f in (*.html) do if /i not "%%f"=="index.html" set "APP_HTML=%%f"
if not defined APP_HTML set "APP_HTML=index.html"
rem percent-encode the file:// URL (non-ASCII breaks --app)
for /f "delims=" %%u in ('powershell -NoProfile -Command "[uri]::EscapeUriString('%CD:\=/%\%APP_HTML%')"') do set "APP_PATH=%%u"
set "APP_URL=file:///%APP_PATH%"
where msedge >nul 2>nul && (start "" msedge --app="%APP_URL%" & exit /b 0)
where chrome >nul 2>nul && (start "" chrome --app="%APP_URL%" & exit /b 0)
start "" "%APP_URL%"
