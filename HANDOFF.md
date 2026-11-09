# HANDOFF: ColorHunt, next = online multiplayer

## Goal
Add real online multiplayer (each player on their own phone) to the pass-and-play game. Backend chosen by the user: **Supabase Realtime**, room codes, host-authoritative, no DB tables. Commits stay local; do not push.

## Done (all committed, build + lint + 17 vitest + color-science harness green)
- Color science: linear-light white balance, calibration card validation, smooth score curve `deltaEToMatchScore`, in-gamut random targets, additive vote bonus `calculateVoteBonus` (0-15, no cap).
- Game: retakes capped at 3 with fresh timer, per-player pass-and-play voting (`src/utils/voting.ts`, `finalizeResults`), Play Again reset, timeout scores 0, localStorage save/Resume (`src/utils/save.ts`), skippable calibration, how-to card, 45s wall-clock timer, Web Audio tick/chime (`src/utils/sound.ts`), Memory Mode, score labels, rarity reason.
- llm-council ran 3 rounds; final verdict GOOD AS IS. Deferred by choice: exposure/WB locking on real devices, share cards, seeded challenge links, capture logging, percentile rarity, photo-upload camera fallback.

## Multiplayer design (from the approved plan)
- `src/net/room.ts`: Supabase channel `room:<CODE>`; presence = player list; `send(intent)` / `onState(cb)`.
- Host device owns the reducer (`reducer` in `src/state/GameStateContext.tsx`, export it); clients send intents (`ADD_PLAYER`, `SUBMIT_RESULT`, `SUBMIT_VOTES`, `READY`); host rebroadcasts full state snapshots.
- Each phone captures and extracts its own colour (own camera and calibration). Only `{extractedRgb, confidence}` is sent, no photo. Host recomputes `deltaE` and `score` from `extractedRgb` + target so scores cannot be inflated.
- Lobby gets Create / Join (code). All players play a round simultaneously (timer from a host start timestamp); voting is simultaneous (no hand-off); leaderboard/final for everyone.
- Add `mode: 'local' | 'online'`; local pass-and-play stays the default and must keep working.
- Config: `.env` `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; add `.env.example`, git-ignore `.env`. Get URL/key from the Supabase connector (`list_projects`, `get_project_url`, `get_publishable_keys`); ask the user which project if more than one.
- Add unit tests for the host reducer/intents and score recompute.

## Next steps (superseded: online multiplayer is done, see git log)
1. `npm i @supabase/supabase-js`; create `src/net/room.ts` and env wiring.
2. Export reducer, add online intents + host-side score recompute (+ tests).
3. Lobby Create/Join UI, online round/voting flow, reconnect on refresh.
4. Verify in two browser tabs (built-in browser): create room, join, play a round, vote, leaderboard.
5. Commit per concern.

## Notes
- Heredocs with apostrophes break the Bash tool here: write scripts with the Write tool, then run them.
- Source files use CRLF in git; Python patch scripts should read with `newline=''` (see scratch examples) or use Edit.
- Real camera behaviour is only verifiable on a phone.
