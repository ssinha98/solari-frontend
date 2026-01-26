/**
 * Backend API utilities
 * Handles all communication with the backend API via Next.js API routes (CORS-safe)
 */

/**
 * Uploads a document to Pinecone via the backend API
 * @param namespace - The Pinecone namespace
 * @param filePath - The file path in Firebase Storage
 * @param nickname - The nickname for the document
 * @returns Promise that resolves when the upload is complete
 */
export async function uploadDocumentToPinecone(
  namespace: string,
  filePath: string,
  nickname: string
): Promise<void> {
  try {
    const apiUrl = `/api/pinecone_doc_upload`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace: namespace,
        file_path: filePath,
        nickname: nickname,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    return;
  } catch (error) {
    console.error("Error calling backend API:", error);
    throw error;
  }
}

/**
 * Uploads a website to Pinecone via the backend API
 * @param namespace - The Pinecone namespace
 * @param url - The website URL
 * @param nickname - The nickname for the website
 * @returns Promise that resolves when the upload is complete
 */
export async function uploadWebsiteToPinecone(
  namespace: string,
  url: string,
  nickname: string
): Promise<void> {
  try {
    const apiUrl = `/api/pinecone_website_upload`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace: namespace,
        url: url,
        nickname: nickname,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    return;
  } catch (error) {
    console.error("Error calling backend API:", error);
    throw error;
  }
}

/**
 * Creates an invite code for a team via the backend API
 * @param uid - The user ID
 * @param teamId - The team ID
 * @returns Promise that resolves with the invite code response
 */
export async function createTeamInviteCode(
  uid: string,
  teamId: string
): Promise<{ invite_code: string; ok: boolean; team_id: string }> {
  try {
    const apiUrl = `/api/teams/create_invite_code`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid,
        team_id: teamId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    return (await response.json()) as {
      invite_code: string;
      ok: boolean;
      team_id: string;
    };
  } catch (error) {
    console.error("Error calling create invite code API:", error);
    throw error;
  }
}

/**
 * Gets the creator's first name for a team via the backend API
 * @param teamId - The team ID
 * @param userId - The current user ID
 * @returns Promise that resolves with the creator first name response
 */
export async function getCreatorFirstName(
  teamId: string,
  userId: string
): Promise<{
  ok: boolean;
  creator_first_name?: string;
  creator_uid?: string;
  team_id?: string;
}> {
  try {
    const apiUrl = `/api/teams/get_creator_first_name`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_id: teamId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    return (await response.json()) as {
      ok: boolean;
      creator_first_name?: string;
      creator_uid?: string;
      team_id?: string;
    };
  } catch (error) {
    console.error("Error calling get creator first name API:", error);
    throw error;
  }
}

/**
 * Resolves an invite code to a team id via the backend API
 * @param inviteCode - The invite code to resolve
 * @returns Promise that resolves with the team id response
 */
export async function joinTeamInviteCode(
  inviteCode: string
): Promise<{ ok: boolean; invite_code: string; team_id: string }> {
  try {
    const apiUrl = `/api/team/join_team_invite_code`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invite_code: inviteCode,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    return (await response.json()) as {
      ok: boolean;
      invite_code: string;
      team_id: string;
    };
  } catch (error) {
    console.error("Error calling join team invite code API:", error);
    throw error;
  }
}

/**
 * Invites team members via the backend API
 * @param teamId - The team ID
 * @param emails - List of email addresses to invite
 * @returns Promise that resolves with the invite response
 */
export async function inviteTeamMembers(
  teamId: string,
  emails: string[],
  userId: string
): Promise<{
  ok: boolean;
  status?: string;
  error?: string;
  success?: boolean;
}> {
  try {
    const apiUrl = `/api/teams/invite_members`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamId,
        emails,
        userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      status?: string;
      error?: string;
      success?: boolean;
    };
    return {
      ok: data.status === "ok",
      status: data.status,
      error: data.error,
      success: data.success,
    };
  } catch (error) {
    console.error("Error calling invite members API:", error);
    throw error;
  }
}

