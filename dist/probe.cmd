@echo off
cd /d "%~dp0"
call :probe > "%~dp0probe-out.txt" 2>&1
exit /b 0

:probe
set "APP_HTML="
for %%f in (*.html) do if /i not "%%f"=="index.html" set "APP_HTML=%%f"
echo PICKED=[%APP_HTML%]
for /f "delims=" %%u in ('powershell -NoProfile -Command "[uri]::EscapeUriString('%CD:\=/%\%APP_HTML%')"') do set "APP_PATH=%%u"
echo ENC=[%APP_PATH%]
set "APP_URL=file:///%APP_PATH%"
echo URL=[%APP_URL%]
if exist "%CD%\学情登记系统.html" (echo FILE OK) else (echo FILE MISSING)
