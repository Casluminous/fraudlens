#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements-dev.txt

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install --no-audit --no-fund)
fi
if [ ! -f frontend/dist/index.html ]; then
  (cd frontend && npm run build)
fi

echo "FraudLens: http://127.0.0.1:8000"
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
