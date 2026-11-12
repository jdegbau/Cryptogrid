# Tracking: data layer events

The game pushes events to `window.dataLayer`, so any tag manager can read them: Google Tag Manager, Tealium, Adobe Launch, Segment and others. The game doesn't load any tracking itself. Add your tag manager's snippet to `index.html` and point its tags at these events.

The code is in `js/analytics.js`. Event names are in `EVENTS` there.

## The shape of every push

```js
{
  event: 'guess_submit',          // which event (snake_case)
  schema_version: 1,              // goes up if a field changes meaning or is removed
  event_data: { ... },            // fields for this event only (see below)
  puzzle: { ... },                // context: today's puzzle
  game:   { ... },                // context: this game so far
  player: { ... },                // context: the player's record and settings
  app:    { ... }                 // context: device and how the game was opened
}
```

Before each event, the game pushes `{ event_data: null }`. Tag managers merge pushes into one model, so without that, a field from one event's `event_data` could still be read on the next event. You don't need to do anything about this push. It has no `event` key, so no trigger fires on it.

**Privacy.** Nothing in the data layer identifies the player. No answers and no guessed digits are sent, because anyone can read the data layer in the browser console. There are only counts and categories. Stats come from the player's own browser storage, so they count games played on this device.

## Context (sent with every event)

`puzzle` is `null` until the puzzle has loaded. That only happens on the very first push of a first visit, when the "How to play" dialog opens.

### `puzzle`

| Field | Type | Example | Meaning |
|---|---|---|---|
| `puzzle_id` | number | `3` | Puzzle number, from 1 to 1092 |
| `puzzle_date` | string | `"2026-11-12"` | The puzzle's day (Chicago calendar) |
| `difficulty` | string | `"Medium"` | Difficulty label from `grids.json` |
| `weekday` | string | `"Thursday"` | Puzzles get harder from Monday to Sunday |
| `row_rules` | string | `"sum,sum,sum,unique_digits"` | Clue types for rows 1–4, comma-separated |
| `col_rules` | string | `"palindromic,sum_even,sum,majority_odd"` | Clue types for columns A–D |
| `cells_open` | number | `8` | Cells the player has to fill (the rest are given) |

### `game`