/**
 * Lists team members via the backend API
 * @param teamId - The team ID
 * @param userId - The current user ID
 */
export async function listTeamMembers(
  teamId: string,
  userId: string
): Promise<{
  ok: boolean;
  members: Array<{
    displayName?: string;
    email?: string;
    photoURL?: string;
    role?: "admin" | "member";
    uid: string;
  }>;
  team_id?: string;
}> {
  try {
    const apiUrl = `/api/teams/list_members`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamId,
        userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      ok: boolean;
      members?: Array<{
        displayName?: string;
        email?: string;
        photoURL?: string;
        role?: "admin" | "member";
        uid: string;
      }>;
      team_id?: string;
    };

    return {
      ok: Boolean(data.ok),
      members: data.members ?? [],
      team_id: data.team_id,
    };
  } catch (error) {
    console.error("Error calling list members API:", error);
    throw error;
  }
}

/**
 * Lists agent members via the backend API
 * @param teamId - The team ID
 * @param agentId - The agent ID
 */
export async function listAgentMembers(
  teamId: string,
  agentId: string
): Promise<{
  success: boolean;
  members: Array<{
    displayName?: string;
    email?: string;
    role?: string;
    permission?: string;
    uid?: string;
    id?: string;
    photoURL?: string;
  }>;
}> {
  try {
    const apiUrl = `/api/agent/list_members`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_id: teamId,
        agent_id: agentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      members?: Array<{
        displayName?: string;
        email?: string;
        role?: string;
        permission?: string;
        uid?: string;
        id?: string;
        photoURL?: string;
      }>;
    };

    return {
      success: Boolean(data.success),
      members: data.members ?? [],
    };
  } catch (error) {
    console.error("Error calling list agent members API:", error);
    throw error;
  }
}

/**
 * Adds members to an agent via the backend API
 * @param teamId - The team ID
 * @param agentId - The agent ID
 * @param agentName - The agent name
 * @param members - Members to add
 */
export async function addAgentMembers(
  teamId: string,
  agentId: string,
  agentName: string,
  members: Array<{ email: string; permission: string }>
): Promise<{
  success: boolean;
  added?: Array<{
    email?: string;
    message?: string;
    permission?: string;
    uid?: string;
  }>;
  failures?: Array<{
    email?: string;
    message?: string;
  }>;
}> {
  try {
    const apiUrl = `/api/agent/add_members`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_id: teamId,
        agent_id: agentId,
        agent_name: agentName,
        members,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      added?: Array<{
        email?: string;
        message?: string;
        permission?: string;
        uid?: string;
      }>;
      failures?: Array<{
        email?: string;
        message?: string;
      }>;
    };

    return {
      success: Boolean(data.success),
      added: data.added ?? [],
      failures: data.failures ?? [],
    };
  } catch (error) {
    console.error("Error calling add agent members API:", error);
    throw error;
  }
}

/**
 * Removes a member from an agent via the backend API
 * @param teamId - The team ID
 * @param agentId - The agent ID
 * @param userId - The user ID to remove
 */
export async function removeAgentMember(
  teamId: string,
  agentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiUrl = `/api/agent/remove_members`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_id: teamId,
        agent_id: agentId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    return {
      success: Boolean(data.success),
      error: data.error,
    };
  } catch (error) {
    console.error("Error calling remove agent member API:", error);
    throw error;
  }
}

/**
 * Updates a team member role via the backend API
 * @param teamId - The team ID
 * @param userId - The target user ID
 * @param role - The new role
 */
