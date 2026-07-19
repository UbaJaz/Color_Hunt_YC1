# ColorHunt — 11-Day Build Plan, Split by Founder

**Deadline:** July 27, 2026, 8pm PT
**Window:** July 16 – July 27 (12 days incl. submission day)

## How the split works

Two tracks run in parallel every day, syncing at the end of each day. The split follows where each of you is naturally strongest, not a 50/50 line down the middle of the app.

- **Jaswin — Color Science & Signal Processing Track.** CV background (OpenCV, MediaPipe), embedded/algorithmic thinking, MATLAB/Simulink. Owns everything that turns pixels into a trustworthy score: k-means extraction, outlier rejection, Lab conversion, CIEDE2000, calibration, confidence scoring. This is the algorithmic core that makes the whole game feel fair — it's the hardest, most differentiating part, and it's the part that maps directly onto your existing skill set.
- **Friend — App & Product Track.** Full-stack (Next.js/React/TypeScript/Tailwind), PostgreSQL, API work, data viz, docs. Owns the React/Vite app shell, screens, state management, game flow (pass-and-play, timer, leaderboard), Collection Mode UI, and deployment.

Where a piece of work needs both (e.g. wiring the color algorithm into the UI), that's marked **JOINT**.

Note: the algorithm work is written in JavaScript for the browser (no OpenCV/Python at runtime, since this is a PWA), but Jaswin's CV background transfers directly — the math (k-means, Lab space, CIEDE2000) is identical, just implemented in JS instead of Python. Prototyping the math in Python first and porting it over is a completely reasonable way to work if that's faster to reason about.

---

## Phase 1: Core Loop (Days 1–5)

**Milestone at end of Phase 1:** a playable pass-and-play round on one device, with a real (if unpolished) color score.

### Day 1 (July 16)
- **Friend:** Initialize React + Vite project. Set up repo, folder structure, deployment pipeline (Vercel). Implement camera access via `getUserMedia()`. Test on iOS Safari *immediately* — this is the #1 platform risk. Basic photo capture + display screen.
- **Jaswin:** Start the color pipeline outside the app first, in isolation. Prototype k-means color extraction and CIEDE2000 in a scratch environment (Python or a plain JS sandbox) using sample photos, so the math is proven before it touches the UI. Pull/adapt a CIEDE2000 reference implementation.

### Day 2 (July 17)
- **Jaswin:** Canvas pixel extraction (`getImageData`), k-means dominant color extraction (k=3), outlier rejection (>2 std dev from centroid). Design the user-tap region selection logic (which pixels get sampled based on where the user taps).
- **Friend:** Build the tap-to-select UI on top of the captured photo (crosshair/region indicator), and start the game state model (players, rounds, target colors) that everything else will plug into.

### Day 3 (July 18)
- **Jaswin:** RGB → Lab conversion, full CIEDE2000 implementation, score calculation (0–100%), confidence score logic (flagging poor lighting).
- **Friend:** Results screen skeleton — layout for swatch comparison, score display, Delta E readout. Wire up the target-color data structure (hex + friendly name library, even if placeholder).

### Day 4 (July 19) — **JOINT**
- **Jaswin:** White-balance calibration step — algorithm to estimate offset from a white/grey card photo, and apply that correction matrix to submissions.
- **Friend:** Calibration UI flow (the pre-game "photograph a white surface" step), and the results screen: target vs. extracted swatch side-by-side, Delta E + confidence displayed transparently.
- **Joint:** Wire Jaswin's scoring output into Friend's results screen — this is the first full pixel-to-score-to-UI integration, worth doing together.

### Day 5 (July 20) — **MILESTONE**
- **Friend:** Full pass-and-play flow — add players, take turns, 60-second adjustable timer, round leaderboard, final game leaderboard.
- **Jaswin:** Bonus voting logic ("most unlikely item," thumbs up/down → multiplier), and start stress-testing the color algorithm against real photos in varied lighting to catch accuracy problems early.
- **Joint:** Play a full round together end-to-end. This is the checkpoint the founder doc flags — if it's not playable today, cut Collection Mode entirely and move straight to demo-video prep.

---

## Phase 2: Polish & Collection v0.1 (Days 6–8)

### Day 6 (July 21)
- **Friend:** UI/UX polish — animations, transitions, color swatch styling. Build the pre-set target color library (20–30 colors, common/uncommon mix) as real data.
- **Jaswin:** "Random color" generator with a difficulty filter, tied into the confidence/accuracy work — make sure harder colors are actually harder to match, not just labeled that way. Continue calibration tuning.

### Day 7 (July 22)
- **Friend:** Collection Mode v0.1 — photo → unlock → save to gallery. Instagram Story share template (branded, one-tap export as an image).
- **Jaswin:** Rarity unlock logic (what determines common vs. rare, and detection of a "successful" unlock), plus the confetti/sound trigger conditions. Keep testing pipeline accuracy.

### Day 8 (July 23)
- **Friend:** Personal palette page, game history / past rounds view, settings (timer length, sound, calibration reminder).
- **Jaswin:** Harden edge cases in the color pipeline — very dark/light objects, mixed lighting, reflective surfaces. This is the day to fix accuracy bugs before they show up on camera.

---

## Phase 3: Demo & Landing (Days 9–11)

### Day 9 (July 24) — **JOINT**
- Both: Record the demo video with 3+ friends in a living room, following the founder doc's 60-second script. Jaswin can speak to the technical credibility (CV pipeline) if the pitch calls for it; Friend can speak to product vision.

### Day 10 (July 25)
- **Friend:** Landing page / waitlist site, email capture, shareable results card (branded image export from game results).
- **Jaswin:** Performance optimization of the color pipeline (make sure k-means + CIEDE2000 run fast enough on mid-range phones), and cross-device/lighting testing.

### Day 11 (July 26) — **JOINT**
- Both: Friend testing session (5+ people). Split bug triage by domain — Jaswin takes anything scoring/camera/accuracy related, Friend takes anything UI/flow/state related. Final polish pass.

---

## Phase 4: Submit (Day 12)

### Day 12 (July 27)
- **Joint:** Final demo video review, YC application completion, submit by 8pm PT.

---

## Daily sync suggestion

Given the compressed timeline, a short daily check-in (15 min, end of day) to confirm both tracks are still compatible is worth the time — especially Days 4 and 5, where the two tracks merge for the first time. If the color pipeline runs behind, the escape hatch from the founder doc still applies: cut Collection Mode, not the core loop.
