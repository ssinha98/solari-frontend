import { signOut as firebaseSignOut, User } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Signs out the current user
 * @returns Promise that resolves when sign out is complete
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

/**
 * Creates or updates a user document in Firestore
 * @param user - The Firebase user object from authentication
 * @returns Promise that resolves when the user document is created/updated
 */
export async function createOrUpdateUserDocument(user: User): Promise<void> {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: serverTimestamp(),
    };

    // If user doesn't exist, add createdAt timestamp
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
    } else {
      // If user exists, just update the document
      await setDoc(userRef, userData, { merge: true });
    }
  } catch (error) {
    console.error("Error creating/updating user document:", error);
    throw error;
  }
}
