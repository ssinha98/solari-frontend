"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  File,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  Menu,
} from "lucide-react";
import { IoIosDocument } from "react-icons/io";
import { IoDocuments } from "react-icons/io5";
import { CiGlobe, CiViewTable } from "react-icons/ci";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getAgentSources } from "@/tools/agent_tools";
import { askPinecone, confirmSource, AskPineconeResponse } from "@/tools/api";
import { auth, db } from "@/tools/firebase";
import { doc, getDoc } from "firebase/firestore";
import { CustomEditor } from "@/components/custom-editor";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Helper function to get file type icon based on type or file extension
function getFileTypeIcon(source: { type?: string; name?: string }) {
  const type = source.type?.toLowerCase();

  // Check for specific types first
  switch (type) {
    case "document":
      return <IoIosDocument className="h-4 w-4" />;
    case "website":
      return <CiGlobe className="h-4 w-4" />;
    case "table":
      return <CiViewTable className="h-4 w-4" />;
    case "jira":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=oROcPah5ues6&format=png&color=000000"
          alt="Jira"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "confluence":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
          alt="Confluence"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "slack":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
          alt="Slack"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "google drive":
    case "googledrive":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=13630&format=png&color=000000"
          alt="Google Drive"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "notion":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=nvtEH6DpqruC&format=png&color=000000"
          alt="Notion"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "gong":
      return (
        <Image
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiRxcqf6E93pRSDFSa2o8vuXjzc6IdaafuWA&s"
          alt="Gong"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
  }

  // Fallback to file extension if type is not specified
  if (source.name) {
    const extension = source.name.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "md":
      case "txt":
        return <File className="h-4 w-4" />;
      case "docx":
      case "doc":
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  }

  return <File className="h-4 w-4" />;
}

// Helper function to render text with highlighted mentions
function renderTextWithMentions(text: string, mentionLabels: string[] = []) {
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;

  // Sort mentions by length (longest first) to match longer mentions before shorter ones
  // This prevents "@revenue csv" from matching when "@revenue csv - Sheet1" should match
  const sortedMentions = [...mentionLabels].sort((a, b) => b.length - a.length);

  // Find all mentions in the text
  const mentionMatches: Array<{ index: number; length: number; text: string }> =
    [];

  for (const label of sortedMentions) {
    const mentionText = `@${label}`;
    let searchIndex = 0;

    while (true) {
      const index = text.indexOf(mentionText, searchIndex);
      if (index === -1) break;

      // Check if this is a valid mention (not part of a longer word)
      // It should be at word boundary (start of string, after space/punctuation, or before space/punctuation/end)
      const beforeChar = index > 0 ? text[index - 1] : " ";
      const afterChar =
        index + mentionText.length < text.length
          ? text[index + mentionText.length]
          : " ";

      // Valid if before is whitespace/punctuation/start and after is whitespace/punctuation/end
      if (/[\s\W]|^/.test(beforeChar) && /[\s\W]|$/.test(afterChar)) {
        mentionMatches.push({
          index,
          length: mentionText.length,
          text: mentionText,
        });
      }

      searchIndex = index + 1;
    }
  }

  // Sort matches by index
  mentionMatches.sort((a, b) => a.index - b.index);

  // Remove overlapping matches (keep the first one)
  const nonOverlappingMatches: Array<{
    index: number;
    length: number;
    text: string;
  }> = [];
  for (const match of mentionMatches) {
    const overlaps = nonOverlappingMatches.some(
      (existing) =>
        match.index < existing.index + existing.length &&
        match.index + match.length > existing.index
    );
    if (!overlaps) {
      nonOverlappingMatches.push(match);
    }
  }

  // Build the parts array
  for (const match of nonOverlappingMatches) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the mention with styling
    parts.push(
      <span
        key={match.index}
        className="font-bold"
        style={{ color: "#303AAF" }}
      >
        {match.text}
      </span>
    );

    lastIndex = match.index + match.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: AskPineconeResponse["metadata"];
  sql?: string;
  table?: {
    columns: string[];
    rows: Array<Record<string, any>>;
    rows_returned?: number;
  };
  pendingConfirmation?: {
    chosenNickname: string;
    countdown: number;
    query: string;
    namespace: string;
    agentId: string;
    userId: string;
  };
}

export function RunChat({ agentId }: { agentId: string | null }) {
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSources, setCurrentSources] = useState<
    Array<{ id: string; name?: string; nickname?: string; type?: string }>
  >([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState<
    AskPineconeResponse["metadata"] | null
  >(null);
  const [agentName, setAgentName] = useState<string>("");
  const [sourceSelectionDialogOpen, setSourceSelectionDialogOpen] =
    useState(false);
  const [pendingConfirmationMessageId, setPendingConfirmationMessageId] =
    useState<string | null>(null);
  const countdownTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editorRef = useRef<any>(null);

  // Helper function to extract mention nickname from message text
  const extractMentionNickname = (text: string): string | undefined => {
    if (!currentSources.length) return undefined;

    // Sort sources by nickname/name length (longest first) to match longer mentions first
    // This prevents "@meeting" from matching when "@meeting notes" should match
    const sortedSources = [...currentSources].sort((a, b) => {
      const aLabel = (a.nickname || a.name || "").length;
      const bLabel = (b.nickname || b.name || "").length;
      return bLabel - aLabel;
    });

    // Check each source to see if its nickname or name appears as a mention
    for (const source of sortedSources) {
      const nickname = source.nickname;
      const name = source.name;

      // Check if nickname appears as @nickname in the text
      if (nickname) {
        const mentionText = `@${nickname}`;
        const index = text.indexOf(mentionText);
        if (index !== -1) {
          // Verify it's a valid mention (word boundary check)
          const beforeChar = index > 0 ? text[index - 1] : " ";
          const afterIndex = index + mentionText.length;
          const afterChar = afterIndex < text.length ? text[afterIndex] : " ";

          // Valid if before is whitespace/punctuation/start and after is whitespace/punctuation/end
          if (/[\s\W]|^/.test(beforeChar) && /[\s\W]|$/.test(afterChar)) {
            return nickname;
          }
        }
      }

      // Check if name appears as @name in the text (if no nickname matched)
      if (name) {
        const mentionText = `@${name}`;
        const index = text.indexOf(mentionText);
        if (index !== -1) {
          // Verify it's a valid mention (word boundary check)
          const beforeChar = index > 0 ? text[index - 1] : " ";
          const afterIndex = index + mentionText.length;
          const afterChar = afterIndex < text.length ? text[afterIndex] : " ";

          // Valid if before is whitespace/punctuation/start and after is whitespace/punctuation/end
          if (/[\s\W]|^/.test(beforeChar) && /[\s\W]|$/.test(afterChar)) {
            return name;
          }
        }
      }
    }

    return undefined;
  };

  const handleSend = async (textContent?: string) => {
    // Get text from parameter (from Enter key) or from editor (from button click)
    const content = textContent || editorRef.current?.getText() || "";
    if (!content.trim()) return;

    const user = auth.currentUser;
    if (!user) {
      console.error("User must be authenticated to send a message");
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
    setIsLoadingResponse(true);

    try {
      // Get user's pinecone_namespace from Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("User document not found");
      }

      const userData = userSnap.data();
      const namespace = userData.pinecone_namespace;

      if (!namespace) {
        throw new Error("pinecone_namespace not found in user document");
      }

      // Extract mention nickname if present
      const nickname = extractMentionNickname(content);

      // Log extracted nickname for debugging
      // console.log("=== Message Send Debug ===");
      // console.log("Message content:", content);
      // console.log("Extracted nickname:", nickname || "(none)");
      // console.log(
      //   "Current sources:",
      //   currentSources.map((s) => ({
      //     id: s.id,
      //     nickname: s.nickname,
      //     name: s.name,
      //     type: s.type,
      //   }))
      // );
      // console.log("========================");

      // Call the API
      if (!agentId) {
        throw new Error("Agent ID is required");
      }

      const response = await askPinecone(
        user.uid,
        namespace,
        content,
        agentId,
        nickname
      );

      // Check if response needs source confirmation
      if (
        response.chosen_nickname &&
        !response.answer &&
        !response.response_summarized
      ) {
        // Show countdown message for source confirmation
        const confirmationMessageId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
          id: confirmationMessageId,
          role: "assistant",
          content: `Using '${response.chosen_nickname}' to answer question. Doesn't look right? Choose another source in 5 seconds.`,
          pendingConfirmation: {
            chosenNickname: response.chosen_nickname,
            countdown: 5,
            query: content,
            namespace: namespace,
            agentId: agentId,
            userId: user.uid,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setPendingConfirmationMessageId(confirmationMessageId);
      } else if (response.response_summarized || response.answer) {
        // Direct answer - display immediately (prioritize response_summarized for table sources)
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.response_summarized || response.answer || "",
          metadata: response.metadata,
          sql: response.sql,
          table: response.table,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Handle unexpected response structure
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, I received an unexpected response from the backend.`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Failed to get assistant response:", error);
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoadingResponse(false);
    }
  };

  // Handle source confirmation
  const handleSourceConfirmation = async (
    messageId: string,
    chosenNickname: string,
    originalQuery: string,
    namespace: string,
    agentId: string,
    userId: string
  ) => {
    // Clear any active countdown for this message
    const timer = countdownTimersRef.current.get(messageId);
    if (timer) {
      clearInterval(timer);
      countdownTimersRef.current.delete(messageId);
    }

    setIsLoadingResponse(true);
    try {
      const response = await confirmSource(
        userId,
        namespace,
        originalQuery,
        chosenNickname,
        agentId
      );

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content:
                  response.response_summarized ||
                  response.answer ||
                  "No answer provided.",
                metadata: response.metadata,
                sql: response.sql,
                table: response.table,
                pendingConfirmation: undefined, // Clear pending state
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Failed to confirm source:", error);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: `Error confirming source: ${error instanceof Error ? error.message : "Unknown error"}`,
                pendingConfirmation: undefined,
              }
            : msg
        )
      );
    } finally {
      setIsLoadingResponse(false);
      setSourceSelectionDialogOpen(false);
      setPendingConfirmationMessageId(null);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (!pendingConfirmationMessageId) return;

    // Start countdown timer
    let currentCountdown = 5;
    const timer = setInterval(() => {
      currentCountdown -= 1;
      setMessages((prevMessages) => {
        const message = prevMessages.find(
          (m) => m.id === pendingConfirmationMessageId
        );
        if (!message || !message.pendingConfirmation) {
          clearInterval(timer);
          countdownTimersRef.current.delete(pendingConfirmationMessageId);
          return prevMessages;
        }

        if (currentCountdown <= 0) {
          clearInterval(timer);
          countdownTimersRef.current.delete(pendingConfirmationMessageId);
          // Use the message data we have here
          handleSourceConfirmation(
            message.id,
            message.pendingConfirmation.chosenNickname,
            message.pendingConfirmation.query,
            message.pendingConfirmation.namespace,
            message.pendingConfirmation.agentId,
            message.pendingConfirmation.userId
          );
          setPendingConfirmationMessageId(null);
          return prevMessages;
        }

        return prevMessages.map((msg) =>
          msg.id === pendingConfirmationMessageId && msg.pendingConfirmation
            ? {
                ...msg,
                pendingConfirmation: {
                  ...msg.pendingConfirmation,
                  countdown: currentCountdown,
                },
              }
            : msg
        );
      });
    }, 1000);

    countdownTimersRef.current.set(pendingConfirmationMessageId, timer);

    // Cleanup on unmount or when pendingConfirmationMessageId changes
    return () => {
      if (countdownTimersRef.current.has(pendingConfirmationMessageId)) {
        clearInterval(
          countdownTimersRef.current.get(pendingConfirmationMessageId)!
        );
        countdownTimersRef.current.delete(pendingConfirmationMessageId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirmationMessageId]);

  // Fetch sources from Firestore when agentId is available
  useEffect(() => {
    const fetchSources = async () => {
      if (!agentId) {
        setCurrentSources([]);
        return;
      }

      try {
        setIsLoadingSources(true);
        const sources = await getAgentSources(agentId);
        setCurrentSources(sources);
      } catch (error) {
        console.error("Failed to fetch sources:", error);
        setCurrentSources([]);
      } finally {
        setIsLoadingSources(false);
      }
    };

    fetchSources();
  }, [agentId]);

  // Fetch agent name when agentId is available
  useEffect(() => {
    const fetchAgentName = async () => {
      if (!agentId) {
        setAgentName("");
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) return;

        const agentRef = doc(db, "users", user.uid, "agents", agentId);
        const agentSnap = await getDoc(agentRef);

        if (agentSnap.exists()) {
          const agentData = agentSnap.data();
          setAgentName(agentData.name || "Source chat agent");
        }
      } catch (error) {
        console.error("Failed to fetch agent name:", error);
        setAgentName("Source chat agent");
      }
    };

    fetchAgentName();
  }, [agentId]);

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      {/* Left Box - Sources (Minimizable) */}
      {sourcesExpanded ? (
        <div className="w-80 rounded-lg bg-muted p-6 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">sources</h2>
            <button
              onClick={() => setSourcesExpanded(false)}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingSources ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading sources...
              </p>
            ) : currentSources.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      type
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      nickname
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentSources.map((source) => (
                    <tr key={source.id} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          {getFileTypeIcon(source)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {source.nickname || source.name || "Untitled"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sources found
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="w-12 flex items-start pt-6">
          <button
            onClick={() => setSourcesExpanded(true)}
            className="p-2 hover:bg-accent rounded-md transition-colors flex items-center gap-2"
          >
            <IoDocuments className="h-4 w-4" />
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Right Box - Chat Interface */}
      <div className="flex-1 rounded-lg bg-muted p-6 flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Start a conversation by asking a question...
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border"
                    } ${
                      msg.role === "assistant" && msg.metadata
                        ? "cursor-pointer hover:bg-accent transition-colors"
                        : ""
                    } ${
                      msg.role === "assistant" && msg.pendingConfirmation
                        ? "cursor-pointer hover:bg-accent transition-colors"
                        : ""
                    }`}
                    onClick={() => {
                      if (msg.role === "assistant" && msg.metadata) {
                        setSelectedMetadata(msg.metadata);
                      } else if (
                        msg.role === "assistant" &&
                        msg.pendingConfirmation
                      ) {
                        setPendingConfirmationMessageId(msg.id);
                        setSourceSelectionDialogOpen(true);
                        // Clear the countdown timer when dialog opens
                        const timer = countdownTimersRef.current.get(msg.id);
                        if (timer) {
                          clearInterval(timer);
                          countdownTimersRef.current.delete(msg.id);
                        }
                      }
                    }}
                  >
                    {msg.pendingConfirmation ? (
                      <div>
                        <p className="text-sm">
                          Using '{msg.pendingConfirmation.chosenNickname}' to
                          answer question. Doesn't look right?{" "}
                        </p>
                        <p className="text-xs mt-2 flex items-center gap-1">
                          <span className="text-blue-600 dark:text-blue-400 underline cursor-pointer">
                            Click to choose another source in{" "}
                            <span className="font-bold">
                              {msg.pendingConfirmation.countdown}
                            </span>{" "}
                            seconds
                          </span>
                          <Menu className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm">
                          {msg.role === "user"
                            ? renderTextWithMentions(
                                msg.content,
                                currentSources.map(
                                  (s) => s.nickname || s.name || "Untitled"
                                )
                              )
                            : msg.content}
                        </p>
                        {msg.role === "assistant" && msg.sql && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              SQL Query:
                            </p>
                            <textarea
                              readOnly
                              value={msg.sql}
                              className="w-full p-2 text-xs font-mono bg-muted border rounded-md resize-none"
                              rows={Math.min(msg.sql.split("\n").length, 10)}
                            />
                          </div>
                        )}
                        {msg.role === "assistant" &&
                          msg.table &&
                          (() => {
                            const table = msg.table;
                            return (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Results:
                                </p>
                                <div className="border rounded-md overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        {table.columns.map((column) => (
                                          <TableHead
                                            key={column}
                                            className="text-xs"
                                          >
                                            {column}
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {table.rows.map((row, rowIndex) => (
                                        <TableRow key={rowIndex}>
                                          {table.columns.map((column) => (
                                            <TableCell
                                              key={column}
                                              className="text-xs"
                                            >
                                              {row[column] !== null &&
                                              row[column] !== undefined
                                                ? typeof row[column] ===
                                                  "number"
                                                  ? row[column].toLocaleString()
                                                  : String(row[column])
                                                : ""}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                {table.rows_returned !== undefined && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {table.rows_returned} row
                                    {table.rows_returned !== 1 ? "s" : ""}{" "}
                                    returned
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        {msg.role === "assistant" && msg.metadata && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Click to view details
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {isLoadingResponse && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg p-3 bg-background border border-border">
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex gap-2 min-w-0">
          <CustomEditor
            value={message}
            onChange={setMessage}
            onSend={handleSend}
            editorRef={editorRef}
            placeholder="Type your asdlfkjalsd;jf..."
            mentionItems={currentSources.map((source) => {
              // Map source type to MentionItem type
              let mentionType: "file" | "site" | "variable" = "file";
              const sourceType = source.type?.toLowerCase();
              if (sourceType === "website") {
                mentionType = "site";
              } else if (sourceType === "variable") {
                mentionType = "variable";
              }
              // Default to "file" for document, table, and other types

              return {
                id: source.id,
                label: source.nickname || source.name || "Untitled",
                type: mentionType,
                nickname: source.nickname,
                name: source.name,
              };
            })}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!message.trim() || isLoadingResponse}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metadata Dialog */}
      <AlertDialog
        open={selectedMetadata !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMetadata(null);
        }}
      >
        <AlertDialogContent
          className="max-w-4xl max-h-[80vh] overflow-y-auto"
          onOverlayClick={() => setSelectedMetadata(null)}
        >
          <button
            onClick={() => setSelectedMetadata(null)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Response Details</AlertDialogTitle>
            <AlertDialogDescription>
              Metadata and retrieved chunks from the query
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedMetadata && (
            <div className="space-y-4">
              {(() => {
                const nickname =
                  selectedMetadata.nickname_filter ||
                  (selectedMetadata as any).source_selection
                    ?.selected_nickname ||
                  (selectedMetadata.retrieved_chunks &&
                    selectedMetadata.retrieved_chunks.length > 0 &&
                    selectedMetadata.retrieved_chunks[0]?.metadata.nickname) ||
                  "a source";
                const agentNameText = agentName || "The agent";
                const fullText = `${agentNameText} decided ${nickname} was most similar to the query based on the source description, previous queries, and the contents of the source.`;

                // Split the text to insert styled nickname
                const parts = fullText.split(nickname);

                return (
                  <Alert variant="default">
                    <AlertTitle>Source Selection</AlertTitle>
                    <AlertDescription>{fullText}</AlertDescription>
                  </Alert>
                );
              })()}

              <Accordion
                type="single"
                collapsible
                className="w-full bg-muted/50 border rounded-lg p-2"
              >
                <AccordionItem
                  value="technical-details"
                  className="border-none"
                >
                  <AccordionTrigger>Technical details</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">
                        Query Information
                      </h4>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="font-medium">Query:</span>{" "}
                          {selectedMetadata.query}
                        </p>
                        <p>
                          <span className="font-medium">Namespace:</span>{" "}
                          {selectedMetadata.namespace}
                        </p>
                        {selectedMetadata.chunks_used !== undefined && (
                          <p>
                            <span className="font-medium">Chunks Used:</span>{" "}
                            {selectedMetadata.chunks_used}
                          </p>
                        )}
                        {selectedMetadata.context_length !== undefined && (
                          <p>
                            <span className="font-medium">Context Length:</span>{" "}
                            {selectedMetadata.context_length.toLocaleString()}
                          </p>
                        )}
                        {selectedMetadata.nickname_filter && (
                          <p>
                            <span className="font-medium">
                              Nickname Filter:
                            </span>{" "}
                            {selectedMetadata.nickname_filter}
                          </p>
                        )}
                        {selectedMetadata.source_type_filter && (
                          <p>
                            <span className="font-medium">
                              Source Type Filter:
                            </span>{" "}
                            {selectedMetadata.source_type_filter}
                          </p>
                        )}
                        {(selectedMetadata as any).source_selection && (
                          <p>
                            <span className="font-medium">
                              Source Selection Method:
                            </span>{" "}
                            {(selectedMetadata as any).source_selection.method}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedMetadata.retrieved_chunks &&
                      selectedMetadata.retrieved_chunks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">
                            Retrieved Chunks (
                            {selectedMetadata.retrieved_chunks.length})
                          </h4>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {selectedMetadata.retrieved_chunks.map(
                              (chunk, index) => (
                                <div
                                  key={chunk.id}
                                  className="border rounded-lg p-3 bg-muted/50"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Chunk {index + 1}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Score: {chunk.score.toFixed(4)}
                                    </p>
                                  </div>
                                  {chunk.metadata.nickname && (
                                    <p className="text-sm font-medium mb-1">
                                      {chunk.metadata.nickname}
                                    </p>
                                  )}
                                  {chunk.metadata.file_path && (
                                    <p className="text-xs text-muted-foreground mb-1">
                                      {chunk.metadata.file_path}
                                    </p>
                                  )}
                                  {chunk.metadata.url && (
                                    <a
                                      href={chunk.metadata.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline mb-1 block"
                                    >
                                      {chunk.metadata.url}
                                    </a>
                                  )}
                                  {chunk.metadata.text_preview && (
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                                      {chunk.metadata.text_preview}
                                    </p>
                                  )}
                                  {chunk.metadata.chunk_index !== undefined && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Chunk Index: {chunk.metadata.chunk_index}
                                    </p>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Source Selection Dialog */}
      <AlertDialog
        open={sourceSelectionDialogOpen}
        onOpenChange={(open) => {
          setSourceSelectionDialogOpen(open);
          if (!open && pendingConfirmationMessageId) {
            // If dialog is closed without selection, let countdown continue
            // The countdown will auto-confirm when it reaches 0
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Choose a Source</AlertDialogTitle>
            <AlertDialogDescription>
              Select a source to use for answering your question
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            {currentSources.length > 0 ? (
              currentSources.map((source) => {
                const nickname = source.nickname || source.name || "Untitled";
                return (
                  <button
                    key={source.id}
                    onClick={async () => {
                      if (!pendingConfirmationMessageId) return;
                      const message = messages.find(
                        (m) => m.id === pendingConfirmationMessageId
                      );
                      if (!message || !message.pendingConfirmation) return;

                      await handleSourceConfirmation(
                        message.id,
                        nickname,
                        message.pendingConfirmation.query,
                        message.pendingConfirmation.namespace,
                        message.pendingConfirmation.agentId,
                        message.pendingConfirmation.userId
                      );
                    }}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getFileTypeIcon(source)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{nickname}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sources available
              </p>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
