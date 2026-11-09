import { useEffect } from 'react';
import { calculateVoteBonus } from '@color-science';
import type { RGB, TargetColor } from '../../types/color';
import type { RoundResult } from '../../types/game';
import { precisionBonus, streakBonus } from '../../utils/voting';
import { describeDifference, nearestColorName } from '../../utils/colorName';
import { getPrefs } from '../../utils/prefs';
import { chime } from '../../utils/sound';

const hex = ({ r, g, b }: RGB) => '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();

interface RoundRevealProps {
  target: TargetColor;
  /** Two-colour rounds: the cool colour. */
  target2?: TargetColor;
  results: RoundResult[];
  nameOf: (playerId: string) => string;
}

function Swatch({ rgb, label }: { rgb: RGB | null; label: string }) {
  return (
    <span
      className="h-12 w-12 shrink-0 rounded-xl border border-white/20 bg-neutral-800"
      style={rgb ? { background: hex(rgb) } : undefined}
      role="img"
      aria-label={rgb ? `${label} ${hex(rgb)}` : `${label}: no capture`}
    />
  );
}

/** After voting: the target(s) next to every player's pick(s), with how close it was and where the points came from. */
export function RoundReveal({ target, target2, results, nameOf }: RoundRevealProps) {
  const sorted = [...results].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  const targets = target2 ? [target, target2] : [target];
  const aid = getPrefs().colourBlind;
  const best = Math.max(0, ...results.map(r => r.finalScore ?? 0));
  useEffect(() => {
    if (best >= 90) chime();
  }, [best]);
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
        {targets.map(t => <Swatch key={t.id} rgb={t.rgb} label={`Target ${t.name}`} />)}
        <span>
          <span className="block text-xs uppercase tracking-wide text-neutral-400">{target2 ? 'Targets' : 'Target'}</span>
          <span className="font-semibold">{targets.map(t => t.name).join(' + ')}</span>
          <span className="ml-2 text-xs text-neutral-400">{targets.map(t => t.hex.toUpperCase()).join(' ')}</span>
        </span>
      </div>
      {sorted.map((r, i) => {
        const vote = r.bonusVotes ? calculateVoteBonus(r.bonusVotes) : 0;
        const precise = precisionBonus(r.deltaE);
        const streak = streakBonus(r.streak ?? 0);
        const hints = aid
          ? (r.pair ? r.pair.map(p => p.extractedRgb) : [r.extractedRgb]).map((p, k) => (p ? `${nearestColorName(p)}${describeDifference(p, targets[k].rgb) ? `, ${describeDifference(p, targets[k].rgb)}` : ''}` : 'none')).join(' / ')
          : '';
        const picks = r.pair ? r.pair.map(p => p.extractedRgb) : [r.extractedRgb];
        return (
          <div key={r.playerId} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
            <span className="flex items-center gap-3">
              <span className="flex gap-1">
                {picks.map((rgb, k) => <Swatch key={k} rgb={rgb} label={`${nameOf(r.playerId)} picked`} />)}
              </span>
              <span>
                <span className="block font-medium">{i === 0 && '👑 '}{nameOf(r.playerId)}</span>
                <span className="block text-xs text-neutral-400">
                  {r.extractedRgb ? `${picks.map(p => (p ? hex(p) : 'none')).join(' ')}${r.deltaE != null ? ` · ΔE ${r.deltaE.toFixed(1)}` : ''}` : 'No capture'}
                </span>
                {hints && <span className="block text-xs font-semibold text-yellow-200">{hints}</span>}
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
