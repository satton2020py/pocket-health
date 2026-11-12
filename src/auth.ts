import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Web client ID from google-services.json (client_type 3).
const WEB_CLIENT_ID =
  '387456831462-jk7amsvgbol33jr20fqd5q2d58dk5tud.apps.googleusercontent.com';

let configured = false;

function configureOnce() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

// Returns the signed-in user, or null if the user cancelled.
export async function signInWithGoogle(): Promise<User | null> {
  configureOnce();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google sign-in returned no ID token');
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getAuth(), credential);
  return result.user;
}

export async function signOut(): Promise<void> {
  configureOnce();
  await GoogleSignin.signOut();
  await firebaseSignOut(getAuth());
}

export function onUserChanged(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getAuth(), callback);
}
