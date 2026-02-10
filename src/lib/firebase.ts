/**
 * firebase.ts
 * Firebase app initialization.
 * Exports shared instances for Auth and Firestore.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDPLACEHOLDER_REPLACE_ME",
    authDomain: "calgary-barbell-app.firebaseapp.com",
    projectId: "calgary-barbell-app",
    storageBucket: "calgary-barbell-app.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:placeholder"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
