@echo off
cd /d "%~dp0"
node stop-support-worker.mjs
node launcher.mjs stop
pause
