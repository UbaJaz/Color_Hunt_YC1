# HANDOFF: ColorHunt

## State
Pass-and-play and online (Supabase Realtime, host-authoritative, no tables) both work. Pushed to https://github.com/UbaJaz/Color_Hunt_YC1 (main). Build, lint and vitest are green. `npm test` also rebuilds `packages/color-science`.

## Features
Scoring: colour match + votes + spot-on + streak bonuses. Options: colour packs, theme prompts, two-colour rounds, memory mode, seeded challenge links, daily challenge (+ streak, local stats), reveal screen, colour-blind aid, sound/vibration prefs, share-results image, PWA, spectators, rejoin after closing the tab, emoji reactions, host-gone banner, signed intents.

## Not verified (needs real phones)
Camera, white-balance lock, share sheet, photo-upload fallback, PWA install, vibration, a full online round with 2+ real players.

## Next steps
1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project env vars and redeploy.
2. Test on two real phones (list above).
3. Host migration (the biggest online weakness); Edge Function room tokens if the game gets public traffic.
4. Speed round was skipped on purpose: the host cannot trust client-reported times.

## Notes
- Heredocs with apostrophes break the Bash tool: write scripts with the Write tool, then run them.
- Source files use CRLF in git; patch scripts should read/write with `newline=''` and normalise.
- Old planning docs live in `docs/archive/`; `docs/VERIFICATION.md` is the colour-science test log.
