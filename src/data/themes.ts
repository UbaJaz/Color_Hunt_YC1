/** Optional hunting-ground prompts shown next to the target colour. */
export const THEMES = [
  'Find it in the kitchen',
  'Something you can wear',
  'Outdoors only',
  'Something on a desk',
  'From the bathroom',
  'Something that is food',
  'Smaller than your hand',
  'Something in the living room',
  'A toy or a game',
  'Something made of plastic',
  'Something made of fabric',
  'Something you would pack for a trip',
];

export const pickTheme = (rng: () => number = Math.random) => THEMES[Math.floor(rng() * THEMES.length)];
