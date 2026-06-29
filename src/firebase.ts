import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAfT12090XlyElIw1TdQcs2VoA5Es3r4DI",
  authDomain: "strong-graph-p71nt.firebaseapp.com",
  projectId: "strong-graph-p71nt",
  storageBucket: "strong-graph-p71nt.firebasestorage.app",
  messagingSenderId: "693185427726",
  appId: "1:693185427726:web:b0a8f565b7469872cf7f5f"
};

const app = initializeApp(firebaseConfig);

// Enable offline persistence for better mobile-first local capabilities
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const storage = getStorage(app);
