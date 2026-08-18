# Dumppit: Pack the Truck

A small browser puzzle game starring Larry, Dumppit's grumpiest garbage collector.

Drag garbage clusters into the truck's 8×8 compactor bay. Filling a complete row or column crushes that line and creates more room. Crush eight lines to finish the route. If none of the remaining pieces fits, Larry calls it a day.

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

## How to play

- Drag one of the three garbage clusters into an empty place in the truck.
- Fill a complete horizontal or vertical line to crush it.
- Crush eight lines to win the route.
- After using all three clusters, a new load arrives.
- The game ends if none of the remaining clusters can fit.
- The same drag controls work with a mouse, finger, or pen.

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
        |-- packer.js
        `-- game.js
```

`assets.js` loads the supplied artwork. `packer.js` contains the active board puzzle, drag handling, scoring, line clearing, and visual effects. `app.js` connects it to the title screen, HUD, pause menu, and result screen.

The earlier falling-trash prototype remains in `game.js` for comparison but is not loaded by the page on this branch.

## Publishing

There is no build step and no backend. GitHub Pages publishes whichever branch is selected in the repository's Pages settings. The live site currently remains on the separate `game/larry` branch until that setting is deliberately changed.
