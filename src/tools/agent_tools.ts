import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { uploadDocumentToPinecone } from "./api";
import * as XLSX from "xlsx";

export type AgentType = "workflow" | "source chat" | "copilot";

export interface Agent {
  id: string;
  type: AgentType;
  name?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Source {
  id: string;
  name?: string;
  nickname?: string;
  type?: string;
  description?: string;
  [key: string]: any;
}

/**
 * Creates a new agent document in the user's agents subcollection
 * @param type - The type of agent to create
 * @returns Promise that resolves with the agent document ID
 */
export async function createAgent(type: AgentType): Promise<string> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to create an agent");
    }

    const agentsRef = collection(db, "users", user.uid, "agents");
    const docRef = await addDoc(agentsRef, {
      type,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating agent:", error);
    throw error;
  }
}

/**
 * Fetches all agents for the current user
 * @returns Promise that resolves with an array of agent documents
 */
export async function getUserAgents(): Promise<Agent[]> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to fetch agents");
    }

    const agentsRef = collection(db, "users", user.uid, "agents");
    const q = query(agentsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const agents: Agent[] = [];
    querySnapshot.forEach((doc) => {
      agents.push({
        id: doc.id,
        ...doc.data(),
      } as Agent);
    });

    return agents;
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw error;
  }
}

/**
 * Updates an agent's name
 * @param agentId - The ID of the agent to update
 * @param name - The new name for the agent
 * @returns Promise that resolves when the update is complete
 */
export async function updateAgentName(
  agentId: string,
  name: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to update an agent");
    }

    const agentRef = doc(db, "users", user.uid, "agents", agentId);
    await updateDoc(agentRef, {
      name,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating agent name:", error);
    throw error;
  }
}

/**
 * Fetches all sources for a specific agent from the sources subcollection
 * @param agentId - The ID of the agent
 * @returns Promise that resolves with an array of source documents
 */
export async function getAgentSources(agentId: string): Promise<Source[]> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to fetch sources");
    }

    const sourcesRef = collection(
      db,
      "users",
      user.uid,
      "agents",
      agentId,
      "sources"
    );
    const querySnapshot = await getDocs(sourcesRef);

    const sources: Source[] = [];
    querySnapshot.forEach((doc) => {
      sources.push({
        id: doc.id,
        ...doc.data(),
      } as Source);
    });

    return sources;
  } catch (error) {
    console.error("Error fetching sources:", error);
    throw error;
  }
}

/**
 * Adds a source to the user's sources subcollection
 * Uses the same simple logic as adding to agent's sources subcollection
 * @param agentId - The ID of the agent using this source
 * @param nickname - The nickname for the source
 * @param type - The type of source (e.g., "document", "website", "table")
 * @param name - Optional name for the source (e.g., URL, filename)
 * @returns Promise that resolves when the operation is complete
 */
