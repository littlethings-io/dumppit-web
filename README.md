# Dumppit Shitblog

The clean frontend starting point for Dumppit's private, single-author blog.

For now, the site contains only the wooden stall entrance. It has no interaction, login, or backend.

## Run locally

From the repository root:

```powershell
python host.py
```

The browser opens <http://localhost:8080>. Press `Ctrl+C` in the terminal to stop the server.

To use another port:

```powershell
python host.py --port 9000
```

## Structure

```text
dumppit_web/
|-- index.html
|-- host.py
|-- assets/
|   |-- logo/
|   |   `-- dumppit-logo.jpeg
|   |-- sign/
|   |   `-- hanging-sign.jpeg
|   `-- stall/
|       |-- stall-landscape.png
|       `-- stall-portrait.png
`-- css/
    `-- main.css
```
