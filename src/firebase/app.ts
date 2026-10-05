import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

/**
 * Firebase is loaded late, on purpose.
 *
 * Loading it up front put importing the SDK at the top level put 944kB in the entry bundle
 * against 253kB without it — nearly quadrupling the download for a feature
 * most players never touch, on a game meant for phones. Dynamic imports let
 * Vite split it out, so the game is playable while the SDK is still arriving,
 * and never fetched at all when unconfigured.
 *
 * These values are not secrets. A Firebase web config ships inside the client
 * by design; access is controlled by security rules, not by hiding the key.
 */
/**
 * Public values — a Firebase web config ships inside every client bundle by
 * design, and access is controlled by security rules, not by hiding the key.
 */
const config = {
  apiKey: 'AIzaSyAK4dKwU8cs1nP59v_9PgNAtwRD8N1GBas',
  authDomain: 'song-game-719a2.firebaseapp.com',
  projectId: 'song-game-719a2',
  storageBucket: 'song-game-719a2.firebasestorage.app',
  messagingSenderId: '996845404853',
  appId: '1:996845404853:web:276ac5c1d1776d28d6f4fc',
}

export interface FirebaseBundle {
  auth: Auth
  db: Firestore
}

let pending: Promise<FirebaseBundle | null> | null = null

/** Resolves to null whenever accounts are unavailable — never throws. */
export function loadFirebase(): Promise<FirebaseBundle | null> {
  if (!pending) {
    pending = (async () => {
      try {
        const [{ initializeApp }, authMod, { getFirestore }] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ])
        const app = initializeApp(config)
        const auth = authMod.getAuth(app)

        // Stay signed in across restarts. This is what "remember the login"
        // actually means: Firebase keeps a refresh token in IndexedDB and
        // exchanges it for a short-lived ID token. It is the SDK's default,
        // set explicitly here so it is a decision rather than an accident —
        // and because the alternative, storing a password to replay later,
        // would be a real hazard for no gain.
        try {
          await authMod.setPersistence(auth, authMod.browserLocalPersistence)
        } catch {
          // Private windows and blocked storage land here. The session then
          // lasts until the tab closes, which is the correct fallback.
        }

        return { auth, db: getFirestore(app) }
      } catch (err) {
        // A bad config, or a blocked CDN, costs the account features only.
        console.warn('Firebase unavailable; running without an account.', err)
        return null
      }
    })()
  }
  return pending
}
