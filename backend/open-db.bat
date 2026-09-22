@echo off
setlocal
cd /d "%~dp0"
set "DB_PATH=%~dp0unimate.db"

if not exist "%DB_PATH%" (
    echo Database not found: "%DB_PATH%"
    echo Run the backend once to create it, or create the file first.
    pause
    exit /b 1
)

where sqlite3 >nul 2>nul
if not errorlevel 1 (
    sqlite3 "%DB_PATH%"
    exit /b 0
)

echo sqlite3 CLI not found in PATH. Falling back to Python SQLite shell...
"%~dp0..\.venv\Scripts\python.exe" -c "import code, sqlite3, sys; db = sys.argv[1]; conn = sqlite3.connect(db); print(f'Connected to {db}'); code.interact(local={'conn': conn, 'sqlite3': sqlite3})" "%DB_PATH%"
exit /b 0