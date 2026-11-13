@echo off
title SPSU Library Management System
echo ===================================================
echo   Sir Padampat Singhania University (SPSU)
echo   Central Library Management System Server
echo ===================================================
echo Starting Node.js Express server on port 3000...
echo Access in browser: http://localhost:3000
echo.
cd /d "%~dp0"
node src/server.js
pause
