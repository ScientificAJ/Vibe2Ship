import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { auth } from '../firebase';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.create'
];

let cachedAccessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  listeners.forEach(listener => listener(cachedAccessToken));
};

export const addTokenListener = (listener: (token: string | null) => void) => {
  listeners.add(listener);
  listener(cachedAccessToken);
  return () => {
    listeners.delete(listener);
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const provider = new GoogleAuthProvider();
    
    // Add Workspace Scopes for Drive, Sheets, Docs, Calendar, Tasks, and Chat
    WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
    
    // Enable prompt select_account so the user can easily switch or authorize
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google Access Token from Authentication response');
    }
    
    setAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      console.warn('Google Sign-In cancelled by user:', error.message || error);
    } else {
      console.error('Google Sign-In Error:', error);
    }
    throw error;
  }
};

export const logoutWorkspace = () => {
  setAccessToken(null);
};
