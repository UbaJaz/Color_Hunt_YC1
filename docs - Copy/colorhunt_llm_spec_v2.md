# ColorHunt / ShadeHunt — Game Design & Development Spec (v2.0)

> **Purpose**: Comprehensive reference for AI/LLM code generation. Incorporates Brutal Audit feedback.
> **Deadline**: YC Application — July 27, 2026 (8pm PT)
> **Team**: 2 founders
> **Status**: Pre-launch prototype phase (PASS-AND-PLAY MVP)

---

## 1. Executive Summary

ColorHunt is a mobile-first social game that bridges the physical and digital worlds through color. Players use their phone cameras to capture real-world objects and match them to target colors/shades.

**CRITICAL PIVOT (Post-Audit):** The original spec assumed real-time multiplayer with 4-digit room codes. The audit revealed this is the #1 risk to shipping by the deadline. The MVP is now **pass-and-play on a single device** — one phone, players take turns. This eliminates the hardest technical problem (real-time multiplayer sync) while still demonstrating the core mechanic. Remote multiplayer is a post-MVP feature.

**Core Insight:** No existing product bridges physical color hunting with digital scoring. The insight isn't "a party game" — it's **making the real world playable using computer vision**. Color is just the first mechanic. Future mechanics: shape hunting, texture matching, scavenger hunts.

---

## 2. Game Modes

### 2.1 Party Mode (Pass-and-Play MVP) — PRIORITY 1

**Mechanic:** One phone is passed between players. A target color (hex + name) is displayed. Each player has 60 seconds to find a physical object and snap a photo. The app extracts the dominant color and calculates a match score.

**Why Pass-and-Play:**
- Eliminates real-time multiplayer sync (hardest technical problem)
- Same-room play is where the magic lives (Jackbox model)
- Social anti-cheat: friends will call out screen-cheating
- No Firestore real-time sync needed — all local state

**Scoring:**
| Component | How It Works | Weight |
|-----------|-------------|--------|
| Base Score | CIEDE2000 color distance → percentage match (0–100%) | 70% |
| Bonus Points | Group votes "most unlikely item" — thumbs up/down | 30% |
| Final Score | Base score + (bonus votes × multiplier) | 100% |

**Round Flow:**
1. Player 1 holds phone → target color displayed
2. 60-second countdown (adjustable by host)
3. Player snaps photo of their item
4. App extracts dominant color from user-tapped region (not center-only)
5. CIEDE2000 score calculated
6. Extracted color swatch shown side-by-side with target
7. Group votes on "most unlikely item"
8. Final score displayed → pass phone to next player
9. After all players: round leaderboard
10. Next round or game end (best of 3-5 rounds)

**Post-MVP Variations:**
- Category restrictions: "Only edible items" / "Only things smaller than your hand"
- "Impossible" rounds: Extremely specific Pantone shades
- Team mode
- Remote multiplayer with 4-digit room codes (Phase 2)

### 2.2 Collection Mode (Solo/Progression) — VISION LAYER

**Mechanic:** Players photograph objects to unlock colors. BUT — this only works if colors have social meaning.

**CRITICAL AUDIT FIX:** The original "unlock hex codes" loop is boring. Collection Mode must be a **content creation engine**, not a spreadsheet.

**Revised Collection Mechanics:**
- Each unlocked color is tied to a photo of a real object
- Players create a **personal gallery** ("My Palette of the Week")
- One-tap share to Instagram Stories with branded template
- Rarity animations when unlocking rare colors (confetti, sound, achievement card)
- "Paint your profile" — unlocked colors become profile themes

**Rarity Tiers:**
| Tier | Examples | Unlock Difficulty |
|------|----------|-------------------|
| Common | Red, Blue, Yellow, Green | Very easy |
| Uncommon | Teal, Coral, Lavender, Taupe | Moderate |
| Rare | Metallic Gold, Fluorescent Pink | Hard — specific materials |
| Ultra-Rare | Pantone Color of the Year | Very hard — location/season |

**Daily Challenges:**
- "Find something matching hex #4A6741 today"
- Share your palette to Stories for bonus points
- Weekly "rarest find" leaderboard

### 2.3 Cross-Mode Synergy

- Colors unlocked in Collection can be "equipped" as personal palettes in Party Mode
- Winning Party rounds earns "color dust" hints for Collection
- Collection progress unlocks new Party categories
- Shared content (Instagram Stories) drives organic acquisition

---

## 3. Technical Architecture

