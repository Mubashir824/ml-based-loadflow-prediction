# IEEE 14-Bus ML Load Flow Analyzer

## Table of Contents
- [Complete Project Demo](#complete-project-demo)
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Running the Project](#running-the-project)
- [How the System Works](#how-the-system-works)
  - [Manual Single-Scenario Prediction](#manual-single-scenario-prediction)
  - [Batch Prediction from File](#batch-prediction-from-file)
  - [Contingency Analysis](#contingency-analysis)
  - [AI vs Newton-Raphson Comparison](#ai-vs-newton-raphson-comparison)
- [API Endpoints](#api-endpoints)
- [Input Format](#input-format)
- [Resetting / Troubleshooting](#resetting--troubleshooting)
- [Repository References](#repository-references)
- [License](#license)

## Complete Project Demo
[Watch the system in action](PASTE_YOUR_DEMO_VIDEO_LINK_HERE)

## Project Overview
The IEEE 14-Bus ML Load Flow Analyzer is an AI-powered web application that
estimates bus voltages, phase angles, active/reactive line losses, and line
currents for the IEEE 14-bus test system using trained machine-learning
models. It also includes a Newton-Raphson comparison mode powered by
`pandapower`, so predictions can be validated against a conventional
power-flow solver.

## Key Features
- Manual single-scenario load-flow prediction
- Batch time-series inference from CSV, XLSX, XLS, or Parquet files
- Interactive dashboard for voltage profiles, phase angles, line losses, and line currents
- Contingency analysis for base case, generator outages, line outages, load outages, and shunt outage
- AI vs Newton-Raphson comparison using `pandapower`
- Batch comparison for the first 10 rows of an uploaded dataset
- CSV export of prediction results
- Memory-friendly backend that loads one ML model at a time during inference

## System Requirements
Ensure the following are installed before running the project:

- **Python 3.10 or later** – [Download Here](https://www.python.org/downloads/)
- **Git** – [Download Here](https://git-scm.com/downloads)
- A modern web browser

Trained model files (`backend/models/`) and scaler/encoder files
(`backend/scalers/`) must already be present — the server will fail to start
if any required file is missing.

## Installation Guide

#### 1. Clone the Repository
```sh
git clone https://github.com/Mubashir824/ml-based-loadflow-prediction.git
cd ml-based-loadflow-prediction
```

#### 2. Create and Activate a Virtual Environment
```sh
python -m venv .venv
```
Windows:
```sh
.venv\Scripts\activate
```
macOS/Linux:
```sh
source .venv/bin/activate
```

#### 3. Install Dependencies
```sh
pip install -r requirements.txt
```

#### 4. Verify Model and Scaler Folders
Before running the app, confirm these exist and are populated:
```text
backend/models/
backend/scalers/
```

## Running the Project

Unlike multi-service setups, this project starts with a **single command**
from the project root:

```sh
python run.py
```

This launches the FastAPI backend, which also serves the frontend directly.

### Access the Application
Open the following URL in your browser:
```text
http://127.0.0.1:8000
```

Health check endpoint:
```text
http://127.0.0.1:8000/health
```

## How the System Works

### Manual Single-Scenario Prediction
User enters 23 input features (11 active power values, 11 reactive power
values, and a topology/contingency code). The backend loads each required ML
model one at a time, runs inference, and returns predicted voltages, angles,
line currents, and losses.

### Batch Prediction from File
User uploads a CSV/XLSX/XLS/Parquet file (up to 8,760 rows). Only the first
23 columns of each row are used. Results can be exported back to CSV.

### Contingency Analysis
The `topology_category` code (0–31) tells the model which contingency is
being simulated: base case, a specific generator outage, line outage, load
outage, or shunt outage — so the same models can be reused across all
scenarios.

### AI vs Newton-Raphson Comparison
For validation, the same scenario is solved twice: once by the ML models and
once by a classical Newton-Raphson solver (`pandapower`, run in an isolated
subprocess since it is not thread-safe). Batch comparison is capped at 10
rows because the NR solver is computationally expensive.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the frontend UI |
| `GET` | `/health` | Checks whether backend assets are loaded |
| `POST` | `/predict_single` | Runs ML inference for one scenario |
| `POST` | `/predict_batch` | Runs ML inference for uploaded datasets, up to 8,760 rows |
| `POST` | `/compare` | Compares ML inference with Newton-Raphson for one scenario |
| `POST` | `/compare_batch` | Compares ML and Newton-Raphson for up to 10 uploaded rows |

## Input Format
The ML model expects 23 input features:
```text
P1, P2, ..., P11, Q1, Q2, ..., Q11, topology_category
```
- `P1`–`P11`: active power values in MW
- `Q1`–`Q11`: reactive power values in MVAR
- `topology_category`: contingency code from `0` to `31`

Example single prediction request:
```sh
curl -X POST http://127.0.0.1:8000/predict_single \
  -H "Content-Type: application/json" \
  -d '{"features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}'
```

## Resetting / Troubleshooting
If the server fails to start:
1. Confirm `backend/models/` and `backend/scalers/` contain all required
   `.joblib` / `.pkl` files listed in the project structure.
2. Confirm the virtual environment is activated and
   `pip install -r requirements.txt` completed without errors.
3. Delete `backend/__pycache__/` and restart with `python run.py`.

## Repository References
This project uses [`pandapower`](https://www.pandapower.org/) for the
Newton-Raphson comparison mode, applied to the standard IEEE 14-bus test
system.

For any questions or issues, feel free to contact us or raise an issue in
the repository.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE)
file for details.

## Acknowledgements
This project is designed for IEEE 14-bus load-flow analysis and demonstrates
how machine-learning models can approximate conventional power-flow
calculations while providing fast visualization and contingency analysis
through a web dashboard.
