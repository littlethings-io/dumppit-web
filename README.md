# Dumppit website

A small static experience for `dumppit.com`: write something, leave it at the curb, and watch the Dumppit crew take it away.

The entered text exists only in memory while the collection animation runs. The site has no form submission, network request, analytics, cookies, local storage, database, account, or history.

## Project structure

```text
dumppit_web/
|-- index.html
|-- assets/
|   |-- dumppit-black.webp
|   |-- dumppit-void-clean.png
|   |-- dumppit-logo.png
|   `-- dumppit-mark.svg
|-- css/
|   `-- styles.css
`-- js/
    |-- app.js
    `-- truck.js
```

## Preview locally

From the repository root:

```powershell
python host.py
```

The browser opens <http://localhost:8080> automatically. Keep the terminal open and press `Ctrl+C` to stop the server.

To use another port or avoid opening the browser automatically:

```powershell
python host.py --port 9000 --no-browser
```

Opening `index.html` directly also works, but a local web server behaves more like real hosting.

## Publish

This project has no build step. Upload the contents of this repository to the document root for `dumppit.com` using any static host.

The host only needs to serve:

- `index.html`
- `assets/`
- `css/`
- `js/`

Enable HTTPS on the host. No backend or database is required.

## Privacy guarantee

Keep the following true if the site is expanded:

- Do not give the form an `action` URL.
- Do not send the textarea contents through `fetch`, XHR, WebSocket, analytics, or logging.
- Do not place the contents in cookies, `localStorage`, `sessionStorage`, or IndexedDB.
- Discard the in-memory collection sequence, including its text, after every dump.

The current implementation satisfies those constraints.

## Easy adjustments

The visual styling and form placement live in `css/styles.css`.

The street, garbage truck, collector, hydraulic arm, bag toss, and vacuum sequences are drawn in `js/truck.js`. The form behavior lives in `js/app.js`.
