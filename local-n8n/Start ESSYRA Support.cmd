@echo off
cd /d "%~dp0"
node launcher.mjs start
node "%~dp0support-launcher.mjs" start
pause
