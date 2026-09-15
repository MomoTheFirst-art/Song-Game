import { STAGES } from './stages.ts'

/** Emoji square per round: darker green the earlier it was solved. */
function cell(stage: number | null): string {
  if (stage === null) return '⬛'
  return ['🟩', '🟢', '🟡', '🟠', '🟥'][stage] ?? '🟥'
}

export function shareText(dateKey: string, score: number, stages: (number | null)[]): string {
  const grid = stages.map(cell).join('')
  return [`🎵 لعبة الأغاني — ${dateKey}`, `${grid}  ${score} نقطة`, ''].join('\n')
}

/** Longest clip a player needed, for a one-line summary. */
export function worstClip(stages: (number | null)[]): number | null {
  const solved = stages.filter((s): s is number => s !== null)
  if (solved.length === 0) return null
  return STAGES[Math.max(...solved)]
}
