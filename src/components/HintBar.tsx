import type { Mode } from '../domain/types';
import { HINT_TEXT } from '../domain/constants';

export interface HintBarProps {
  mode: Mode;
}

export function HintBar({ mode }: HintBarProps) {
  return (
    <div className="hint" role="note">
      {HINT_TEXT[mode]}
    </div>
  );
}
