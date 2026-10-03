"""
Static file serving routes.

Serves the React app's assets and index.html for SPA client-side routing.
"""

from fastapi.responses import HTMLResponse, FileResponse
from .common import REACT_DIST_DIR, REACT_ASSETS_DIR


def register_static_routes(router):
    """Register static file serving routes."""

    # React app static assets
    @router.custom_route("/assets/{filename:path}", methods=["GET"])
    async def serve_react_assets(request):
        """Serve React app assets (JS, CSS)."""
        filename = request.path_params["filename"]
        file_path = REACT_ASSETS_DIR / filename
        if file_path.exists() and file_path.is_file():
            content_types = {
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
            }
            content_type = content_types.get(file_path.suffix, "application/octet-stream")
            return FileResponse(file_path, media_type=content_type)
        return HTMLResponse("Not found", status_code=404)

    # Root-level React assets (like vite.svg)
    @router.custom_route("/vite.svg", methods=["GET"])
    async def serve_vite_svg(request):
        """Serve vite.svg from React dist."""
        file_path = REACT_DIST_DIR / "vite.svg"
        if file_path.exists():
            return FileResponse(file_path, media_type="image/svg+xml")
        return HTMLResponse("Not found", status_code=404)

    # SPA catch-all routes - must be registered last
    @router.custom_route("/", methods=["GET"])
    async def serve_react_app_root(request):
        """Serve React app for root path."""
        html_path = REACT_DIST_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("No frontend found", status_code=404)

    @router.custom_route("/{path:path}", methods=["GET"])
    async def serve_react_app_catchall(request):
        """Catch-all route for SPA client-side routing."""
        path = request.path_params.get("path", "")

        if path.startswith("api/"):
            return HTMLResponse("Not found", status_code=404)

        html_path = REACT_DIST_DIR / "index.html"
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        return HTMLResponse("Not found", status_code=404)
