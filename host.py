"""Run the Dumppit website locally."""

from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
import webbrowser


SITE_DIRECTORY = Path(__file__).resolve().parent
DEFAULT_PORT = 8080


class DevelopmentRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def parse_arguments():
    parser = ArgumentParser(description="Host the Dumppit website locally.")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"port to use (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="do not open the website automatically",
    )
    return parser.parse_args()


def main():
    arguments = parse_arguments()
    handler = partial(DevelopmentRequestHandler, directory=str(SITE_DIRECTORY))
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), handler)
    url = f"http://localhost:{arguments.port}"

    print(f"Dumppit is running at {url}")
    print("Press Ctrl+C to stop it.")

    if not arguments.no_browser:
        Timer(0.5, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDumppit stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
