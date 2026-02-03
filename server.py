import http.server
import socketserver
import os

PORT = 8080
# 自动识别 dist 目录路径
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(CURRENT_DIR, 'dist')

# 如果当前目录不存在 dist，尝试向上查找
if not os.path.isdir(DIST_DIR):
    parent_dist = os.path.join(os.path.dirname(CURRENT_DIR), 'dist')
    if os.path.isdir(parent_dist):
        DIST_DIR = parent_dist

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        # 获取文件路径
        path = self.path.split('?')[0]
        file_path = os.path.join(DIST_DIR, path.lstrip('/'))

        # 如果是文件且存在，直接返回
        if os.path.isfile(file_path):
            super().do_GET()
            return

        # 否则返回 index.html（支持前端路由）
        self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
    print(f"服务已启动: http://localhost:{PORT}")
    print(f"抽奖页面: http://localhost:{PORT}/")
    print(f"后台管理: http://localhost:{PORT}/backend")
    httpd.serve_forever()
