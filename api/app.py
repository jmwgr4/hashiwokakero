import os
import sys

# Ensure project root is on path so `backend` package can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app

if __name__ == '__main__':
    app.run()
