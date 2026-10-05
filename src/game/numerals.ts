/**
 * Arabic-Indic digits.
 *
 * The interface mixed both sets — "71 أغنية" beside "٣ أغانٍ" — which reads as
 * two different languages in one sentence. Intl already knows this numbering
 * system, so there is nothing to hand-roll.
 */
export const ar = (n: number): string => n.toLocaleString('ar-EG')