export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: "admin" | "member"
): Promise<{
  ok: boolean;
  role?: "admin" | "member";
  team_id?: string;
  user_id?: string;
}> {
  try {
    const apiUrl = `/api/teams/update_member_role`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamId,
        userId,
        role,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      ok: boolean;
      role?: "admin" | "member";
      team_id?: string;
      user_id?: string;
    };

    return {
      ok: Boolean(data.ok),
      role: data.role,
      team_id: data.team_id,
      user_id: data.user_id,
    };
  } catch (error) {
    console.error("Error calling update member role API:", error);
    throw error;
  }
}

/**
 * Analyzes a table file to extract metadata (columns, types, row count, etc.)
 * @param userId - The user ID
 * @param agentId - The agent ID
 * @param documentId - The document ID (agent source document ID)
 * @returns Promise that resolves with the analysis response
 */
export async function analyzeTable(
  userId: string,
  agentId: string,
  documentId: string
): Promise<{
  column_count: number;
  columns: Record<
    string,
    { pandas_dtype: string; type: string; example_values: any[] }
  >;
  document_id: string;
  file_path: string;
  message: string;
  row_count: number;
  status: string;
}> {
  try {
    const apiUrl = `/api/table/analyze`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        agent_id: agentId,
        document_id: documentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling analyze table API:", error);
    throw error;
  }
}

/**
 * Response type from handle-rag-message API
 */
export interface AskPineconeResponse {
  answer?: string;
  response_summarized?: string; // For table sources
  sql?: string; // SQL query for table sources
  requestId?: string;
  suggestedSource?: string;
  table?: {
    columns: string[];
    rows: Array<Record<string, any>>;
    rows_returned?: number;
  };
  chosen_nickname?: string;
  metadata?: {
    chunks_used: number;
    context_length: number;
    namespace: string;
    nickname_filter: string | null;
    query: string;
    retrieved_chunks: Array<{
      id: string;
      metadata: {
        chunk_index?: number;
        file_path?: string;
        nickname?: string;
        text_preview?: string;
        description?: string;
        source?: string;
        sourceURL?: string;
        title?: string;
        url?: string;
        [key: string]: any;
      };
      score: number;
    }>;
    source_type_filter: string | null;
    userid: string;
  };
  success: boolean;
}

/**
 * Sends a query to Pinecone via the backend API
 * @param userId - The user ID
 * @param namespace - The Pinecone namespace
 * @param query - The user's query/question
 * @param agentId - The agent ID
 * @param nickname - Optional nickname of the source (if mentioned)
 * @returns Promise that resolves with the full response including answer and metadata
 */
export async function askPinecone(
  userId: string,
  teamId: string,
  namespace: string,
  query: string,
  agentId: string,
  nickname?: string,
  requestId?: string,
  modelProvider?: string
): Promise<AskPineconeResponse> {
  try {
    const apiUrl = `/api/handle-rag-message`;
    const requestBody = {
      userid: userId,
      team_id: teamId,
      namespace: namespace,
      query: query,
      agent_id: agentId,
      nickname: nickname || "",
      requestId: requestId || "",
      model_provider: modelProvider || "",
    };

    // Log the request being sent
    console.log("=== ask-pinecone API Request ===");
    console.log("URL:", apiUrl);
    console.log("Request Body:", JSON.stringify(requestBody, null, 2));
    console.log("Nickname passed:", nickname || "(empty)");
    console.log("================================");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data as AskPineconeResponse;
  } catch (error) {
    console.error("Error calling ask-pinecone API:", error);
    throw error;
  }
}

/**
 * Confirms a source selection and gets the answer
 * @param userId - The user ID
 * @param namespace - The Pinecone namespace
 * @param query - The user's query/question
 * @param nickname - The nickname of the source to confirm
 * @param agentId - The agent ID
 * @returns Promise that resolves with the full response including answer and metadata
 */
