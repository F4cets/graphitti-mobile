import { getApp, initializeApp } from '@react-native-firebase/app';
import { getFirestore } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { 
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID 
} from '@env';

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID,
  databaseURL: `https://${FIREBASE_PROJECT_ID}.firebaseio.com`
};

let app;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}
console.log('Firebase app initialized');

export const auth = getAuth(app);
export const db = getFirestore(app);