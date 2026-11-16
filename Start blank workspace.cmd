@echo off
cd /d "%~dp0"
where java >nul 2>&1
if errorlevel 1 (
  echo Java 17 or newer is required. Install a Java runtime and try again.
  pause
  exit /b 1
)
title GuidanceDesk - Blank workspace - Keep this window open
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Blank
if errorlevel 1 pause