export async function confirmSource(
  userId: string,
  teamId: string,
  namespace: string,
  query: string,
  nickname: string,
  agentId: string,
  requestId?: string,
  sourceSuggestion?: string,
  modelProvider?: string
): Promise<AskPineconeResponse> {
  try {
    const apiUrl = `/api/source-confirmed`;
    const requestBody = {
      userid: userId,
      team_id: teamId,
      namespace: namespace,
      query: query,
      nickname: nickname,
      agent_id: agentId,
      requestId: requestId || "",
      sourceSuggestion: sourceSuggestion || "",
      model_provider: modelProvider || "",
    };

    // Log the request being sent
    console.log("=== source-confirmed API Request ===");
    console.log("URL:", apiUrl);
    console.log("Request Body:", JSON.stringify(requestBody, null, 2));
    console.log("================================");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data as AskPineconeResponse;
  } catch (error) {
    console.error("Error calling source-confirmed API:", error);
    throw error;
  }
}

/**
 * Starts a batch sync for Slack channels
 * @param userId - The user ID
 * @param agentId - The agent ID
 * @param channels - Array of channel objects with channel_id, channel_name, and team_id
 * @param timezone - Optional timezone (defaults to browser timezone)
 * @param limit - Optional limit for messages per channel (defaults to 500)
 * @returns Promise that resolves with the batch sync start response
 */
export async function startSlackBatchSync(
  userId: string,
  agentId: string,
  namespace: string,
  channels: Array<{
    channel_id: string;
    channel_name: string;
    nickname: string;
  }>,
  chunkN = 20,
  overlapN = 5
): Promise<{
  batch_id: string;
  next: {
    status_endpoint: string;
    tick_endpoint: string;
  };
  ok: boolean;
  status: string;
  total: number;
}> {
  try {
    const apiUrl = `/api/pinecone_slack_upload_batch`;
    const requestBody = {
      uid: userId,
      agent_id: agentId,
      namespace,
      chunk_n: chunkN,
      overlap_n: overlapN,
      channels,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling Slack batch sync start API:", error);
    throw error;
  }
}

/**
 * Gets the status of a Slack batch sync
 * @param userId - The user ID
 * @param agentId - The agent ID
 * @param batchId - The batch ID from the start response
 * @returns Promise that resolves with the batch sync status
 */
export async function getSlackBatchSyncStatus(
  userId: string,
  agentId: string,
  batchId: string
): Promise<any> {
  try {
    const apiUrl = `/api/pinecone_slack_upload_batch/status?uid=${userId}&agent_id=${agentId}&batch_id=${encodeURIComponent(batchId)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling Slack batch sync status API:", error);
    throw error;
  }
}

/**
 * Ticks/advances a Slack batch sync
 * @param userId - The user ID
 * @param agentId - The agent ID
 * @param batchId - The batch ID from the start response
 * @returns Promise that resolves with the tick response
 */
export async function tickSlackBatchSync(
  userId: string,
  agentId: string,
  batchId: string
): Promise<any> {
  try {
    const apiUrl = `/api/pinecone_slack_upload_batch/tick?uid=${userId}&agent_id=${agentId}&batch_id=${encodeURIComponent(batchId)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = null;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // ignore JSON parse failures and fall back to throwing
      }
      if (
        errorData?.error === "batch_not_running" &&
        errorData?.status === "done"
      ) {
        return errorData;
      }
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling Slack batch sync tick API:", error);
    throw error;
  }
}

/**
 * Updates an agent's model provider via the backend API
 * @param userId - The user ID
 * @param agentId - The agent ID
 * @param modelProvider - The selected model provider
 */
export async function updateAgentModelProvider(
  userId: string,
  agentId: string,
  modelProvider: string
): Promise<{ success?: boolean; ok?: boolean; error?: string }> {
  try {
    const apiUrl = `/api/agent/update_model`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        agent_id: agentId,
        model_provider: modelProvider,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }

    return (await response.json()) as {
      success?: boolean;
      ok?: boolean;
      error?: string;
    };
  } catch (error) {
    console.error("Error calling update model provider API:", error);
    throw error;
  }
}
