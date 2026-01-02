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
  namespace: string,
  query: string,
  agentId: string,
  nickname?: string
): Promise<AskPineconeResponse> {
  try {
    const apiUrl = `/api/handle-rag-message`;
    const requestBody = {
      userid: userId,
      namespace: namespace,
      query: query,
      agent_id: agentId,
      nickname: nickname || "",
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
  namespace: string,
  query: string,
  nickname: string,
  agentId: string
): Promise<AskPineconeResponse> {
  try {
    const apiUrl = `/api/source-confirmed`;
    const requestBody = {
      userid: userId,
      namespace: namespace,
      query: query,
      nickname: nickname,
      agent_id: agentId,
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
