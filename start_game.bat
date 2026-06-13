@echo off
echo ========================================
echo   HASHIWOKAKERO - BRIDGE BUILDER GAME
echo ========================================
echo.
echo Starting Flask server...
echo Open your browser to: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0backend"
python app.py

pause