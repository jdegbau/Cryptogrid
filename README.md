# Pseudoku

A daily logic puzzle. Fill a 4×4 grid with the numbers 1–9 so every row and column matches its clue. You get five guesses, and each one colours every cell: correct, wrong, or within 2 of the answer.

Everyone gets the same puzzle on the same day, by the calendar in Chicago. Puzzles get harder through the week: Monday is the easiest and Sunday the hardest. Every puzzle has exactly one solution.

## Running it locally

The game is plain HTML, CSS and JavaScript modules with no build step. Browsers won't load modules from a file opened directly, so serve the folder:

```bash
python3 -m http.server
```

Then open <http://localhost:8000>.

## Project layout

| Path | What it is |
|---|---|
| `index.html`, `styles.css` | The page. All colours are CSS variables at the top of `styles.css`, with a dark theme that follows the system setting unless a theme is picked in settings, and a high-contrast set for the cell colours. |
| `js/game.js` | Entry point: game state, submitting guesses, timer, saving, sharing |
| `js/grid.js` | Draws the grid and clues, highlights the selected row and column, reads entries, marks guesses |
| `js/input.js` | Cell inputs, the on-screen number pad and the guess-history popover |
| `js/ui.js` | Result line, toast, dialogs, win/lose effects |
| `js/stats.js` | Stats dialog; loads Chart.js (pinned, with an integrity hash) on first open |
| `js/settings.js` | Settings: theme, high-contrast colours, hiding the timer |
| `js/share.js` | Share text for results and stats; share sheet on phones, clipboard elsewhere, copy-by-hand fallback |
| `js/date.js` | Today's puzzle, the countdown to the next one, time formatting |
| `js/storage.js` | Saved game and stats history (localStorage) |
| `js/rules.js` | What each clue checks and how it's worded, shared by the game and generator |
| `js/solver.js` | Counts a puzzle's solutions |
| `js/encoding.js` | Light encoding of answers so they can't be read at a glance (not security) |
| `gridGenerator.js` | Generates and checks `grids.json` |
| `grids.json` | The puzzles |
| `tests/` | Unit tests (`node:test`) |

## Tests and checks

Needs Node 20 or later.

```bash
npm test
```

Check that every puzzle in `grids.json` has exactly one solution:

```bash
npm run verify
```

GitHub Actions runs both on every pull request and every push to `main` (`.github/workflows/test.yml`).

## Making new puzzles

```bash
node gridGenerator.js 1092 > grids.json
```

- Use a multiple of 7. Puzzle IDs repeat every N days, and a multiple of 7 keeps each puzzle on the same weekday, which the difficulty ramp relies on.
- Each puzzle gets 7–8 blank cells. Puzzles are ranked by how much searching the solver needs, and the easiest go to Mondays and the hardest to Sundays.
- `grids.json` holds 1092 puzzles (156 weeks, about three years) before the list repeats. Generating them takes about 35 minutes; the output is only written at the end.
- To add puzzles without changing existing ones, pass a starting ID (e.g. `node gridGenerator.js 7 1093`) and append the output to `grids.json`.
- Changing the number of puzzles changes which puzzle falls on which day.

`node gridGenerator.js --encode file.json` converts an older puzzle file with plain `answerGrid` entries to the encoded form.

## Admin

On a local copy (`localhost`), run `__PSEUDOKU_ADMIN_RESET()` in the browser console to clear all saved data and restart today's puzzle. It isn't defined on the live site.
