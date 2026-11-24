# Old addresses

The game has lived at three addresses. Browser storage belongs to one
address, so players' streaks, stats and settings stay behind when the game
moves. `pseudoku-bridge.html` fixes that. Each old address serves it, and
the live game (`js/migrate.js`) loads it in a hidden frame and merges what
it hands over. Opened directly, the page sends the visitor to
https://pseudoku.jdegbau.com/, so old links keep working.

| Old address | Where the bridge goes |
| --- | --- |
| `cryptogrid.jdegbau.com` (Nov 2026) | A new repository whose only job is this address (below) |
| `jdegbau.com/Cryptogrid/` (until Nov 2026) | The root of the jdegbau.com site, as `/pseudoku-bridge.html` |

## cryptogrid.jdegbau.com

GitHub Pages serves one custom domain per repository, so once this repo
moves to pseudoku.jdegbau.com, the old address needs a repository of its own:

1. Create a public repository, e.g. `cryptogrid-redirect`.
2. Add `pseudoku-bridge.html` three times: as `pseudoku-bridge.html`,
   `index.html` and `404.html` (so any old link redirects).
3. Add a `CNAME` file containing `cryptogrid.jdegbau.com`.
4. Turn on Pages (Settings → Pages, deploy from the main branch) and
   enforce HTTPS once it is offered.

The `cryptogrid` DNS record stays as it is (CNAME to `jdegbau.github.io`).
Step 4 only works after this repo has stopped claiming the domain, i.e.
after the move to pseudoku.jdegbau.com is merged.

## jdegbau.com

Copy `pseudoku-bridge.html` to the root of the jdegbau.com site so it is
served at https://jdegbau.com/pseudoku-bridge.html.

## How long to keep them

The live game asks each bridge until it answers, at most 20 page loads per
player, then stops. Keep the bridges up for a few months; the redirect for
old links is worth keeping for good.