async function addOrUpdateUserSource(
  agentId: string,
  nickname: string,
  type: string,
  name?: string,
  filePath?: string,
  description?: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to add a source");
    }

    // Use the same simple logic as agent's sources subcollection - just add the document
    const userSourcesRef = collection(db, "users", user.uid, "sources");
    await addDoc(userSourcesRef, {
      nickname,
      type,
      name: name || null,
      filePath: filePath || null,
      description: description || null,
      agents: [agentId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error adding user source:", error);
    throw error;
  }
}

/**
 * Converts a table file (xlsx, tsv) to CSV format
 * @param file - The file to convert
 * @returns Promise that resolves with a CSV File object
 */
export async function convertToCSV(file: File): Promise<File> {
  const fileName = file.name.toLowerCase();

  // If already CSV, return as-is
  if (fileName.endsWith(".csv")) {
    return file;
  }

  // Read file as array buffer
  const arrayBuffer = await file.arrayBuffer();

  if (fileName.endsWith(".xlsx")) {
    // Convert Excel to CSV
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    // Create a new File object with CSV content
    const csvBlob = new Blob([csv], { type: "text/csv" });
    const csvFileName = file.name.replace(/\.xlsx$/i, ".csv");
    return new File([csvBlob], csvFileName, { type: "text/csv" });
  }

  if (fileName.endsWith(".tsv")) {
    // Convert TSV to CSV (replace tabs with commas)
    const text = await file.text();
    const csv = text.replace(/\t/g, ",");

    // Create a new File object with CSV content
    const csvBlob = new Blob([csv], { type: "text/csv" });
    const csvFileName = file.name.replace(/\.tsv$/i, ".csv");
    return new File([csvBlob], csvFileName, { type: "text/csv" });
  }

  // If not a recognized format, return original
  return file;
}

/**
 * Uploads a file to Firebase Storage in the user's folder
 * Then calls the backend API to process the file with Pinecone (unless source type is "table")
 * @param file - The file to upload
 * @param nickname - The nickname for the source
 * @param sourceType - The type of source (e.g., "document", "table")
 * @returns Promise that resolves with the file path in Storage
 */
export async function uploadSourceFile(
  file: File,
  nickname: string,
  sourceType?: string
): Promise<string> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to upload a file");
    }

    // Create a unique filename to avoid conflicts
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `users/${user.uid}/files/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Upload the file to Firebase Storage
    await uploadBytes(storageRef, file);

    // Get the user document to fetch pinecone_namespace
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User document not found");
    }

    const userData = userSnap.data();
    const namespace = userData.pinecone_namespace;

    if (!namespace) {
      console.warn("pinecone_namespace not found in user document");
      // Still return the file path even if namespace is missing
      return storagePath;
    }

    // Call the backend API to process the file with Pinecone
    // Only do this if source type is not "table"
    // Don't block on this - if it fails, we still want to save to Firestore
    if (sourceType !== "table") {
      uploadDocumentToPinecone(namespace, storagePath, nickname).catch(
        (error) => {
          console.error(
            "Failed to upload document to Pinecone (non-blocking):",
            error
          );
          // Don't throw - allow Firestore save to proceed
        }
      );
    }

    // Return the storage path immediately so Firestore save can proceed
    return storagePath;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

/**
 * Adds a new source to an agent's sources subcollection
 * Also adds/updates the source in the user's sources subcollection with the agentId in the agents array
 * @param agentId - The ID of the agent
 * @param nickname - The nickname for the source
 * @param type - The type of source (e.g., "document", "website", "table")
 * @param name - Optional name for the source (e.g., URL, filename)
 * @param filePath - Optional file path in Firebase Storage
 * @param description - Optional description for the source
 * @returns Promise that resolves with the source document ID
 */
export async function addAgentSource(
  agentId: string,
  nickname: string,
  type: string,
  name?: string,
  filePath?: string,
  description?: string
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated to add a source");
  }

  let docRef;
  try {
    // Add source to agent's sources subcollection
    console.log("Step 1: Adding source to agent's subcollection...");
    console.log("Path: users/", user.uid, "/agents/", agentId, "/sources");
    const sourcesRef = collection(
      db,
      "users",
      user.uid,
      "agents",
      agentId,
      "sources"
    );
    docRef = await addDoc(sourcesRef, {
      nickname,
      type,
      name: name || null,
      filePath: filePath || null,
      description: description || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(
      "✓ Successfully added to agent's sources subcollection:",
      docRef.id
    );
  } catch (error: any) {
    console.error("✗ FAILED at Step 1 (adding to agent's sources):", error);
    console.error("Error code:", error?.code);
    console.error("Full error:", error);
    throw error;
  }

  try {
    // Also add source in user's sources subcollection with agents array
    console.log("Step 2: Adding source to user's subcollection...");
    console.log("Path: users/", user.uid, "/sources");
    await addOrUpdateUserSource(
      agentId,
      nickname,
      type,
      name,
      filePath,
      description
    );
    console.log("✓ Successfully added to user's sources subcollection");
  } catch (error: any) {
    console.error("✗ FAILED at Step 2 (adding to user's sources):", error);
    console.error("Error code:", error?.code);
    console.error("Full error:", error);
    // Don't throw here - we already added to agent's sources, so log but continue
    console.warn(
      "Warning: Source added to agent but failed to update user's sources collection"
    );
  }

  return docRef.id;
}

/**
 * Updates a source's nickname in both the agent's sources subcollection and the user's sources subcollection
 * @param agentId - The ID of the agent
 * @param sourceId - The ID of the source in the agent's sources subcollection
 * @param newNickname - The new nickname for the source
 * @param oldNickname - The old nickname (used to find it in user's sources)
 * @param type - The type of the source (used to find it in user's sources)
 * @returns Promise that resolves when the update is complete
 */
export async function updateSourceNickname(
  agentId: string,
  sourceId: string,
  newNickname: string,
  oldNickname: string,
  type: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to update a source");
    }

    // Update in agent's sources subcollection
    const agentSourceRef = doc(
      db,
      "users",
      user.uid,
      "agents",
      agentId,
      "sources",
      sourceId
    );
    await updateDoc(agentSourceRef, {
      nickname: newNickname,
      updatedAt: serverTimestamp(),
    });

    // Find and update in user's sources subcollection
    const userSourcesRef = collection(db, "users", user.uid, "sources");
    const q = query(
      userSourcesRef,
      where("nickname", "==", oldNickname),
      where("type", "==", type)
    );
    const querySnapshot = await getDocs(q);

    // Find the source that contains this agentId in its agents array
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const agentsArray = data.agents || [];

      if (agentsArray.includes(agentId)) {
        const userSourceRef = doc(db, "users", user.uid, "sources", docSnap.id);
        await updateDoc(userSourceRef, {
          nickname: newNickname,
          updatedAt: serverTimestamp(),
        });
        break; // Found and updated, no need to continue
      }
    }
  } catch (error) {
    console.error("Error updating source nickname:", error);
    throw error;
  }
}

/**
 * Updates a source's description in both the agent's sources subcollection and the user's sources subcollection
 * @param agentId - The ID of the agent
 * @param sourceId - The ID of the source in the agent's sources subcollection
 * @param newDescription - The new description for the source
 * @param nickname - The nickname of the source (used to find it in user's sources)
 * @param type - The type of the source (used to find it in user's sources)
 * @returns Promise that resolves when the update is complete
 */
export async function updateSourceDescription(
  agentId: string,
  sourceId: string,
  newDescription: string,
  nickname: string,
  type: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to update a source");
    }

    // Update in agent's sources subcollection
    const agentSourceRef = doc(
      db,
      "users",
      user.uid,
      "agents",
      agentId,
      "sources",
      sourceId
    );
    await updateDoc(agentSourceRef, {
      description: newDescription || null,
      updatedAt: serverTimestamp(),
    });

    // Find and update in user's sources subcollection
    const userSourcesRef = collection(db, "users", user.uid, "sources");
    const q = query(
      userSourcesRef,
      where("nickname", "==", nickname),
      where("type", "==", type)
    );
    const querySnapshot = await getDocs(q);

    // Find the source that contains this agentId in its agents array
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const agentsArray = data.agents || [];

      if (agentsArray.includes(agentId)) {
        const userSourceRef = doc(db, "users", user.uid, "sources", docSnap.id);
        await updateDoc(userSourceRef, {
          description: newDescription || null,
          updatedAt: serverTimestamp(),
        });
        break; // Found and updated, no need to continue
      }
    }
  } catch (error) {
    console.error("Error updating source description:", error);
    throw error;
  }
}

/**
 * Deletes a source from both the agent's sources subcollection and the user's sources subcollection
 * @param agentId - The ID of the agent
 * @param sourceId - The ID of the source in the agent's sources subcollection
 * @param nickname - The nickname of the source (used to find it in user's sources)
 * @param type - The type of the source (used to find it in user's sources)
 * @returns Promise that resolves when the deletion is complete
 */
export async function deleteSource(
  agentId: string,
  sourceId: string,
  nickname: string,
  type: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to delete a source");
    }

    // Delete from agent's sources subcollection
    const agentSourceRef = doc(
      db,
      "users",
      user.uid,
      "agents",
      agentId,
      "sources",
      sourceId
    );
    await deleteDoc(agentSourceRef);

    // Find and update/delete from user's sources subcollection
    const userSourcesRef = collection(db, "users", user.uid, "sources");
    const q = query(
      userSourcesRef,
      where("nickname", "==", nickname),
      where("type", "==", type)
    );
    const querySnapshot = await getDocs(q);

    // Find the source that contains this agentId in its agents array
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const agentsArray = data.agents || [];

      if (agentsArray.includes(agentId)) {
        const userSourceRef = doc(db, "users", user.uid, "sources", docSnap.id);

        // If this is the only agent, delete the document
        if (agentsArray.length === 1) {
          await deleteDoc(userSourceRef);
        } else {
          // Otherwise, remove the agentId from the agents array
          await updateDoc(userSourceRef, {
            agents: agentsArray.filter((id: string) => id !== agentId),
            updatedAt: serverTimestamp(),
          });
        }
        break; // Found and updated/deleted, no need to continue
      }
    }
  } catch (error) {
    console.error("Error deleting source:", error);
    throw error;
  }
}

/**
 * Deletes a table source completely: removes file from Storage and documents from both Firestore locations
 * @param agentId - The ID of the agent
 * @param sourceId - The ID of the source in the agent's sources subcollection
 * @param nickname - The nickname of the source (used to find it in user's sources)
 * @param filePath - The file path in Firebase Storage to delete
 * @returns Promise that resolves when the deletion is complete
 */
export async function deleteTableSource(
  agentId: string,
  sourceId: string,
  nickname: string,
  filePath: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to delete a source");
    }

    // Delete file from Firebase Storage
    if (filePath) {
      try {
        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
        console.log("✓ Deleted file from Storage:", filePath);
      } catch (error) {
        console.error("Error deleting file from Storage:", error);
        // Continue with Firestore deletion even if Storage deletion fails
      }
    }

    // Delete from agent's sources subcollection
    const agentSourceRef = doc(
      db,
      "users",
      user.uid,
      "agents",
      agentId,
      "sources",
      sourceId
    );
    await deleteDoc(agentSourceRef);
    console.log("✓ Deleted from agent's sources");

    // Find and delete from user's sources subcollection
    const userSourcesRef = collection(db, "users", user.uid, "sources");
    const q = query(
      userSourcesRef,
      where("nickname", "==", nickname),
      where("type", "==", "table")
    );
    const querySnapshot = await getDocs(q);

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const agentsArray = data.agents || [];

      if (agentsArray.includes(agentId)) {
        const userSourceRef = doc(db, "users", user.uid, "sources", docSnap.id);

        // If this is the only agent, delete the document
        if (agentsArray.length === 1) {
          await deleteDoc(userSourceRef);
          console.log("✓ Deleted from user's sources");
        } else {
          // Otherwise, remove the agentId from the agents array
          await updateDoc(userSourceRef, {
            agents: agentsArray.filter((id: string) => id !== agentId),
            updatedAt: serverTimestamp(),
          });
          console.log("✓ Removed agent from user's source");
        }
        break;
      }
    }
  } catch (error) {
    console.error("Error deleting table source:", error);
    throw error;
  }
}
