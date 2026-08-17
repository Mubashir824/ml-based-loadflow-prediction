"""
Root-level launcher - single entry point for the whole application.

This mirrors the "one file at project root starts everything" pattern:
run this file from the project root and it starts the FastAPI backend,
which itself serves the frontend (index.html / script.js / style.css).

Usage:
    python run.py
"""

import os
import sys
import uvicorn

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

if __name__ == "__main__":
    # main.py uses paths (e.g. "../frontend") relative to the backend/
    # folder, since it was originally meant to be run as:
    #     cd backend && uvicorn main:app
    # so we switch the working directory here before starting uvicorn,
    # keeping "python run.py" as the single command from project root.
    os.chdir(BACKEND_DIR)
    sys.path.insert(0, BACKEND_DIR)

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
    )