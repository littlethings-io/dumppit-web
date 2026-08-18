# Dumppit: The Pit

A short black-and-white browser game about feeding a living void.

Junk falls into a dark world. Swipe near it to create currents and push it into the pit. Small living creatures fall too; guide those toward either side of the screen before the pit eats them.

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

- Swipe through or near an object to push it in the direction of the swipe.
- Feed 15 pieces of junk to satisfy the pit.
- Feed pieces rapidly to build a score multiplier.
- Guide pale living creatures to the arrows at either edge.
- Letting the pit eat three living creatures ends the run.
- The pit must be fed before the 55-second timer expires.
- A quick tap creates a small outward pulse.

The same pointer controls work with a mouse, finger, or pen.

## Project structure

```text
dumppit_web/
|-- index.html
|-- host.py
|-- assets/
|-- css/
|   `-- styles.css
`-- js/
    |-- app.js
    `-- game/
        |-- pit.js
        |-- packer.js
        |-- game.js
        `-- assets.js
```

`pit.js` contains the active physics game, procedural black-and-white drawing, pit reactions, object spawning, swipe currents, scoring, and win/loss flow. `app.js` connects it to the title screen, HUD, pause menu, and result screen.

The truck-packing prototype remains in `packer.js`, and the earlier Larry falling-trash prototype remains in `game.js`. Neither is loaded on this branch.

## Publishing

There is no build step and no backend. GitHub Pages publishes whichever branch is selected in the repository's Pages settings. The live site remains unchanged until the Pages source is deliberately switched to this branch.
