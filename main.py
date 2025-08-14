
import os
import json
import logging
from flask import Flask, jsonify
from binance.client import Client as BinanceClient
from binance.exceptions import BinanceAPIException

app = Flask(__name__)

# Logging
logging.basicConfig(level=logging.INFO)

# Load API keys from environment variables
BINANCE_API_KEY = os.getenv("BINANCE_API_KEY")
BINANCE_API_SECRET = os.getenv("BINANCE_API_SECRET")

if not BINANCE_API_KEY or not BINANCE_API_SECRET:
    logging.error("Missing Binance API keys in environment variables.")

# Initialize Binance client
try:
    binance_client = BinanceClient(BINANCE_API_KEY, BINANCE_API_SECRET)
except BinanceAPIException as e:
    logging.error(f"Error initializing Binance client: {str(e)}")
    binance_client = None

# Endpoint: Universe of available symbols
@app.route("/universe", methods=["GET"])
def universe():
    try:
        tickers = binance_client.get_all_tickers()
        symbols = [t["symbol"] for t in tickers]
        return jsonify({"symbols": symbols})
    except Exception as e:
        logging.error(f"Error fetching universe: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Endpoint: Live trading signals
@app.route("/signal", methods=["GET"])
def signal():
    try:
        depth = binance_client.get_order_book(symbol="XRPUSDT", limit=5)
        if not isinstance(depth, dict):
            raise ValueError("Invalid depth data format received")

        best_bid = float(depth["bids"][0][0]) if depth.get("bids") else 0
        best_ask = float(depth["asks"][0][0]) if depth.get("asks") else 0

        spread = round(best_ask - best_bid, 6)
        recommendation = "BUY" if spread > 0.01 else "SELL"

        return jsonify({
            "symbol": "XRPUSDT",
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": spread,
            "recommendation": recommendation
        })
    except Exception as e:
        logging.error(f"Error fetching signal: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 10000)))
