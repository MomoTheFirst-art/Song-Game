import { loadFirebase } from './app'
import type { Mode } from '../game/types'

export interface RunRecord {
  mode: Mode
  dateKey: string
  score: number
  /** Stage each song was solved at, or null if lost. */
  stages: (number | null)[]
}

export interface LeaderboardRow {
  uid: string
  displayName: string
  bestScore: number
  runs: number
}

/**
 * Data model, deliberately small:
 *
 *   users/{uid}              name and running totals. Readable by any signed-in
 *                            player, which is what the leaderboard reads.
 *   users/{uid}/runs/{id}    one finished run, private to its owner.
 *
 * The profile carries bestScore and a run count rather than the leaderboard
 * deriving them, because ordering across subcollections needs a collection
 * group index and a client able to read everyone's history — far more access
 * than a scoreboard should require.
 */

export async function saveRun(uid: string, run: RunRecord): Promise<void> {
  const fb = await loadFirebase()
  if (!fb) return
  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')
  await addDoc(collection(fb.db, 'users', uid, 'runs'), { ...run, createdAt: serverTimestamp() })
}

/**
 * Folds one finished run into the profile the leaderboard reads.
 *
 * Read-then-write rather than a transaction: only the owner may write this
 * document, so the one race is the same player finishing runs on two devices
 * at the same instant, which costs a run off a counter rather than anything
 * that matters. A transaction would add a failure mode to a path that must
 * never interrupt the end of a round.
 *
 * bestScore is a max, which Firestore cannot do server-side, so the previous
 * value has to be read; runs is incremented from the same snapshot.
 */
export async function recordRun(uid: string, displayName: string, score: number): Promise<void> {
  const fb = await loadFirebase()
  if (!fb) return
  const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore')
  const ref = doc(fb.db, 'users', uid)
  const snap = await getDoc(ref)
  const prev = snap.exists() ? (snap.data() as Partial<LeaderboardRow>) : {}
  await setDoc(
    ref,
    {
      displayName,
      bestScore: Math.max(typeof prev.bestScore === 'number' ? prev.bestScore : 0, score),
      runs: (typeof prev.runs === 'number' ? prev.runs : 0) + 1,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function getLeaderboard(max = 20): Promise<LeaderboardRow[]> {
  const fb = await loadFirebase()
  if (!fb) return []
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
  const snap = await getDocs(
    query(collection(fb.db, 'users'), orderBy('bestScore', 'desc'), limit(max)),
  )
  return snap.docs.map((d) => {
    const data = d.data() as Partial<LeaderboardRow>
    return {
      uid: d.id,
      displayName: data.displayName || 'لاعب',
      bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
      runs: typeof data.runs === 'number' ? data.runs : 0,
    }
  })
}
