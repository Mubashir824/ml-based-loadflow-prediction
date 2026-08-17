"""
Root-level launcher — single entry point for the whole application.

This mirrors the "one file at project root starts everything" pattern:
run this file from the project root and it starts the FastAPI backend,
which itself serves the frontend (index.html / script.js / style.css).

Usage:
    python run.py
"""

import os
import sys
import uvicorn

# Make sure "backend" is importable as a package from the project root
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        app_dir="backend",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
    )
