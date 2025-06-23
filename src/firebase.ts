import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBD3okHLSOyGTfmRaZff0lvL0IOWs_gIyA", // IMPORTANT: Keep this secure, consider environment variables for production
  authDomain: "satdev-8e166.firebaseapp.com",
  databaseURL: "https://satdev-8e166-default-rtdb.firebaseio.com",
  projectId: "satdev-8e166",
  storageBucket: "satdev-8e166.appspot.com",
  messagingSenderId: "229459477139",
  appId: "1:229459477139:web:ae804fecc9d9f3bbdcc366",
  measurementId: "G-PP8GK88JN1"
};

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);
// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

export { db, auth };