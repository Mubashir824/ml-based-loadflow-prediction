# IEEE 14-Bus ML Load Flow Analyzer

A web-based machine learning load-flow analyzer for the IEEE 14-bus power system. The application predicts bus voltages, phase angles, active/reactive line losses, and line currents for normal and contingency operating conditions. It also provides an AI vs Newton-Raphson comparison mode using `pandapower`.

## Features

- Manual single-scenario load-flow prediction
- Batch time-series prediction from CSV, XLSX, XLS, or Parquet files
- Dashboard with voltage profile, phase-angle, line-loss, and line-current charts
- Contingency support for base case, generator trips, line outages, load outages, and shunt outage
- AI model comparison against Newton-Raphson load flow using `pandapower`
- Batch comparison mode for the first 10 rows of a dataset
- CSV export of prediction results
- Memory-friendly backend that loads one ML model at a time during inference

## Project Structure

```text
project-root/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── models/
│   │   ├── Voltage_Model.joblib
│   │   ├── Angle_Model.joblib
│   │   ├── SendingP_Model.joblib
│   │   ├── ReceivingP_Model.joblib
│   │   ├── Iline_Model.joblib
│   │   ├── SendingQ_Model.joblib
│   │   └── ReceivingQ_Model.joblib
│   ├── scalers/
│   │   ├── numerical_scaler.pkl
│   │   ├── categorical_encoder.pkl
│   │   ├── V2_V14_target_scaler.pkl
│   │   ├── Angle_2_to_14_target_scaler.pkl
│   │   ├── SendingPs_target_scaler.pkl
│   │   ├── ReceivingPs_target_scaler.pkl
│   │   ├── Line_Currents_target_scaler.pkl
│   │   ├── SendingQs_target_scaler.pkl
│   │   └── ReceivingQs_target_scaler.pkl
│   └── static/
│       └── images/
│           ├── 0.png
│           ├── 1.png
│           └── ...
└── frontend/
    ├── index.html
    ├── script.js
    └── style.css
```

## Requirements

- Python 3.10 or later recommended
- Git
- A modern browser
- Trained model files in `backend/models/`
- Scaler/encoder files in `backend/scalers/`

Suggested `requirements.txt`:

```txt
fastapi
uvicorn
python-multipart
pandas
numpy
joblib
scikit-learn
openpyxl
pyarrow
pandapower
```

If your model files were trained with XGBoost, LightGBM, or CatBoost, also install the matching libraries used during training:

```txt
xgboost
lightgbm
catboost
```

## Clone the Repository

```bash
git clone https://github.com/your-username/ieee14-ml-load-flow-analyzer.git
cd ieee14-ml-load-flow-analyzer
```

Replace the repository URL with your actual GitHub repository URL.

## Setup

Create and activate a virtual environment:

```bash
python -m venv .venv
```

On Windows:

```bash
.venv\Scripts\activate
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

## Add Model and Scaler Files

Before running the app, make sure these folders exist:

```text
backend/models/
backend/scalers/
```

The backend expects the exact model and scaler filenames shown in the project structure. If any required model is missing, the server will fail during startup.

## Run the Application

From the project root, run:

```bash
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Open the app in your browser:

```text
http://127.0.0.1:8000
```

The health endpoint is available at:

```text
http://127.0.0.1:8000/health
```

## Input Format

The model expects 23 input features:

```text
P1, P2, ..., P11, Q1, Q2, ..., Q11, topology_category
```

Where:

- `P1` to `P11` are active power values in MW
- `Q1` to `Q11` are reactive power values in MVAR
- `topology_category` is an integer contingency code from 0 to 31

For batch prediction, upload a CSV, XLSX, XLS, or Parquet file with at least 23 columns. Only the first 23 columns are used.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the frontend UI |
| `GET` | `/health` | Checks whether scalers/assets are loaded |
| `POST` | `/predict_single` | Runs ML inference for one scenario |
| `POST` | `/predict_batch` | Runs ML inference for uploaded datasets, up to 8,760 rows |
| `POST` | `/compare` | Compares ML inference with Newton-Raphson for one scenario |
| `POST` | `/compare_batch` | Compares ML and Newton-Raphson for up to 10 uploaded rows |

Example single prediction request:

```bash
curl -X POST http://127.0.0.1:8000/predict_single \
  -H "Content-Type: application/json" \
  -d '{"features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}'
```

## Frontend Libraries

The frontend uses CDN-hosted assets:

- Bootstrap 5
- Font Awesome
- Chart.js
- Chart.js Annotation Plugin
- Google Fonts

An internet connection is required for these CDN assets unless you download and serve them locally.

## Deployment Notes

For production deployment, use a process manager and disable reload mode:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Recommended production improvements before public release:

- Add a license file such as `MIT`, `Apache-2.0`, or another license you choose
- Add `.gitignore` to exclude virtual environments, cache files, and temporary files
- Keep very large model files out of Git if they exceed GitHub limits; use Git LFS or provide a download link
- Move frontend CDN assets local if offline use is required
- Add screenshots or demo GIFs to the README
- Add sample input CSV files for testing

## Suggested `.gitignore`

```gitignore
.venv/
__pycache__/
*.pyc
.env
.DS_Store
.ipynb_checkpoints/
*.log
```

## License

Add your preferred open-source license here. Example:

```text
MIT License
```

## Acknowledgements

This project is built for IEEE 14-bus load-flow analysis and combines machine learning inference with conventional Newton-Raphson validation through `pandapower`.
