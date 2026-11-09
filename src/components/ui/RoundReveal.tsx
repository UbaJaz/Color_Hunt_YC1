import { calculateVoteBonus } from '@color-science';
import type { RGB, TargetColor } from '../../types/color';
import type { RoundResult } from '../../types/game';
import { precisionBonus, streakBonus } from '../../utils/voting';

const hex = ({ r, g, b }: RGB) => '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();

interface RoundRevealProps {
  target: TargetColor;
  results: RoundResult[];
  nameOf: (playerId: string) => string;
}

/** After voting: the target next to every player's pick, with how close it was and where the points came from. */
export function RoundReveal({ target, results, nameOf }: RoundRevealProps) {
  const sorted = [...results].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
        <span className="h-12 w-12 rounded-xl border border-white/20" style={{ background: target.hex }} />
        <span>
          <span className="block text-xs uppercase tracking-wide text-neutral-400">Target</span>
          <span className="font-semibold">{target.name}</span>
          <span className="ml-2 text-xs text-neutral-400">{target.hex.toUpperCase()}</span>
        </span>
      </div>
      {sorted.map((r, i) => {
        const vote = r.bonusVotes ? calculateVoteBonus(r.bonusVotes) : 0;
        const precise = precisionBonus(r.deltaE);
        const streak = streakBonus(r.streak ?? 0);
        return (
          <div key={r.playerId} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
            <span className="flex items-center gap-3">
              <span
                className="h-12 w-12 rounded-xl border border-white/20 bg-neutral-800"
                style={r.extractedRgb ? { background: hex(r.extractedRgb) } : undefined}
                role="img"
                aria-label={r.extractedRgb ? `${nameOf(r.playerId)} picked ${hex(r.extractedRgb)}` : `${nameOf(r.playerId)} had no capture`}
              />
              <span>
                <span className="block font-medium">{i === 0 && '👑 '}{nameOf(r.playerId)}</span>
                <span className="block text-xs text-neutral-400">
                  {r.extractedRgb ? `${hex(r.extractedRgb)} · ΔE ${r.deltaE?.toFixed(1)}` : 'No capture'}
                </span>
              </span>
            </span>
            <span className="flex flex-col items-end">
              <span className="text-lg font-bold text-pink-400">{r.finalScore}</span>
              {vote > 0 && <span className="text-[10px] font-bold uppercase text-green-400">Votes +{vote}</span>}
              {streak > 0 && <span className="text-[10px] font-bold uppercase text-orange-300">Streak x{r.streak} +{streak}</span>}
              {precise > 0 && <span className="text-[10px] font-bold uppercase text-yellow-300">Spot on +{precise}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