### 3.1 Tech Stack (Revised for Pass-and-Play)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend | React + Vite | Fastest dev cycle |
| Mobile | PWA (Progressive Web App) | No app store approval |
| Camera | HTML5 Canvas getImageData() | Native pixel extraction |
| Color Matching | **CIEDE2000** (NOT CIE76) | Perceptually accurate — audit-critical fix |
| Color Extraction | K-means clustering + outlier rejection | More accurate than simple averaging |
| Calibration | Pre-game white/grey card photo | Estimates lighting conditions |
| Backend | **NONE for MVP** | All localStorage. Firebase only for auth/leaderboard post-MVP |
| Hosting | Vercel | Instant deploys |

### 3.2 Color Detection Pipeline (AUDIT-REVISED)

```
Pre-Game Calibration:
  Player photographs a white/grey surface (piece of paper)
  → App estimates white balance offset
  → Stores calibration matrix for session

Per-Submission:
  Camera Feed / Photo Upload
    ↓
  User TAPs the region of the object they want scored
    ↓
  K-means clustering on tapped region pixels
    ↓
  Outlier rejection (remove top/bottom 10% by distance)
    ↓
  RGB → Lab conversion
    ↓
  Apply calibration matrix (white balance correction)
    ↓
  CIEDE2000 comparison with target color
    ↓
  Score = (1 - normalized Delta E) × 100
    ↓
  Confidence score displayed ("Good lighting" / "Poor lighting — retake?")
```

### 3.3 CIEDE2000 Implementation

```javascript
// Use a library like 'delta-e' or implement CIEDE2000
// CIEDE2000 is perceptually uniform — critical for fairness

import { ciede2000 } from 'some-color-lib'; // or implement

function calculateScore(targetLab, capturedLab) {
  const deltaE = ciede2000(targetLab, capturedLab);
  // Delta E > 100 = no perceptible similarity
  // Delta E < 1 = imperceptible difference
  const score = Math.max(0, Math.min(100, 100 - deltaE));
  return { score, deltaE };
}

// Confidence heuristic
function calculateConfidence(extractedRGB, imageData) {
  const variance = calculatePixelVariance(imageData);
  const brightness = (extractedRGB.r + extractedRGB.g + extractedRGB.b) / 3;
  if (variance > threshold || brightness < 30 || brightness > 225) {
    return 'low'; // Suggest retake
  }
  return 'high';
}
```

### 3.4 K-Means Dominant Color Extraction

```javascript
function extractDominantColor(imageData, tapX, tapY, radius = 50) {
  const pixels = [];
  const data = imageData.data;
  const width = imageData.width;

  // Extract pixels around tap point
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = tapX + dx;
      const y = tapY + dy;
      if (x < 0 || x >= width || y < 0) continue;

      const idx = (y * width + x) * 4;
      pixels.push([data[idx], data[idx+1], data[idx+2]]);
    }
  }

  // K-means with k=3, pick cluster with most members
  const clusters = kMeans(pixels, 3);
  const dominant = clusters.reduce((a, b) => a.members > b.members ? a : b);

  // Outlier rejection: remove pixels > 2 std dev from centroid
  const filtered = rejectOutliers(dominant.members, dominant.centroid);

  return averageRGB(filtered);
}
```

### 3.5 White Balance Calibration

```javascript
function calibrateWhiteBalance(whiteCardRGB) {
  // Assume white card should be [255, 255, 255]
  // Calculate scaling factors
  return {
    rScale: 255 / whiteCardRGB.r,
    gScale: 255 / whiteCardRGB.g,
    bScale: 255 / whiteCardRGB.b
  };
}

function applyCalibration(rgb, calibration) {
  return {
    r: Math.min(255, rgb.r * calibration.rScale),
    g: Math.min(255, rgb.g * calibration.gScale),
    b: Math.min(255, rgb.b * calibration.bScale)
  };
}
```

### 3.6 Data Model (localStorage for MVP)

```javascript
// localStorage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'ch_user',
  UNLOCKED_COLORS: 'ch_colors',
  GAME_HISTORY: 'ch_history',
  CALIBRATION: 'ch_calibration',
  SETTINGS: 'ch_settings'
};

// User profile
interface UserProfile {
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  unlockedColors: string[]; // hex codes
  createdAt: number;
}

// Game session (in-memory, not persisted)
interface GameSession {
  players: Player[];
  currentRound: number;
  maxRounds: number;
  rounds: Round[];
  status: 'waiting' | 'active' | 'finished';
}

interface Round {
  roundNumber: number;
  targetColor: { hex: string; name: string };
  submissions: Submission[];
}

interface Submission {
  playerId: string;
  photoDataUrl: string;
  extractedColor: { r: number; g: number; b: number; hex: string };
  deltaE: number;
  matchScore: number;
  bonusVotes: number;
  finalScore: number;
  confidence: 'high' | 'medium' | 'low';
}
```

