/**
 * Firebase Admin SDK — server-side only.
 * On Firebase App Hosting, auto-initializes via Application Default Credentials.
 * Locally, requires FIREBASE_PROJECT_ID in .env.local.
 */
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function initAdmin() {
  if (getApps().length > 0) return getApps()[0]

  // On Firebase App Hosting, ADC is available — no credentials needed.
  // Locally, fall back to service account env vars if set.
  if (process.env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  }

  return initializeApp()
}

export function getAdminDb() {
  initAdmin()
  return getFirestore()
}
