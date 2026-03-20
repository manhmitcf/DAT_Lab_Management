"""
Listen forever on /ws/persist/metadata/ (no mock sender).

Requires: pip install websocket-client

Messages appear only when an edge device (or another client) sends FrameData to the same channel.
Stop with Ctrl+C.
"""
import ssl
import sys

import websocket

URL = (
    "wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net"
    "/ws/persist/metadata/"
)


def on_message(ws, message):
    if isinstance(message, bytes):
        print(f"📩 <binary {len(message)} bytes>")
    else:
        preview = message if len(message) <= 800 else message[:800] + "…"
        print("📩", preview)


def on_open(ws):
    print("✅ Connected — listening (Ctrl+C to stop)…")


def on_error(ws, error):
    print("❌", error, file=sys.stderr)


def on_close(ws, close_status_code, close_msg):
    print("🔌 Closed:", close_status_code, close_msg)


if __name__ == "__main__":
    ws = websocket.WebSocketApp(
        URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )
    try:
        ws.run_forever(sslopt={"cert_reqs": ssl.CERT_REQUIRED})
    except KeyboardInterrupt:
        print("\n⏹️ Stopped by user")
        ws.close()
