# Dumppit: Larry's Route

A small browser game starring Larry, Dumppit's grumpiest garbage collector.

Catch ordinary trash in Larry's bin and avoid hazards. Clean the street before Larry loses all three patience points, and the Dumppit truck arrives to throw Larry and his bin into the compactor before finishing the route.

## Run locally

From the repository root:

```powershell
python host.py
```

The browser opens <http://localhost:8080>. Press `Ctrl+C` in the terminal to stop the server.

To choose a different port or avoid opening a browser automatically:

```powershell
python host.py --port 9000 --no-browser
```

## Controls

- Desktop: `Left Arrow` / `Right Arrow` or `A` / `D`.
- Phone and tablet: touch Larry and drag him left or right.
- Catch 12 ordinary pieces of trash to win.
- Missing ordinary trash costs one patience point.
- Catching a bowling ball, toxic bag, dead fish, bricks, or barrel costs one patience point.

## Project structure

```text
dumppit_web/
|-- index.html
|-- host.py
|-- assets/
|   `-- game/
|       |-- title-screen.jpg
|       |-- dumppit-truck-keyed.png
|       |-- larry-run-sheet.jpg
|       |-- trash-sheet.jpg
|       |-- street-city.jpg
|       |-- street-alley.jpg
|       |-- street-homes.jpg
|       |-- street-industrial.jpg
|       `-- gameplay-reference.jpg
|-- css/
|   `-- styles.css
`-- js/
    |-- app.js
    `-- game/
        |-- assets.js
        `-- game.js
```

`assets.js` loads the supplied JPEG sprite sheets and finale truck. It removes the sprite sheets' connected black backgrounds and the truck's magenta key background in memory without modifying the original artwork.

`game.js` contains movement, collision detection, scoring, Larry's remarks, falling objects, and the winning truck sequence. `app.js` connects the game to the title screen, HUD, pause menu, and result screen.

## Publishing

There is no build step and no backend. Upload the repository's web files to any static host with HTTPS enabled.