---

## 4. 12-Day Build Plan (AUDIT-REVISED)

### Philosophy: Build the demo video first, then build only what's in it.

### Phase 1: Core Loop (Days 1–5)

**Day 1 (July 16):**
- [ ] Initialize React + Vite project
- [ ] Camera access via getUserMedia() with Safari iOS testing
- [ ] Photo capture + display
- [ ] Canvas pixel extraction (getImageData)

**Day 2 (July 17):**
- [ ] K-means dominant color extraction
- [ ] Outlier rejection
- [ ] User-tap region selection (not center-only)
- [ ] RGB → Lab conversion

**Day 3 (July 18):**
- [ ] CIEDE2000 implementation (use library or port algorithm)
- [ ] Score calculation (0–100%)
- [ ] Confidence score display
- [ ] "Retake" button for poor lighting

**Day 4 (July 19):**
- [ ] White balance calibration step (photograph white paper)
- [ ] Apply calibration to submissions
- [ ] Results screen: target swatch vs. extracted swatch side-by-side
- [ ] Transparency: show Delta E value and confidence

**Day 5 (July 20):**
- [ ] Pass-and-play flow: add players → take turns → round leaderboard
- [ ] 60-second timer (adjustable)
- [ ] Bonus voting (thumbs up/down per submission)
- [ ] Final game leaderboard
- [ ] **MILESTONE: Playable pass-and-play party game on one device**

### Phase 2: Polish & Collection v0.1 (Days 6–8)

**Day 6 (July 21):**
- [ ] UI/UX polish (animations, transitions, color swatches)
- [ ] Pre-set target color library (20–30 colors, mix of common/uncommon)
- [ ] "Random color" generator with difficulty filter

**Day 7 (July 22):**
- [ ] Collection mode v0.1: photo → unlock → save to gallery
- [ ] Instagram Story share template (branded, one-tap share)
- [ ] Rarity unlock animation (confetti, sound)

**Day 8 (July 23):**
- [ ] Personal palette page
- [ ] Game history / past rounds
- [ ] Settings: timer length, sound on/off, calibration reminder

### Phase 3: Demo & Landing (Days 9–11)

**Day 9 (July 24):**
- [ ] Record demo video: 3 friends playing in a living room
- [ ] Script: "We're playing ColorHunt" → target color → scramble → results → laughter
- [ ] Edit to 60 seconds

**Day 10 (July 25):**
- [ ] Landing page / waitlist site (simple, one-page)
- [ ] Email capture for beta access
- [ ] Shareable results card (branded image generated from game results)

**Day 11 (July 26):**
- [ ] Friend testing session (5+ people)
- [ ] Bug fixes from feedback
- [ ] Performance optimization
- [ ] Final polish pass

### Phase 4: Submit (Day 12)

**Day 12 (July 27):**
- [ ] Final demo video review
- [ ] YC application completion
- [ ] Submit by 8pm PT
- [ ] **DEADLINE: July 27, 2026 at 8pm PT**

**CRITICAL: If behind schedule, cut Collection Mode. The demo video + playable pass-and-play game is enough for YC.**

---

## 5. Anti-Cheat & Fairness

### 5.1 Same-Room Anti-Cheat (MVP)
- Social enforcement: friends will call out screen-cheating
- Extracted color swatch shown transparently — players can see why they scored what they did
- No competitive integrity claims — frame it as "fun with friends," not esports

### 5.2 Remote Anti-Cheat (Post-MVP)
- Random verification challenge: "Move your object and photograph from a second angle"
- Time-stamped photo metadata analysis
- Community reporting

### 5.3 Fairness Mechanisms
- **Lighting calibration:** Every session starts with white-balance calibration
- **Confidence scores:** Warn users when lighting is poor, don't just punish them
- **Score transparency:** Show Delta E, extracted RGB, and target RGB — no black-box scoring
- **Normalized scoring (future):** Compare lighting conditions across submissions and adjust

---

## 6. YC Application Strategy (AUDIT-REVISED)

### 6.1 Reframed Narrative

**DON'T pitch:** "A party game about matching colors."
**DO pitch:** "The first physical-digital bridge for casual gaming. We use computer vision to turn the real world into a game board. Color matching is just the first mechanic."

