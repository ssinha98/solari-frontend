"use client";

import { useState, useEffect, useRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import {
  FileText,
  File,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  Menu,
  ThumbsUp,
  ThumbsDown,
  Check,
  Loader2,
} from "lucide-react";
import { IoIosDocument } from "react-icons/io";
import { IoDocuments } from "react-icons/io5";
import { CiGlobe, CiViewTable } from "react-icons/ci";
import { MdOutlineNotes } from "react-icons/md";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getAgentSources } from "@/tools/agent_tools";
import {
  askPinecone,
  confirmSource,
  AskPineconeResponse,
  updateAgentModelProvider,
} from "@/tools/api";
import { auth, db } from "@/tools/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { CustomEditor } from "@/components/custom-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePostHog } from "posthog-js/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_MODEL_PROVIDER = "gpt-4o-mini";

const MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  {
    value: "anthropic/claude-opus-4-5-20251101",
    label: "Claude Opus 4.5",
  },
  {
    value: "anthropic/claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
  },
  {
    value: "anthropic/claude-sonnet-4-5-20250929",
    label: "Claude Sonnet 4.5",
  },
  {
    value: "anthropic/claude-opus-4-1-20250805",
    label: "Claude Opus 4.1",
  },
  {
    value: "anthropic/claude-opus-4-20250514",
    label: "Claude Opus 4",
  },
  {
    value: "anthropic/claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
  },
  {
    value: "anthropic/claude-3-haiku-20240307",
    label: "Claude Haiku 3",
  },
  {
    value: "gemini/gemini-3-flash-preview",
    label: "Gemini 3 Flash (Preview)",
  },
  {
    value: "gemini/gemini-3-pro-preview",
    label: "Gemini 3 Pro (Preview)",
  },
  {
    value: "gemini/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
  },
  {
    value: "gemini/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
  },
  {
    value: "gemini/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
  },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "o4-mini", label: "o4 Mini (Reasoning)" },
  { value: "o3-mini", label: "o3 Mini (Reasoning)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const getModelLabel = (value: string) =>
  MODEL_OPTIONS.find((option) => option.value === value)?.label ?? value;

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
    case "confluence_page":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
          alt="Confluence"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "slack_channel":
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
        match.index + match.length > existing.index,
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
      <span key={match.index} className="font-bold text-white">
        {match.text}
      </span>,
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
  feedback?: "up" | "down";
  ratingDocId?: string;
  notes?: string;
  pendingConfirmation?: {
    chosenNickname: string;
    sourceSuggestion: string;
    countdown: number;
    query: string;
    namespace: string;
    agentId: string;
    userId: string;
    requestId: string;
  };
}

