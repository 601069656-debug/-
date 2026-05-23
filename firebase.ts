import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

console.log("Firebase Config in client:", firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Auth helper
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

// Firestore error handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const QUOTA_BLOCK_KEY = 'firestore_quota_blocked_until';

export function isFirestoreQuotaBlocked(): boolean {
  const blockedUntil = localStorage.getItem(QUOTA_BLOCK_KEY);
  if (!blockedUntil) return false;
  
  const blockedTime = parseInt(blockedUntil, 10);
  if (isNaN(blockedTime)) return false;
  
  if (Date.now() < blockedTime) {
    return true;
  }
  
  localStorage.removeItem(QUOTA_BLOCK_KEY);
  return false;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || null,
        email: provider.email || null,
        photoUrl: provider.photoURL || null
      })) || []
    }
  };
  
  const isQuotaError = errorMessage.includes('resource-exhausted') || errorMessage.includes('Quota limit exceeded');
  if (isQuotaError) {
    const blockedUntil = Date.now() + (24 * 60 * 60 * 1000);
    localStorage.setItem(QUOTA_BLOCK_KEY, blockedUntil.toString());
    console.error('Firestore Quota Exceeded. Disabling cloud sync for 24 hours.', JSON.stringify(errInfo));
    return;
  }

  const isPermissionError = errorMessage.includes('Missing or insufficient permissions');
  if (isPermissionError) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn('Firestore Warning: ', JSON.stringify(errInfo));
  }
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
