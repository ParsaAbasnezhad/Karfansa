"""Container health check: calls the liveness endpoint with a Host header Django will accept.

Exit code 0 = healthy. Uses only the standard library so it runs in any image stage.
"""

import os
import sys
import urllib.request

PORT = os.environ.get("PORT", "8000")
HOST = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost").split(",")[0].strip().lstrip(".")
URL = f"http://127.0.0.1:{PORT}/api/v1/health/"


def main() -> int:
    request = urllib.request.Request(URL, headers={"Host": HOST or "localhost"})
    try:
        with urllib.request.urlopen(request, timeout=4) as response:  # noqa: S310
            return 0 if response.status == 200 else 1
    except Exception:
        return 1


if __name__ == "__main__":
    sys.exit(main())
