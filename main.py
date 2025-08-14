import os
from flask import Flask, jsonify
from binance.client import Client
from binance.exceptions import BinanceAPIException

app = Flask(__name__)

BINANCE_API_KEY = os.getenv('BINANCE_API_KEY')
BINANCE_API_SECRET = os.getenv('BINANCE_API_SECRET')

binance_client = None

def init_binance_client():
    global binance_client
    try:
        binance_client = Client(BINANCE_API_KEY, BINANCE_API_SECRET)
        # Quick check to verify if the connection works
        binance_client.ping()
        print("Binance client initialized successfully.")
    except BinanceAPIException as e:
        print(f"Error initializing Binance client: {e}")
        binance_client = None
    except Exception as e:
        print(f"Unexpected error initializing Binance client: {e}")
        binance_client = None

@app.route('/signal', methods=['GET'])
def get_signal():
    if binance_client is None:
        return jsonify({"error": "Binance client unavailable"}), 503

    try:
        order_book = binance_client.get_order_book(symbol='BTCUSDT', limit=5)
        return jsonify(order_book)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    init_binance_client()
    app.run(host='0.0.0.0', port=10000)
