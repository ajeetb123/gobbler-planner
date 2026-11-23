# Local receiver for catalog pages: a browser tab showing a catalog page posts its own content here; saved under <dir>/<name>.
import sys, re
from http.server import BaseHTTPRequestHandler, HTTPServer
OUT = sys.argv[1]
class H(BaseHTTPRequestHandler):
    def _h(self, code=200):
        self.send_response(code)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
    def do_OPTIONS(self): self._h(204)
    def do_POST(self):
        name = re.sub(r'[^a-z0-9_.-]', '_', self.path.strip('/').lower()) or 'x'
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        open(f'{OUT}/{name}', 'wb').write(body)
        self._h(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 4199), H).serve_forever()