### 6.2 Why Now?
- Smartphone cameras are now accurate enough for color detection
- On-device CV (TensorFlow.js, MediaPipe) enables real-time processing without servers
- Social gaming renaissance: Jackbox proved same-room digital games work
- No existing product bridges physical scavenger hunts with digital scoring

### 6.3 Founder-Market Fit (Be Specific)
- Technical founder: [Your specific CV — e.g., "Built real-time systems at X", "Published CV research"]
- Design/growth founder: [Your specific experience — e.g., "Grew TikTok to X followers", "Designed viral products at Y"]
- Together: [Why you specifically are the team to build this]

### 6.4 Evidence of Demand
- **No-code test nights:** Run 3+ game nights with friends using manual color judging. Record video. Note: did people ask to play again?
- **TikTok/Instagram color challenge content:** Millions of organic views prove interest in color-based physical challenges
- **Jackbox model validation:** $100M+ annual revenue in same-room party games

### 6.5 Demo Video Script (60 seconds)

```
[0:00-0:05] Two founders + friends in a living room. "We're playing ColorHunt."
[0:05-0:10] Phone screen: "Target: Dusty Rose #DCAE96 — 60 seconds!"
[0:10-0:20] Players scrambling, laughing, grabbing items from around the room
[0:20-0:30] Phone camera: tap on object → extracted color swatch appears
[0:30-0:40] Results: "Sarah's shoe: 94% match! Jake's pillow: 67%."
[0:40-0:50] Group votes: "Most unlikely item?" → Sarah wins bonus
[0:50-0:55] Final leaderboard, winner celebrates
[0:55-0:60] "ColorHunt. Find it. Match it. Win it."
```

### 6.6 Defensibility Story
- **Not defensible as "a color game."** Defensible as "the physical-digital gaming platform."
- First-mover in CV-powered physical scavenger hunts
- Data moat: color-object mapping database grows with every photo
- Network effects: more players = more game nights = more content shared
- Brand: "ColorHunt" becomes the verb for physical color challenges

---

## 7. Risk Assessment (AUDIT-REVISED)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Color detection inaccurate under poor lighting | High | High | White-balance calibration; CIEDE2000; confidence scores; retake button |
| Safari iOS camera permission issues | High | High | Test Day 1 on iOS Safari; fallback to file upload; PWA manifest |
| Scope creep delays MVP | High | Critical | Pass-and-play only; no multiplayer sync; no backend |
| No users by deadline | Medium | Medium | Landing page + waitlist; drive traffic via Reddit/TikTok |
| Color matching feels "unfair" | Medium | High | Transparent scoring (show Delta E + swatches); calibration step |
| Friends don't find it fun | Medium | High | No-code test nights BEFORE building; kill project if no repeat plays |

---

## 8. Post-YC Roadmap (If Accepted)

### Month 1: Fix Color Accuracy
- A/B test CIEDE2000 vs. human perception
- Improve calibration algorithm
- Add "tap to score" refinement
- Run 10+ playtest sessions

### Month 2: Remote Multiplayer
- Firebase real-time sync
- 4-digit room codes
- Async multiplayer (not live-action)

### Month 3: Collection Mode Full Release
- Instagram Story integration
- Rarity system with animations
- Weekly challenges

### Month 4–6: Growth
- Influencer partnerships (TikTok color challenge creators)
- Branded color challenges ("Find something Tiffany Blue")
- Corporate/team-building packages
- Event hosting for bars/campuses

---

## 9. Open Questions for AI/LLM

1. **CIEDE2000 library:** Should we use an existing npm package or implement from scratch? (Recommend: use `delta-e` or `color-diff` package)
2. **K-means performance:** Is k-means on 10,000+ pixels performant enough on mobile? (Recommend: sample every Nth pixel first)
3. **Calibration UX:** How do we make the white-balance calibration step feel fun, not tedious?
4. **Tap region size:** What radius (in pixels) around the tap point gives the best accuracy vs. performance tradeoff?
5. **Target color selection:** Should we curate a library or generate random colors? (Recommend: curated library with difficulty tags)

---

## 10. Resources

- CIEDE2000 algorithm reference: Sharma et al. (2005)
- Safari PWA camera permissions: Apple Developer Docs
- K-means clustering: Lloyd's algorithm
- Color space conversions: EasyRGB reference
- YC application guide: Focus on problem, solution, market, team, and traction

---

*Document version: 2.0 (Post-Audit)*
*Created: July 15, 2026 | Updated: July 16, 2026*
*Next review: Day 5 (July 20) — MVP core loop playable checkpoint*
