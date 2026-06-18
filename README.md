# IEEE 14-Bus ML Load Flow Analyzer

AI-powered web application for IEEE 14-bus load-flow prediction and contingency analysis. The system uses trained machine-learning models to estimate bus voltages, phase angles, active/reactive line losses, and line currents. It also includes a Newton-Raphson comparison mode using `pandapower`.

Repository: https://github.com/Mubashir824/ml-based-loadflow-prediction

---

## Features

- Manual single-scenario load-flow prediction
- Batch time-series inference from CSV, XLSX, XLS, or Parquet files
- Interactive dashboard for voltage profiles, phase angles, line losses, and line currents
- Contingency analysis for:
  - Base case
  - Generator outages
  - Line outages
  - Load outages
  - Shunt outage
- AI vs Newton-Raphson comparison using `pandapower`
- Batch comparison for the first 10 rows of an uploaded dataset
- CSV export of prediction results
- Memory-friendly backend that loads one ML model at a time during inference

---

## Tech Stack

### Backend

- Python
- FastAPI
- Uvicorn
- Pandas / NumPy
- Joblib
- Scikit-learn
- Pandapower
- XGBoost / LightGBM / CatBoost, depending on the trained model files

### Frontend

- HTML
- CSS
- JavaScript
- Bootstrap 5
- Font Awesome
- Chart.js
- Chart.js Annotation Plugin
- Google Fonts

---

## Project Structure

```text
ml-based-loadflow-prediction/
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

---

## Requirements

- Python 3.10 or later recommended
- Git
- A modern web browser
- Trained model files inside `backend/models/`
- Scaler/encoder files inside `backend/scalers/`

Install dependencies from the backend requirements file:

```bash
pip install -r backend/requirements.txt
```

If your saved models were trained using XGBoost, LightGBM, or CatBoost, make sure the same libraries are installed in your environment:

```bash
pip install xgboost lightgbm catboost
```

---

## Clone the Repository

```bash
git clone https://github.com/Mubashir824/ml-based-loadflow-prediction.git
cd ml-based-loadflow-prediction
```

---

## Setup Instructions

### 1. Create a virtual environment

```bash
python -m venv .venv
```

### 2. Activate the virtual environment

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Check model and scaler folders

Before running the app, confirm these folders exist:

```text
backend/models/
backend/scalers/
```

The backend expects the model and scaler filenames shown in the project structure. If any required file is missing, the server may fail during startup.

---

## Run the Application Locally

From the project root:

```bash
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Open the application in your browser:

```text
http://127.0.0.1:8000
```

Health check endpoint:

```text
http://127.0.0.1:8000/health
```

---

## Input Format

The ML model expects 23 input features:

```text
P1, P2, ..., P11, Q1, Q2, ..., Q11, topology_category
```

Where:

- `P1` to `P11` are active power values in MW
- `Q1` to `Q11` are reactive power values in MVAR
- `topology_category` is an integer contingency code from `0` to `31`

For batch prediction, upload a CSV, XLSX, XLS, or Parquet file with at least 23 columns. Only the first 23 columns are used.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the frontend UI |
| `GET` | `/health` | Checks whether backend assets are loaded |
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

---

## Deployment

For deployment, run without reload mode:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

For production, it is recommended to run Uvicorn behind a reverse proxy such as Nginx and use a process manager such as systemd, Supervisor, Docker, or a cloud platform service manager.

---

## Important Notes

- The frontend uses CDN-hosted libraries, so internet access is required unless the assets are downloaded and served locally.
- The Newton-Raphson comparison uses `pandapower` and may be slower than ML inference.
- Batch comparison is limited to 10 rows because Newton-Raphson solving is computationally expensive.
- Batch prediction is limited to 8,760 rows.
- The ML models are loaded one at a time to reduce memory usage.

---

## Suggested `.gitignore`

```gitignore
.venv/
__pycache__/
*.pyc
.env
.DS_Store
.ipynb_checkpoints/
```

If your model files are large, consider using Git LFS:

```bash
git lfs install
git lfs track "*.joblib" "*.pkl"
git add .gitattributes
```

---

## License

Add a license file before publishing as open source. MIT License is a common option for academic and educational projects.

---

## Acknowledgements

This project is designed for IEEE 14-bus load-flow analysis and demonstrates how machine-learning models can approximate conventional power-flow calculations while providing fast visualization and contingency analysis through a web dashboard.
