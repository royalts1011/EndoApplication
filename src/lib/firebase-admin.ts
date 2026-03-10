/**
 * Firebase Admin SDK — server-side only.
 * On Firebase App Hosting, auto-initializes via Application Default Credentials.
 * Locally, requires FIREBASE_PROJECT_ID + FIREBASE_PRIVATE_KEY in .env.local.
 */
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

function initAdmin() {
  if (getApps().length > 0) return getApps()[0]

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    (process.env.FIREBASE_PROJECT_ID
      ? `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
      : undefined)

  if (process.env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      storageBucket,
    })
  }

  // Firebase App Hosting — ADC, bucket auto-resolved from project
  return initializeApp({ storageBucket })
}

export function getAdminDb() {
  initAdmin()
  return getFirestore()
}

export function getAdminStorage() {
  initAdmin()
  return getStorage()
}
