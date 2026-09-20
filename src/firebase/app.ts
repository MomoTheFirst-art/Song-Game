import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

/**
 * Firebase is optional and loaded late, on purpose.
 *
 * Optional: the game has always run with no backend and still must. Someone
 * opening the site gets a full game whether or not an account exists, and a
 * missing or broken project degrades to yesterday's behaviour rather than a
 * blank screen.
 *
 * Late: importing the SDK at the top level put 944kB in the entry bundle
 * against 253kB without it — nearly quadrupling the download for a feature
 * most players never touch, on a game meant for phones. Dynamic imports let
 * Vite split it out, so the game is playable while the SDK is still arriving,
 * and never fetched at all when unconfigured.
 *
 * These values are not secrets. A Firebase web config ships inside the client
 * by design; access is controlled by security rules, not by hiding the key.
 */
/**
 * Committed rather than injected at build time. These are public values — the
 * config ships inside every client bundle by design — so keeping them in the
 * repo costs nothing and means every build, local or CI, is wired up without
 * six environment variables having to be set identically in three places. The
 * env vars still win where they are set, for pointing a build at another
 * project.
 */
const DEFAULTS = {
  apiKey: 'AIzaSyAK4dKwU8cs1nP59v_9PgNAtwRD8N1GBas',
  authDomain: 'song-game-719a2.firebaseapp.com',
  projectId: 'song-game-719a2',
  storageBucket: 'song-game-719a2.firebasestorage.app',
  messagingSenderId: '996845404853',
  appId: '1:996845404853:web:276ac5c1d1776d28d6f4fc',
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULTS.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULTS.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULTS.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULTS.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULTS.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULTS.appId,
}

/** Enough of a config to be worth loading the SDK for. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

export interface FirebaseBundle {
  auth: Auth
  db: Firestore
}

let pending: Promise<FirebaseBundle | null> | null = null

/** Resolves to null whenever accounts are unavailable — never throws. */
export function loadFirebase(): Promise<FirebaseBundle | null> {
  if (!firebaseConfigured) return Promise.resolve(null)
  if (!pending) {
    pending = (async () => {
      try {
        const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ])
        const app = initializeApp(config)
        return { auth: getAuth(app), db: getFirestore(app) }
      } catch (err) {
        // A bad config, or a blocked CDN, costs the account features only.
        console.warn('Firebase unavailable; running without an account.', err)
        return null
      }
    })()
  }
  return pending
}
