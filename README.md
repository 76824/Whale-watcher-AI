# Chenda Backend (Render-ready)

This repo exposes live endpoints that your Firebase site (and users) can call:

- `/signal` — snapshot of running symbols, metrics and whale levels
- `/books?symbol=XRP` — merged order books for Binance/Kraken
- `/universe` — what's being tracked
- `/last` — last global scan summary

## Deploy to Render

1. Create a new **Web Service** from this folder (connect GitHub or upload zip).
2. Render detects the Dockerfile and builds the container.
3. Set Health Check Path to `/signal` (optional).
4. Once live, visit: `https://YOUR-SERVICE.onrender.com/signal`

## Local run

```bash
python -m venv .venv
. .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
# open http://127.0.0.1:8080/signal
```

## Config

Edit `config.json` to seed Binance symbols and Kraken pairs. Environment flags are in `.env` (copy from `.env.example`).

