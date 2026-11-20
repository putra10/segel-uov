# Server lokal tanpa cache: python serve.py, lalu buka http://localhost:5317
import http.server

class TanpaCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', 5317), TanpaCache).serve_forever()
