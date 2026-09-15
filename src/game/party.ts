import { STAGE_POINTS } from './stages.ts'
import type { Difficulty, Song } from './types.ts'

/**
 * Each player faces the same shape of run — one easy, one medium, one hard —
 * so scores are comparable. Songs themselves are never shared between players:
 * everyone is in the room, and a repeated clip would be a free point.
 */
export const PARTY_TIERS: readonly Difficulty[] = ['easy', 'medium', 'hard']
export const SONGS_PER_PLAYER = PARTY_TIERS.length
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

export interface PartyPlayer {
  id: number
  name: string
  songs: Song[]
  /** Stage index the song was solved at, or null if it was lost. */
  results: (number | null)[]
}

/** How many players the catalogue can actually supply distinct songs for. */
export function maxPlayersFor(catalogue: Song[]): number {
  const perTier = PARTY_TIERS.map((t) => catalogue.filter((s) => s.difficulty === t).length)
  return Math.max(0, Math.min(MAX_PLAYERS, ...perTier))
}

function pickDistinct(pool: Song[], count: number): Song[] {
  const bag = pool.slice()
  const out: Song[] = []
  for (let i = 0; i < count && bag.length > 0; i++) {
    out.push(...bag.splice(Math.floor(Math.random() * bag.length), 1))
  }
  return out
}

/**
 * One row per player, each holding SONGS_PER_PLAYER songs in tier order.
 * Drawing per tier and dealing across players keeps every player's run the
 * same difficulty shape while guaranteeing no song appears twice.
 */
export function dealSongs(catalogue: Song[], playerCount: number): Song[][] {
  const hands: Song[][] = Array.from({ length: playerCount }, () => [])
  for (const tier of PARTY_TIERS) {
    const drawn = pickDistinct(catalogue.filter((s) => s.difficulty === tier), playerCount)
    drawn.forEach((song, i) => hands[i].push(song))
  }
  return hands
}

export function createPlayers(names: string[], catalogue: Song[]): PartyPlayer[] {
  const hands = dealSongs(catalogue, names.length)
  return names.map((name, i) => ({
    id: i,
    name: name.trim() || `لاعب ${i + 1}`,
    songs: hands[i],
    results: [],
  }))
}

export function playerScore(player: PartyPlayer): number {
  return player.results.reduce<number>(
    (sum, stage) => sum + (stage === null ? 0 : STAGE_POINTS[stage]),
    0,
  )
}

export function solvedCount(player: PartyPlayer): number {
  return player.results.filter((r) => r !== null).length
}

export interface Standing {
  player: PartyPlayer
  score: number
  solved: number
  /** 1-based; players on equal scores share a rank. */
  rank: number
  isWinner: boolean
}

/**
 * Highest score first, ties sharing a rank. Everyone on the top score is a
 * winner — a draw is a real outcome, not something to break arbitrarily.
 */
export function standings(players: PartyPlayer[]): Standing[] {
  const scored = players
    .map((player) => ({ player, score: playerScore(player), solved: solvedCount(player) }))
    .sort((a, b) => b.score - a.score)

  const top = scored.length > 0 ? scored[0].score : 0
  let rank = 0
  let previous: number | null = null

  return scored.map((row, i) => {
    if (previous === null || row.score !== previous) rank = i + 1
    previous = row.score
    return { ...row, rank, isWinner: row.score === top && top > 0 }
  })
}

/** Everyone finished every song they were dealt. */
export function partyComplete(players: PartyPlayer[]): boolean {
  return players.every((p) => p.results.length >= p.songs.length)
}
