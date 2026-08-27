#!/usr/bin/env python3
"""Small GitHub Pages-like server used only for the private staging preview."""

from __future__ import annotations

import argparse
import os
from email.utils import formatdate
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


PUBLIC_PAGE_ROUTES = {
    "": "index.html",
    "index.html": "index.html",
    "privacy": "privacy.html",
    "privacy.html": "privacy.html",
    "cctv-installation-london": "cctv-installation-london.html",
    "cctv-installation-london.html": "cctv-installation-london.html",
    "wifi-installation-south-london": "wifi-installation-south-london.html",
    "wifi-installation-south-london.html": "wifi-installation-south-london.html",
    "business-wifi-network-cabling-london": "business-wifi-network-cabling-london.html",
    "business-wifi-network-cabling-london.html": "business-wifi-network-cabling-london.html",
    "404.html": "404.html",
}
PUBLIC_STATIC_FILES = {"index.css", "scripts.js", "robots.txt", "sitemap.xml"}


def resolve_request_path(request_path: str, root: Path) -> tuple[Path, int]:
    """Resolve static and extensionless page paths without allowing traversal."""
    root = root.resolve()
    decoded_path = unquote(urlsplit(request_path).path)
    parts = PurePosixPath(decoded_path).parts

    if ".." in parts or "\x00" in decoded_path:
        return root / "404.html", 404

    relative = decoded_path.lstrip("/")
    page_name = PUBLIC_PAGE_ROUTES.get(relative)
    if page_name:
        page = (root / page_name).resolve()
        if page.is_relative_to(root) and page.is_file():
            return page, 200

    if relative in PUBLIC_STATIC_FILES:
        static_file = (root / relative).resolve()
        if static_file.is_relative_to(root) and static_file.is_file():
            return static_file, 200

    relative_parts = PurePosixPath(relative).parts
    if (
        len(relative_parts) > 1
        and relative_parts[0] == "assets"
        and all(not part.startswith(".") for part in relative_parts)
    ):
        asset = (root / relative).resolve()
        if asset.is_relative_to(root / "assets") and asset.is_file():
            return asset, 200

    return root / "404.html", 404


class PreviewRequestHandler(SimpleHTTPRequestHandler):
    """Serve repository files with GitHub Pages-style extensionless routes."""

    server_version = "CityPlugPreview/1.0"

    def send_head(self):
        root = Path(self.directory or os.getcwd())
        path, status = resolve_request_path(self.path, root)

        try:
            source = path.open("rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        stat = os.fstat(source.fileno())
        self.send_response(status)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Length", str(stat.st_size))
        self.send_header("Last-Modified", formatdate(stat.st_mtime, usegmt=True))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.end_headers()
        return source


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve a private CityPlug staging preview")
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8788)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()

    handler = lambda *handler_args, **handler_kwargs: PreviewRequestHandler(
        *handler_args,
        directory=str(args.directory.resolve()),
        **handler_kwargs,
    )
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"CityPlug preview serving {args.directory.resolve()} on {args.bind}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
