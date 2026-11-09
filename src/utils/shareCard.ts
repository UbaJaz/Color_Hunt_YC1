export interface CardPlayer {
  name: string;
  totalScore: number;
}

const MEDALS = ['1st', '2nd', '3rd'];

/** Rows shown on the card: best first, capped so the image stays a fixed size. */
export function cardRows(players: CardPlayer[], max = 6): string[] {
  return [...players]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, max)
    .map((p, i) => `${MEDALS[i] ?? `${i + 1}th`}  ${p.name.slice(0, 16)}  ${p.totalScore}`);
}

function drawCard(players: CardPlayer[], rounds: number, subtitle = `${rounds} rounds`): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
  bg.addColorStop(0, '#7c3aed');
  bg.addColorStop(1, '#db2777');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 110px system-ui, sans-serif';
  ctx.fillText('ColorHunt', 540, 200);
  ctx.font = '48px system-ui, sans-serif';
  ctx.fillText(subtitle, 540, 275);
  ctx.textAlign = 'left';
  ctx.font = 'bold 64px system-ui, sans-serif';
  cardRows(players).forEach((row, i) => ctx.fillText(row, 160, 430 + i * 105));
  return canvas;
}

/** Share the result image through the native share sheet; fall back to downloading the PNG. */
export async function shareResults(players: CardPlayer[], rounds: number, subtitle?: string): Promise<void> {
  const blob = await new Promise<Blob | null>(resolve => drawCard(players, rounds, subtitle).toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'colorhunt-results.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ColorHunt results' });
    } catch {
      // user dismissed the share sheet
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