| Field | Type | Example | Meaning |
|---|---|---|---|
| `status` | string | `"in_progress"` | `loading`, `not_started` (no digit entered yet), `in_progress`, `won` or `lost` |
| `guesses_submitted` | number | `2` | Guesses submitted so far, including a winning one |
| `guesses_left` | number | `3` | Wrong guesses the player can still make |
| `guesses_total` | number | `5` | Guesses allowed per puzzle |
| `cells_solved` | number | `5` | Open cells the player has got right (answers shown after a loss don't count) |
| `time_spent_sec` | number | `94` | Time on the puzzle. Counts only while the page is visible, and carries over a reload. |

### `player`

| Field | Type | Example | Meaning |
|---|---|---|---|
| `first_visit` | boolean | `true` | First time this browser has opened the game (the "How to play" dialog opened by itself) |
| `games_played` | number | `12` | Puzzles finished on this device |
| `games_won` | number | `10` | |
| `win_rate` | number | `83` | Percentage, whole number |
| `current_streak` | number | `4` | Wins on consecutive days |
| `best_streak` | number | `6` | |
| `theme` | string | `"system"` | `system`, `light` or `dark` |
| `high_contrast` | boolean | `false` | High-contrast colours turned on |
| `hide_timer` | boolean | `false` | Timer hidden |

### `app`

| Field | Type | Example | Meaning |
|---|---|---|---|
| `input_device` | string | `"touch"` | `touch` (phone or tablet) or `pointer` (mouse or trackpad) |
| `display_mode` | string | `"browser"` | `standalone` when opened from the home screen as an installed app, otherwise `browser` |

## Events

### `game_load`
The game is ready to play. Sent once per page load.

| Field | Values |
|---|---|
| `load_state` | `new` (fresh puzzle), `resumed` (a game in progress was restored), `resumed_finished` (the player came back after finishing today's puzzle) |
| `load_time_ms` | Time from page start until the game was ready |

### `puzzle_load_error`
Today's puzzle couldn't be loaded.

| Field | Values |
|---|---|
| `error_type` | `fetch_failed` (`grids.json` didn't load) or `puzzle_missing` |
| `error_message` | Technical message, for debugging |

### `puzzle_start`
The player entered their first digit in today's puzzle. Sent once per puzzle, even across reloads.

| Field | Values |
|---|---|
| `entry_source` | `keyboard` or `keypad` (the on-screen number pad) |
| `seconds_to_first_entry` | Time from load to the first digit |

### `guess_submit`
A guess was accepted and checked.

| Field | Values |
|---|---|
| `guess_number` | 1–5 |
| `result` | `solved` or `not_solved` |
| `cells_checked` | Open cells in this guess (cells already solved are locked and not counted) |
| `cells_correct` | Correct cells |
| `cells_close` | Cells within 2 of the answer |
| `cells_wrong` | Cells more than 2 away |
| `seconds_since_last_guess` | Time since the previous guess, or since the start for guess 1 |
| `keyboard_entries` | Digits typed since the last guess |
| `keypad_entries` | Digits tapped on the number pad since the last guess |
| `refused_entries` | Digits refused because they had already been tried in that cell |

When a guess wins, `guess_submit` comes first and `puzzle_complete` follows straight after.

### `guess_rejected`
The player pressed Submit, but the guess wasn't allowed. This doesn't use up a guess.

| Field | Values |
|---|---|
| `reason` | `incomplete` (empty cells) or `repeated_value` (a value already tried in that cell) |
| `cells_affected` | How many cells caused it |
| `guess_number` | The guess the player was trying to make |

### `puzzle_complete`
The puzzle ended in a win or a loss. Sent once per puzzle. It isn't sent again when a finished game is reloaded. The `player` context already includes this game.

| Field | Values |
|---|---|
| `result` | `win` or `loss` |
| `guesses_used` | Guesses including the winning one (1–5) |
| `wrong_guesses` | Guesses that weren't the solution |
| `time_spent_sec` | Final time |
| `cells_solved` | Open cells the player got right |
| `cells_open` | Open cells in the puzzle |

### `puzzle_exit`
The page was closed or left with a puzzle in progress. Use this to see where players give up. The `game` context shows how far they got. This event fires as the page unloads, so set your tag to send with a beacon (in GA4: `transport_type: 'beacon'`, which is the default for the gtag library). Some phones close pages without warning, so expect undercounting.

| Field | Values |
|---|---|
| `exit_type` | `pagehide` |

### `share`
The player shared a result or their stats.

| Field | Values |
|---|---|
| `content_type` | `result` (today's grid) or `stats` |
| `method` | `share_sheet` (the phone's share menu opened), `share_cancelled` (the player closed it), `clipboard` (copied) or `manual_copy` (copying was blocked, so the text was shown to copy by hand) |
| `result` | `win` or `loss` (only when `content_type` is `result`) |

### `dialog_open`

| Field | Values |
|---|---|
| `dialog_name` | `help`, `stats`, `settings`, `clues` (the clue sheet on phones) or `copy` (the copy-by-hand fallback) |
| `trigger` | `button`, `auto` (help on a first visit) or `fallback` (the copy dialog opened because copying failed) |

### `setting_change`
Sent once for each setting changed.

| Field | Values |
|---|---|
| `setting_name` | `theme`, `high_contrast` or `hide_timer` |
| `setting_value` | The new value as text: `light`, `dark`, `system`, `true` or `false` |

### `stats_export`
The player copied a backup code to move their stats to another device.

| Field | Values |
|---|---|
| `method` | `clipboard` or `manual_copy` |
| `games_exported` | Games in the code |

### `stats_import`

| Field | Values |
|---|---|
| `import_result` | `added`, `nothing_new` (every game was already here) or `invalid_code` |
| `games_added` | Games added |
| `games_total` | Games on this device after the import (missing when the code was invalid) |

### `next_puzzle_click`
After the clock passed midnight, the player pressed "Play today's puzzle". No fields.

## What you can measure with these events

| Question | How |
|---|---|
| Daily funnel | `game_load` (`load_state: new`) → `puzzle_start` → `guess_submit` (`guess_number: 1`) → `puzzle_complete` → `share` |
| Where players give up | `puzzle_exit`, broken down by `game.guesses_submitted` and `game.cells_solved` |
| Is a puzzle too hard? | Win rate and average `guesses_used` from `puzzle_complete`, by `puzzle.puzzle_id`, `puzzle.weekday` or `puzzle.difficulty` |
| Which clues are hardest? | `puzzle_complete` (`result`) broken down by `puzzle.row_rules` and `puzzle.col_rules` |
| How guesses improve | `cells_correct` and `cells_close` by `guess_number` |
| Confusion with the rules | Rate of `guess_rejected` by `reason`; `refused_entries`; `dialog_open` for `help` after the first visit |
| Retention and habit | `player.current_streak`, `player.games_played`, `load_state: resumed_finished` (players coming back after finishing) |
| Virality | `share` by `method` and `content_type`; the share rate per `puzzle_complete` |
| Device and input | `app.input_device`, `app.display_mode` (installed app vs browser), `keypad_entries` vs `keyboard_entries` |
| Accessibility settings | `setting_change`, or `player.high_contrast` and `player.hide_timer` on any event |

## Setting up Google Tag Manager with GA4

1. Add the GTM container snippet to the `<head>` and `<body>` of `index.html`.
2. Create **Data Layer Variables** (version 2) for the fields you want, using dot paths such as `event_data.guess_number`, `puzzle.puzzle_id`, `game.status` and `player.current_streak`.
3. Create a **Custom Event** trigger. Set the event name to the regex `^(game_load|puzzle_start|guess_submit|guess_rejected|puzzle_complete|puzzle_exit|share|dialog_open|setting_change|stats_export|stats_import|next_puzzle_click|puzzle_load_error)$`.
4. Create one **GA4 Event** tag. Set the event name to `{{Event}}`, add the variables as event parameters, and fire it on that trigger.
5. In GA4, register the parameters you want to report on as custom dimensions and metrics. Good starting points are `puzzle_id`, `difficulty`, `weekday`, `guess_number`, `result`, `method` and `status`.

GA4 already uses `share` as a recommended event name, with a `method` parameter. The `share` event here matches it, so GA4's built-in share reports work.

## Changing the schema

Add new fields freely. If you rename or remove a field, or change what it means, raise `SCHEMA_VERSION` in `js/analytics.js` so reports can tell old data from new.
