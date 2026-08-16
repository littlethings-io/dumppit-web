# Dumppit website

A small static experience for `dumppit.com`: write something, dump it into the rotating void, and let it disappear.

The entered text exists only in memory while the dump animation and its brief canvas echo run. The site has no form submission, network request, analytics, cookies, local storage, database, account, or history.

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
    `-- void.js
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
- Remove the temporary animation element after every dump.

The current implementation satisfies those constraints.

## Easy adjustments

The main visual size is a CSS variable at the top of `css/styles.css`:

```css
--void-size: clamp(360px, 92vmin, 980px);
--ember: #efa75d;
```

The procedural text rings and their speeds live in `js/void.js`. The dump animation and form behavior live in `js/app.js`.
