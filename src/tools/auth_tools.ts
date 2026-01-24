import { signOut as firebaseSignOut, User } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { createTeamInviteCode, joinTeamInviteCode } from "@/tools/api";

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

export async function getUserDocument(uid: string) {
  const userRef = doc(db, "users", uid);
  return getDoc(userRef);
}

/**
 * Creates or updates a user document in Firestore
 * @param user - The Firebase user object from authentication
 * @returns Promise that resolves when the user document is created/updated
 */
export async function createOrUpdateUserDocument(
  user: User,
  selectedOption?: "join" | "create",
  inviteCode?: string
): Promise<string | null> {
  let createdTeamId: string | null = null;
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
      if (!selectedOption) {
        throw new Error("Team selection is required for new users.");
      }
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
    } else {
      // If user exists, just update the document
      await setDoc(userRef, userData, { merge: true });
    }

    if (selectedOption === "create") {
      const teamRef = doc(collection(db, "teams"));
      const teamId = teamRef.id;
      createdTeamId = teamId;

      await setDoc(teamRef, {
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      try {
        const response = await createTeamInviteCode(user.uid, teamId);
        if (response.ok && response.invite_code) {
          await setDoc(
            teamRef,
            { invite_code: response.invite_code },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Failed to create invite code:", error);
      }

      await setDoc(
        userRef,
        {
          teamId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const teamUserRef = doc(db, "teams", teamId, "users", user.uid);
      await setDoc(teamUserRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: "admin",
        show_onboarding: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (selectedOption === "join") {
      if (!inviteCode) {
        throw new Error("Invite code is required to join a team.");
      }

      const response = await joinTeamInviteCode(inviteCode);
      if (!response.ok || !response.team_id) {
        throw new Error("Invalid invite code.");
      }

      const teamId = response.team_id;

      await setDoc(
        userRef,
        {
          teamId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const teamUserRef = doc(db, "teams", teamId, "users", user.uid);
      await setDoc(teamUserRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: "member",
        show_onboarding: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return createdTeamId;
  } catch (error) {
    console.error("Error creating/updating user document:", error);
    throw error;
  }
}
