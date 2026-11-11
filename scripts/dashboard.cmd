@echo off
rem Double-click to open the PNYX dev dashboard. Keep this window open while you work.
cd /d "%~dp0.."
call npm run dashboard
pause
