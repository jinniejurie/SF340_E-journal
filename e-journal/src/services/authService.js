import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateEmail as firebaseUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

export const signup = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const signOut = () => firebaseSignOut(auth);

/** Re-authenticate the user with email + password (e.g. before updating email). */
export const reauthenticateWithPassword = (user, email, password) => {
  const credential = EmailAuthProvider.credential(email, password);
  return reauthenticateWithCredential(user, credential);
};

/** Update the user's email in Firebase Auth. Call reauthenticateWithPassword first if required. */
export const updateUserEmail = (user, newEmail) =>
  firebaseUpdateEmail(user, newEmail);