export function RunChat({ agentId }: { agentId: string | null }) {
  const posthog = usePostHog();
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
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteMessageId, setNoteMessageId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [agentName, setAgentName] = useState<string>("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [modelProvider, setModelProvider] = useState(DEFAULT_MODEL_PROVIDER);
  const [sourceSelectionDialogOpen, setSourceSelectionDialogOpen] =
    useState(false);
  const [pendingConfirmationMessageId, setPendingConfirmationMessageId] =
    useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [confirmingSourceId, setConfirmingSourceId] = useState<string | null>(
    null,
  );
  const countdownTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editorRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getAgentEventProps = () => {
    const eventProps: Record<string, string> = {};
    const userId = auth.currentUser?.uid;
    if (userId) {
      eventProps.user_id = userId;
    }
    if (teamId) {
      eventProps.team_id = teamId;
    }
    if (teamName) {
      eventProps.team_name = teamName;
    }
    if (agentId) {
      eventProps.agent_id = agentId;
      eventProps.agent_name = agentName || "Source chat agent";
    }
    return eventProps;
  };

  const handleModelProviderChange = async (value: string) => {
    setModelProvider(value);
    const user = auth.currentUser;
    if (!user || !agentId) return;

    try {
      await updateAgentModelProvider(user.uid, agentId, value);
    } catch (error) {
      console.error("Failed to update model provider:", error);
    }
  };

  const createRatingDoc = async (
    ratingDocId: string,
    question: string,
    answer: string,
    finalSource: string,
    suggestedSource: string,
    sourceProvided: boolean,
  ): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user || !agentId || !teamId) return null;

    try {
      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "agents",
        agentId,
        "ratings",
        ratingDocId,
      );
      await setDoc(
        ratingRef,
        {
          question,
          answer,
          final_source: finalSource,
          suggested_source: suggestedSource,
          source_provided: sourceProvided,
          rating: "",
        },
        { merge: true },
      );
      return ratingDocId;
    } catch (error) {
      console.error("Failed to create rating document:", error);
      return null;
    }
  };

  const toggleMessageFeedback = async (
    messageId: string,
    feedback: "up" | "down",
  ) => {
    const user = auth.currentUser;
    if (!user || !agentId || !teamId) return;

    const targetMessage = messages.find((msg) => msg.id === messageId);
    if (!targetMessage?.ratingDocId) return;

    const nextRating = targetMessage.feedback === feedback ? "" : feedback;

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              feedback: nextRating ? (nextRating as "up" | "down") : undefined,
            }
          : msg,
      ),
    );

    try {
      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "agents",
        agentId,
        "ratings",
        targetMessage.ratingDocId,
      );
      await updateDoc(ratingRef, { rating: nextRating });
      if (nextRating) {
        posthog?.capture("agent: rated", {
          ...getAgentEventProps(),
          rating_type: "thumb",
          rating_value: nextRating,
          response_content: targetMessage.content,
        });
      }
    } catch (error) {
      console.error("Failed to update rating:", error);
    }
  };

  const openNotesDialog = (msg: Message) => {
    setNoteMessageId(msg.id);
    setNoteText(msg.notes || "");
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    const user = auth.currentUser;
    if (!user || !agentId || !teamId || !noteMessageId) return;

    const targetMessage = messages.find((msg) => msg.id === noteMessageId);
    if (!targetMessage?.ratingDocId) return;

    try {
      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "agents",
        agentId,
        "ratings",
        targetMessage.ratingDocId,
      );
      await updateDoc(ratingRef, { notes: noteText });
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === noteMessageId ? { ...msg, notes: noteText } : msg,
        ),
      );
      posthog?.capture("agent: rated", {
        ...getAgentEventProps(),
        rating_type: "note",
        rating_value: noteText,
        response_content: targetMessage.content,
      });
      setNoteDialogOpen(false);
      setNoteMessageId(null);
      setNoteText("");
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };

  // const toggleMessageFeedback = async (
  //   messageId: string,
  //   feedback: "up" | "down"
  // ) => {
  //   const user = auth.currentUser;
  //   if (!user || !agentId) return;

  //   let nextRating = "";
  //   let ratingDocId: string | undefined;

  //   setMessages((prevMessages) =>
  //     prevMessages.map((msg) => {
  //       if (msg.id !== messageId) {
  //         return msg;
  //       }

  //       nextRating = msg.feedback === feedback ? "" : feedback;
  //       ratingDocId = msg.ratingDocId;
  //       return {
  //         ...msg,
  //         feedback: nextRating ? (nextRating as "up" | "down") : undefined,
  //       };
  //     })
  //   );

  //   if (!ratingDocId) return;

  //   try {
  //     const ratingRef = doc(
  //       db,
  //       "users",
  //       user.uid,
  //       "agents",
  //       agentId,
  //       "ratings",
  //       ratingDocId
  //     );
  //     await updateDoc(ratingRef, { rating: nextRating });
  //   } catch (error) {
  //     console.error("Failed to update rating:", error);
  //   }
  // };

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
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    const user = auth.currentUser;
    if (!user) {
      console.error("User must be authenticated to send a message");
      return;
    }

    const requestId = crypto.randomUUID();

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedContent,
    };

    posthog?.capture("agent: sent_message", {
      ...getAgentEventProps(),
      message_content: trimmedContent,
    });

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
    setIsLoadingResponse(true);

    try {
      if (!teamId) {
        throw new Error("Team ID not found");
      }

      // Get team pinecone_namespace from Firestore
      console.log("handleSend: using teamId", teamId);
      const teamRef = doc(db, "teams", teamId);
      const teamSnap = await getDoc(teamRef);

      if (!teamSnap.exists()) {
        throw new Error("Team document not found");
      }

      const teamData = teamSnap.data();
      console.log("handleSend: team data", teamData);
      const namespace = teamData.pinecone_namespace;

      if (!namespace) {
        throw new Error("pinecone_namespace not found in team document");
      }

      // Extract mention nickname if present
      const nickname = extractMentionNickname(trimmedContent);

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
        teamId,
        namespace,
        trimmedContent,
        agentId,
        nickname,
        requestId,
        modelProvider,
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
            sourceSuggestion: response.chosen_nickname,
            countdown: 5,
            query: trimmedContent,
            namespace: namespace,
            agentId: agentId,
            userId: user.uid,
            requestId: response.requestId || requestId,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setPendingConfirmationMessageId(confirmationMessageId);
      } else if (response.response_summarized || response.answer) {
        // Direct answer - display immediately (prioritize response_summarized for table sources)
        const messageId = (Date.now() + 1).toString();
        const answerText =
          response.response_summarized || response.answer || "";
        const ratingDocId = await createRatingDoc(
          response.requestId || requestId,
          trimmedContent,
          answerText,
          response.chosen_nickname || "",
          response.chosen_nickname || "",
          true,
        );
        const assistantMessage: Message = {
          id: messageId,
          role: "assistant",
          content: answerText,
          metadata: response.metadata,
          sql: response.sql,
          table: response.table,
          ratingDocId: ratingDocId || response.requestId || requestId,
        };
        posthog?.capture("agent:response", {
          ...getAgentEventProps(),
          response_content: answerText,
        });

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
    userId: string,
    requestId: string,
    sourceSuggestion: string,
  ) => {
    if (!teamId) {
      console.error("Team ID not found");
      return;
    }
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
        teamId,
        namespace,
        originalQuery,
        chosenNickname,
        agentId,
        requestId,
        sourceSuggestion,
        modelProvider,
      );
      const answerText =
        response.response_summarized ||
        response.answer ||
        "No answer provided.";
      const ratingDocId = await createRatingDoc(
        response.requestId || requestId,
        originalQuery,
        answerText,
        response.chosen_nickname || chosenNickname || "",
        response.suggestedSource || sourceSuggestion || "",
        false,
      );

      posthog?.capture("agent:response", {
        ...getAgentEventProps(),
        response_content: answerText,
      });

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: answerText,
                metadata: response.metadata,
                sql: response.sql,
                table: response.table,
                ratingDocId: ratingDocId || msg.ratingDocId,
                pendingConfirmation: undefined, // Clear pending state
              }
            : msg,
        ),
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
            : msg,
        ),
      );
    } finally {
      setIsLoadingResponse(false);
      setSourceSelectionDialogOpen(false);
      setPendingConfirmationMessageId(null);
      setSelectedSourceId(null);
      setConfirmingSourceId(null);
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
          (m) => m.id === pendingConfirmationMessageId,
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
            message.pendingConfirmation.userId,
            message.pendingConfirmation.requestId,
            message.pendingConfirmation.sourceSuggestion,
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
            : msg,
        );
      });
    }, 1000);

    countdownTimersRef.current.set(pendingConfirmationMessageId, timer);

    // Cleanup on unmount or when pendingConfirmationMessageId changes
    return () => {
      if (countdownTimersRef.current.has(pendingConfirmationMessageId)) {
        clearInterval(
          countdownTimersRef.current.get(pendingConfirmationMessageId)!,
        );
        countdownTimersRef.current.delete(pendingConfirmationMessageId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirmationMessageId]);

  useEffect(() => {
    const fetchTeamId = async () => {
      const user = auth.currentUser;
      if (!user) {
        setTeamId(null);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        setTeamId(nextTeamId ?? null);
      } catch (error) {
        console.error("Failed to load team ID:", error);
        setTeamId(null);
      }
    };

    fetchTeamId();
  }, []);

  useEffect(() => {
    const fetchTeamName = async () => {
      if (!teamId) {
        setTeamName("");
        return;
      }

      try {
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        const nextTeamName = teamSnap.data()?.team_name;
        setTeamName(typeof nextTeamName === "string" ? nextTeamName : "");
      } catch (error) {
        console.error("Failed to load team name:", error);
        setTeamName("");
      }
    };

    fetchTeamName();
  }, [teamId]);

  // Fetch sources from Firestore when agentId is available
  useEffect(() => {
    const fetchSources = async () => {
      if (!agentId || !teamId) {
        setCurrentSources([]);
        return;
      }

      try {
        setIsLoadingSources(true);
        const sources = await getAgentSources(teamId, agentId);
        setCurrentSources(sources);
      } catch (error) {
        console.error("Failed to fetch sources:", error);
        setCurrentSources([]);
      } finally {
        setIsLoadingSources(false);
      }
    };

    fetchSources();
  }, [agentId, teamId]);

  // Fetch agent name when agentId is available
  useEffect(() => {
    const fetchAgentName = async () => {
      if (!agentId || !teamId) {
        setAgentName("");
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) return;

        const agentRef = doc(db, "teams", teamId, "agents", agentId);
        const agentSnap = await getDoc(agentRef);

        if (agentSnap.exists()) {
          const agentData = agentSnap.data();
          setAgentName(agentData.name || "Source chat agent");
          setModelProvider(agentData.model_provider || DEFAULT_MODEL_PROVIDER);
        }
      } catch (error) {
        console.error("Failed to fetch agent name:", error);
        setAgentName("Source chat agent");
        setModelProvider(DEFAULT_MODEL_PROVIDER);
      }
    };

    fetchAgentName();
  }, [agentId, teamId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoadingResponse]);

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
                        ? "bg-[#2D47BC] text-white"
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
                        posthog?.capture("agent: response_details_opened", {
                          ...getAgentEventProps(),
                          response_content: msg.content,
                        });
                        setSelectedMetadata(msg.metadata);
                      } else if (
                        msg.role === "assistant" &&
                        msg.pendingConfirmation
                      ) {
                        posthog?.capture("agent: source_corrected", {
                          ...getAgentEventProps(),
                          source_suggestion:
                            msg.pendingConfirmation.sourceSuggestion,
                          chosen_nickname:
                            msg.pendingConfirmation.chosenNickname,
                          query: msg.pendingConfirmation.query,
                        });
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
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          {msg.role === "user" ? (
                            <p className="text-sm">
                              {renderTextWithMentions(
                                msg.content,
                                currentSources.map(
                                  (s) => s.nickname || s.name || "Untitled",
                                ),
                              )}
                            </p>
                          ) : (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              className="text-sm whitespace-pre-wrap"
                              components={{
                                p: ({
                                  children,
                                  ...props
                                }: ComponentPropsWithoutRef<"p">) => (
                                  <p className="mb-2 last:mb-0" {...props}>
                                    {children}
                                  </p>
                                ),
                                ul: ({
                                  children,
                                  ...props
                                }: ComponentPropsWithoutRef<"ul">) => (
                                  <ul
                                    className="list-disc pl-5 mb-2 last:mb-0"
                                    {...props}
                                  >
                                    {children}
                                  </ul>
                                ),
                                ol: ({
                                  children,
                                  ...props
                                }: ComponentPropsWithoutRef<"ol">) => (
                                  <ol
                                    className="list-decimal pl-5 mb-2 last:mb-0"
                                    {...props}
                                  >
                                    {children}
                                  </ol>
                                ),
                                li: ({
                                  children,
                                  ...props
                                }: ComponentPropsWithoutRef<"li">) => (
                                  <li className="mb-1 last:mb-0" {...props}>
                                    {children}
                                  </li>
                                ),
                                code: ({
                                  children,
                                  ...props
                                }: ComponentPropsWithoutRef<"code">) => (
                                  <code
                                    className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ),
                                a: ({
                                  children,
                                  ...props
                                }: ComponentPropsWithoutRef<"a">) => (
                                  <a
                                    className="text-blue-600 dark:text-blue-400 underline"
                                    {...props}
                                  >
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          )}
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
                                                    ? row[
                                                        column
                                                      ].toLocaleString()
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
                                      {table.rows_returned !== 1
                                        ? "s"
                                        : ""}{" "}
                                      returned
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                        {msg.role === "assistant" && msg.metadata && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Click to view details
                          </p>
                        )}
                        {msg.role === "assistant" &&
                          !msg.pendingConfirmation && (
                            <div
                              className="mt-3 flex items-center gap-3"
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleMessageFeedback(msg.id, "up");
                                      }}
                                      className={`rounded-md p-1 transition-colors ${
                                        msg.feedback === "up"
                                          ? "text-green-500"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                      aria-label="thumbs up"
                                    >
                                      <ThumbsUp className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Rate this response as helpful
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleMessageFeedback(msg.id, "down");
                                      }}
                                      className={`rounded-md p-1 transition-colors ${
                                        msg.feedback === "down"
                                          ? "text-red-500"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                      aria-label="Thumbs down"
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Rate this response as not helpful
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openNotesDialog(msg);
                                      }}
                                      className="relative rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                                      aria-label="Add note"
                                    >
                                      <MdOutlineNotes className="h-4 w-4" />
                                      {msg.notes?.trim() ? (
                                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-500" />
                                      ) : null}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Give the agent feedback on this response
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
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
              <div ref={messagesEndRef} />
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

        <div className="fixed bottom-6 right-6 z-50">
          <Select
            value={modelProvider}
            onValueChange={handleModelProviderChange}
          >
            <SelectTrigger className="rounded-lg px-6 h-14 shadow-lg hover:shadow-xl transition-shadow gap-2 bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground">
              <span className="flex items-center gap-2">
                <span>Model</span>
                <SelectValue
                  placeholder={getModelLabel(DEFAULT_MODEL_PROVIDER)}
                />
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              {MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                              ),
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

      {/* Notes Dialog */}
      <AlertDialog
        open={noteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNoteDialogOpen(false);
            setNoteMessageId(null);
            setNoteText("");
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Add a note about this response</AlertDialogTitle>
            <p className="text-sm text-muted-foreground"></p>
            This helps the agent improve over time.
          </AlertDialogHeader>
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            rows={5}
            className="w-full p-2 text-sm border rounded-md bg-background"
            placeholder="Add a note..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setNoteDialogOpen(false);
                setNoteMessageId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNote}>Save</Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Source Selection Dialog */}
      <AlertDialog
        open={sourceSelectionDialogOpen}
        onOpenChange={(open) => {
          setSourceSelectionDialogOpen(open);
          if (!open) {
            setSelectedSourceId(null);
            setConfirmingSourceId(null);
          }
          if (!open && pendingConfirmationMessageId) {
            // If dialog is closed without selection, let countdown continue
            // The countdown will auto-confirm when it reaches 0
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] p-0">
          <div className="sticky top-0 z-10 border-b bg-background px-6 py-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Choose a Source</AlertDialogTitle>
              <AlertDialogDescription>
                Select a source to use for answering your question
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="max-h-[calc(80vh-96px)] space-y-2 overflow-y-auto px-6 py-4">
            {currentSources.length > 0 ? (
              currentSources.map((source) => {
                const nickname = source.nickname || source.name || "Untitled";
                const isSelected = selectedSourceId === source.id;
                const isConfirming = confirmingSourceId === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={async () => {
                      if (!pendingConfirmationMessageId) return;
                      setSelectedSourceId(source.id);
                      setConfirmingSourceId(source.id);
                      const message = messages.find(
                        (m) => m.id === pendingConfirmationMessageId,
                      );
                      if (!message || !message.pendingConfirmation) return;

                      await handleSourceConfirmation(
                        message.id,
                        nickname,
                        message.pendingConfirmation.query,
                        message.pendingConfirmation.namespace,
                        message.pendingConfirmation.agentId,
                        message.pendingConfirmation.userId,
                        message.pendingConfirmation.requestId,
                        message.pendingConfirmation.sourceSuggestion,
                      );
                    }}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                    disabled={Boolean(confirmingSourceId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-4 w-4 items-center justify-center">
                        {isSelected && (
                          <Check className="h-4 w-4 text-emerald-500" />
                        )}
                      </span>
                      {getFileTypeIcon(source)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{nickname}</p>
                      </div>
                      {isConfirming && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
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
