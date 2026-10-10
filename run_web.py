"""Jalankan server web absensi wajah.

Penggunaan:
    python run_web.py

Lalu buka http://127.0.0.1:5000 di browser.
"""
from webapp import create_app

if __name__ == '__main__':
    app = create_app()
    # threaded=True wajib agar WebSocket & request HTTP tidak saling blok.
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
