import importlib.util
import threading
import unittest
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_MODULE = ROOT / "preview_server.py"


def load_server_module():
    spec = importlib.util.spec_from_file_location("preview_server", SERVER_MODULE)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PreviewServerTests(unittest.TestCase):
    def test_extensionless_routes_resolve_to_html_files(self):
        self.assertTrue(SERVER_MODULE.is_file(), "preview_server.py is missing")
        module = load_server_module()

        path, status = module.resolve_request_path("/privacy", ROOT)
        self.assertEqual(path, ROOT / "privacy.html")
        self.assertEqual(status, 200)

        path, status = module.resolve_request_path("/wifi-installation-south-london?service=wifi", ROOT)
        self.assertEqual(path, ROOT / "wifi-installation-south-london.html")
        self.assertEqual(status, 200)

        path, status = module.resolve_request_path("/missing-page", ROOT)
        self.assertEqual(path, ROOT / "404.html")
        self.assertEqual(status, 404)

    def test_path_traversal_is_rejected(self):
        self.assertTrue(SERVER_MODULE.is_file(), "preview_server.py is missing")
        module = load_server_module()
        path, status = module.resolve_request_path("/../package.json", ROOT)
        self.assertEqual(path, ROOT / "404.html")
        self.assertEqual(status, 404)

    def test_repository_internals_are_not_public(self):
        self.assertTrue(SERVER_MODULE.is_file(), "preview_server.py is missing")
        module = load_server_module()
        for request_path in (
            "/.git/config",
            "/cityplug-form-production-guide.md",
            "/package.json",
            "/tests/test_site.py",
            "/preview_server.py",
        ):
            path, status = module.resolve_request_path(request_path, ROOT)
            self.assertEqual((path, status), (ROOT / "404.html", 404), request_path)

        path, status = module.resolve_request_path("/assets/fav%20blk.png", ROOT)
        self.assertEqual((path, status), (ROOT / "assets/fav blk.png", 200))

    def test_preview_responses_block_search_indexing(self):
        self.assertTrue(SERVER_MODULE.is_file(), "preview_server.py is missing")
        module = load_server_module()
        handler = partial(module.PreviewRequestHandler, directory=str(ROOT))
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{server.server_port}/privacy", timeout=5
            ) as response:
                self.assertEqual(response.headers.get("X-Robots-Tag"), "noindex, nofollow")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
