# Chenda Backend (Render-ready, no API keys)

Endpoints:
- `/` health
- `/universe` list of USDT spot symbols (from Binance public exchangeInfo; falls back to seeds in `config.json`)
- `/signal` snapshot of 24h metrics for symbols in `config.json`
- `/books?symbol=XRP` best bid/ask via public depth

Deploy as a Docker Web Service on Render. No API keys required.
