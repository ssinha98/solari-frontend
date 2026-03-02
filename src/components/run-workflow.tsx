"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/tools/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Minimize2,
  Maximize2,
  X,
  Loader2,
  Check,
  Trash2,
  Info,
  FileText,
  Upload,
  Menu,
  ChevronDown,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  CustomDateRangePicker,
  type CustomDateRangeValue,
} from "@/components/ui/DateTimePicker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEditor, EditorContent } from "@tiptap/react";
import TiptapDocument from "@tiptap/extension-document";
import TiptapParagraph from "@tiptap/extension-paragraph";
import TiptapText from "@tiptap/extension-text";
import TiptapHardBreak from "@tiptap/extension-hard-break";
import Mention from "@tiptap/extension-mention";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectorService =
  | "slack"
  | "notion"
  | "gong"
  | "jira"
  | "confluence"
  | "facebook_ads"
  | "linkedin_ads"
  | "apollo";

type EvalType = "llm_judge" | "toxicity" | "pii" | "regex" | "proximity";

type NodeKind =
  | "trigger"
  | "llm"
  | "connector"
  | "eval"
  | "forReview"
  | "complete"
  | "action"
  | "condition";

interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  description?: string;
  // connector
  connectorService?: ConnectorService;
  connectorAction?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  slackFilter?:
    | "today"
    | "last_week"
    | "last_month"
    | "message_count"
    | "custom";
  slackMessageCount?: number;
  slackCustomRange?: CustomDateRangeValue;
  // slackOutputVariable?: string;
  // shared output variable (all node types)
  outputVariable?: string;
  // requires input variable (llm, connector, output, action, condition)
  requiresInputVariable?: boolean;
  inputVariableName?: string;
  inputVariableType?: "string" | "file";
  // gong
  gongAction?: "get_call" | "get_calls";
  gongCallId?: string;
  gongFilter?: "date_range" | "by_rep" | "by_account" | "min_duration";
  gongCustomRange?: CustomDateRangeValue;
  gongRep?: string;
  gongAccount?: string;
  gongMinDuration?: string;
  // apollo
  apolloAction?:
    | "search_people"
    | "search_companies"
    | "enrich_person"
    | "enrich_company";
  apolloJobTitle?: string;
  apolloCompanyName?: string;
  apolloLocation?: string;
  apolloIndustry?: string;
  apolloEmployeeRange?: string;
  apolloPersonEmail?: string;
  apolloPersonLinkedin?: string;
  apolloCompanyDomain?: string;
  // confluence
  confluenceSelectedPages?: Array<{
    id: string;
    title: string;
    spaceKey?: string;
  }>;
  // jira
  jiraSelectedTickets?: Array<{
    id: string;
    key: string;
    summary: string;
    project: string;
    status: string;
    issueType: string;
    assignee?: string;
  }>;
  // eval
  evalType?: EvalType;
  evalThreshold?: number;
  evalCriteria?: string;
  evalInputVariable?: string;
  evalModel?: string;
  evalSystemPrompt?: string;
  evalUserPrompt?: string;
  evalPassNodeId?: string;
  evalFailNodeId?: string;
  evalProximityReferenceType?: "file" | "website";
  evalProximityFileId?: string;
  evalProximityFileName?: string;
  evalProximityFilePath?: string;
  evalProximityWebsite?: string;
  // trigger
  triggerMethod?: "GET" | "POST" | "PUT" | "DELETE";
  webhookPath?: string;
  // llm
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  // condition
  conditionExpression?: string;
  // action
  actionType?: string;
  actionParams?: string;
  // output
  outputFormat?: "json" | "text" | "markdown";
  outputDestination?: string;
}

// ─── Node Config ─────────────────────────────────────────────────────────────

const CONNECTOR_META: Record<
  ConnectorService,
  { label: string; icon: string }
> = {
  slack: { label: "Slack", icon: "💬" },
  notion: { label: "Notion", icon: "📄" },
  gong: { label: "Gong", icon: "📞" },
  jira: { label: "Jira", icon: "🎯" },
  confluence: { label: "Confluence", icon: "📚" },
  facebook_ads: { label: "Facebook Ads", icon: "📘" },
  linkedin_ads: { label: "LinkedIn Ads", icon: "💼" },
  apollo: { label: "Apollo", icon: "🚀" },
};

const EVAL_META: Record<EvalType, { label: string; icon: string }> = {
  llm_judge: { label: "LLM Judge", icon: "🧠" },
  toxicity: { label: "Toxicity", icon: "⚠️" },
  pii: { label: "PII Detection", icon: "🔒" },
  regex: { label: "Regex", icon: "🔍" },
  proximity: { label: "Proximity to Reference", icon: "📐" },
};

const MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "anthropic/claude-opus-4-5-20251101", label: "Claude Opus 4.5" },
  { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "anthropic/claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { value: "anthropic/claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
  { value: "anthropic/claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "anthropic/claude-3-haiku-20240307", label: "Claude Haiku 3" },
  { value: "gemini/gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { value: "gemini/gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
  { value: "gemini/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "o4-mini", label: "o4 Mini (Reasoning)" },
  { value: "o3-mini", label: "o3 Mini (Reasoning)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const NODE_KINDS: {
  kind: NodeKind;
  label: string;
  description: string;
  // icon: string;
}[] = [
  {
    kind: "trigger",
    label: "Trigger",
    description: "Start the workflow",
    // icon: "⚡",
  },
  {
    kind: "llm",
    label: "LLM",
    description: "Run a language model",
    // icon: "🧠",
  },
  {
    kind: "connector",
    label: "Connector",
    description: "Connect an external app",
    // icon: "🔌",
  },
  {
    kind: "eval",
    label: "Eval",
    description: "Evaluate the output",
    // icon: "🔬",
  },
  {
    kind: "forReview",
    label: "For Review",
    description: "Flag for human review",
    // icon: "👁️",
  },
  {
    kind: "action",
    label: "Action",
    description: "Perform an operation",
    // icon: "⚙️",
  },
  {
    kind: "condition",
    label: "Condition",
    description: "Branch on logic",
    // icon: "◈",
  },
  {
    kind: "complete",
    label: "Complete",
    description: "End / emit a result",
    // icon: "▶",
  },
];

const KIND_STYLES: Record<
  NodeKind,
  { border: string; accent: string; tag: string }
> = {
  trigger: { border: "#f97316", accent: "#fff7ed", tag: "#f97316" },
  llm: { border: "#6366f1", accent: "#eef2ff", tag: "#6366f1" },
  connector: { border: "#3b82f6", accent: "#eff6ff", tag: "#3b82f6" },
  eval: { border: "#a855f7", accent: "#faf5ff", tag: "#a855f7" },
  forReview: { border: "#f43f5e", accent: "#fff1f2", tag: "#f43f5e" },
  complete: { border: "#10b981", accent: "#ecfdf5", tag: "#10b981" },
  action: { border: "#3b82f6", accent: "#eff6ff", tag: "#3b82f6" },
  condition: { border: "#a855f7", accent: "#faf5ff", tag: "#a855f7" },
};

// ─── Custom Node ──────────────────────────────────────────────────────────────

function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const { kind, label, description } = nodeData;
  const styles = KIND_STYLES[kind];
  const meta = NODE_KINDS.find((n) => n.kind === kind);

  return (
    <div
      style={{
        background: "#18181b",
        border: `1.5px solid ${selected ? styles.border : "#3f3f46"}`,
        borderRadius: 10,
        minWidth: 180,
        boxShadow: selected
          ? `0 0 0 2px ${styles.border}33, 0 8px 32px #00000060`
          : "0 4px 16px #00000040",
        transition: "all 0.15s ease",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: styles.border }} />

      {/* Handles */}
      {kind !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: styles.border,
            width: 10,
            height: 10,
            border: "2px solid #18181b",
          }}
        />
      )}
      {kind !== "complete" && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: styles.border,
            width: 10,
            height: 10,
            border: "2px solid #18181b",
          }}
        />
      )}

      <div style={{ padding: "10px 14px 12px" }}>
        {/* Kind badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 6,
          }}
        >
          {/* <span style={{ fontSize: 13 }}>{meta?.icon}</span> */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: styles.border,
            }}
          >
            {kind}
          </span>
        </div>

        {/* Label */}
        <div
          style={{
            color: "#fafafa",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.3,
            marginBottom: description ? 4 : 0,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {kind === "complete" && (
            <Check
              size={13}
              style={{ color: KIND_STYLES.complete.border, flexShrink: 0 }}
              strokeWidth={2.5}
            />
          )}
          {kind === "connector" && nodeData.connectorService === "slack" && (
            <Image
              src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
              alt="Slack"
              width={14}
              height={14}
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
          )}
          {kind === "connector" && nodeData.connectorService === "jira" && (
            <Image
              src="https://img.icons8.com/?size=100&id=oROcPah5ues6&format=png&color=000000"
              alt="Jira"
              width={14}
              height={14}
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
          )}
          {kind === "connector" &&
            nodeData.connectorService === "confluence" && (
              <Image
                src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
                alt="Confluence"
                width={14}
                height={14}
                style={{ borderRadius: 2, flexShrink: 0 }}
              />
            )}
          {kind === "connector" && nodeData.connectorService === "gong" && (
            <Image
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiRxcqf6E93pRSDFSa2o8vuXjzc6IdaafuWA&s"
              alt="Gong"
              width={14}
              height={14}
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
          )}
          {kind === "connector" && nodeData.connectorService === "apollo" && (
            <Image
              src="https://images.prismic.io/sacra/e07037e9-f2ce-4a98-8bc6-825a03e42526_vmuehy3j854rybrsrrwe.webp?auto=compress,format"
              alt="Apollo"
              width={14}
              height={14}
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
          )}
          {label}
        </div>

        {/* Description */}
        {description && (
          <div style={{ color: "#71717a", fontSize: 11, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  workflow: WorkflowNode,
};

// ─── Shared panel field primitives ───────────────────────────────────────────

function PanelField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          color: "#52525b",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const panelInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#09090b",
  border: "1px solid #3f3f46",
  borderRadius: 6,
  color: "#fafafa",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const panelSelectStyle: React.CSSProperties = {
  ...({
    width: "100%",
    padding: "8px 10px",
    background: "#09090b",
    border: "1px solid #3f3f46",
    borderRadius: 6,
    color: "#fafafa",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties),
};

const panelTextareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#09090b",
  border: "1px solid #3f3f46",
  borderRadius: 6,
  color: "#fafafa",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  resize: "vertical",
  minHeight: 80,
  boxSizing: "border-box",
};

// ─── Workflow variable mention types & component ─────────────────────────────

interface WorkflowVariable {
  name: string;
  kind: "input" | "output";
  nodeLabel: string;
}

const WORKFLOW_MENTION_MENU_ID = "workflow-mention-menu";

function workflowMentionSuggestionRender(editorRef: React.MutableRefObject<any>) {
  let root: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let items: WorkflowVariable[] = [];
  let commandFn: ((item: any) => void) | null = null;

  const position = (clientRect?: () => DOMRect | null) => {
    if (!root || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    root.style.left = `${rect.left}px`;
    setTimeout(() => {
      if (!root) return;
      const menuHeight = root.offsetHeight || 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < menuHeight + 8) {
        root.style.top = `${rect.top - menuHeight - 6}px`;
      } else {
        root.style.top = `${rect.bottom + 4}px`;
      }
    }, 0);
  };

  const renderList = () => {
    if (!root) return;
    root.innerHTML = "";

    const box = document.createElement("div");
    box.style.padding = "6px";
    box.style.background = "#18181b";
    box.style.border = "1px solid #3f3f46";
    box.style.borderRadius = "10px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
    box.style.minWidth = "220px";
    box.style.maxHeight = "200px";
    box.style.overflow = "auto";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.style.padding = "10px";
      empty.style.fontSize = "13px";
      empty.style.color = "#71717a";
      empty.textContent = "No variables found";
      box.appendChild(empty);
      root.appendChild(box);
      return;
    }

    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.style.padding = "7px 10px";
      row.style.borderRadius = "7px";
      row.style.cursor = "pointer";
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.gap = "2px";
      row.style.background = i === selectedIndex ? "rgb(37, 99, 235)" : "transparent";

      const nameEl = document.createElement("div");
      nameEl.textContent = `@${item.name}`;
      nameEl.style.fontSize = "13px";
      nameEl.style.fontWeight = "600";
      nameEl.style.fontFamily = "var(--font-geist-mono), monospace";
      nameEl.style.color = i === selectedIndex ? "white" : "#fafafa";

      const metaEl = document.createElement("div");
      metaEl.textContent = `${item.nodeLabel} · ${item.kind === "input" ? "user input" : "node output"}`;
      metaEl.style.fontSize = "11px";
      metaEl.style.color = i === selectedIndex ? "rgba(255,255,255,0.75)" : "#71717a";

      row.appendChild(nameEl);
      row.appendChild(metaEl);

      row.addEventListener("mouseenter", () => {
        selectedIndex = i;
        renderList();
      });

      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (commandFn && item) {
          commandFn({ id: item.name, label: item.name });
          const ed = editorRef.current;
          if (ed?.commands) {
            setTimeout(() => ed.commands.insertContent(" "), 0);
          }
        }
      });

      box.appendChild(row);
    });

    root.appendChild(box);
  };

  return {
    onStart: (props: any) => {
      items = props.items ?? [];
      selectedIndex = 0;
      commandFn = props.command;

      root = document.createElement("div");
      root.id = WORKFLOW_MENTION_MENU_ID;
      root.style.position = "fixed";
      root.style.zIndex = "99999";
      document.body.appendChild(root);

      renderList();
      position(props.clientRect);
    },

    onUpdate: (props: any) => {
      items = props.items ?? [];
      commandFn = props.command;
      renderList();
      position(props.clientRect);
    },

    onKeyDown: (props: any) => {
      const currentItems: WorkflowVariable[] = props.items ?? items;
      if (!currentItems.length) return false;

      if (props.event.key === "ArrowDown") {
        props.event.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        renderList();
        return true;
      }
      if (props.event.key === "ArrowUp") {
        props.event.preventDefault();
        selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
        renderList();
        return true;
      }
      if (props.event.key === "Enter") {
        props.event.preventDefault();
        const item = currentItems[selectedIndex];
        if (item && commandFn) {
          commandFn({ id: item.name, label: item.name });
          const ed = editorRef.current;
          if (ed?.commands) {
            setTimeout(() => ed.commands.insertContent(" "), 0);
          }
          return true;
        }
        return true;
      }
      if (props.event.key === "Escape") {
        props.event.preventDefault();
        return true;
      }
      return false;
    },

    onExit: () => {
      root?.remove();
      root = null;
      commandFn = null;
    },
  };
}

function WorkflowMentionTextarea({
  value,
  onChange,
  variables,
  placeholder,
  style,
  minHeight = 80,
}: {
  value: string;
  onChange: (v: string) => void;
  variables: WorkflowVariable[];
  placeholder?: string;
  style?: React.CSSProperties;
  minHeight?: number;
}) {
  const variablesRef = useRef(variables);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  const editor = useEditor({
    extensions: [
      TiptapDocument,
      TiptapParagraph,
      TiptapText,
      TiptapHardBreak,
      Mention.configure({
        HTMLAttributes: { class: "wf-mention-pill" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          char: "@",
          allowSpaces: false,
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase();
            return variablesRef.current
              .filter((v) => v.name.toLowerCase().includes(q))
              .slice(0, 10);
          },
          render: () => workflowMentionSuggestionRender(editorRef),
        },
      }),
    ],
    content: value ? `<p>${value.replace(/\n/g, "</p><p>")}</p>` : "<p></p>",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getText({ blockSeparator: "\n" }));
    },
    editorProps: {
      attributes: {
        "data-placeholder": placeholder ?? "",
      },
      handleKeyDown: (_view, event) => {
        const menuOpen = !!document.getElementById(WORKFLOW_MENTION_MENU_ID);
        if (menuOpen) return false;
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) editorRef.current = editor;
  }, [editor]);

  // Sync external value changes only when editor is not focused
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const currentText = editor.getText({ blockSeparator: "\n" });
    if (currentText !== value) {
      const html = value
        ? `<p>${value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "</p><p>")}</p>`
        : "<p></p>";
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [value, editor]);

  const containerStyle: React.CSSProperties = {
    width: "100%",
    background: "#09090b",
    border: "1px solid #3f3f46",
    borderRadius: 6,
    color: "#fafafa",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
    minHeight,
    ...style,
  };

  return (
    <div style={containerStyle}>
      <style>{`
        .wf-mention-editor .ProseMirror {
          padding: 8px 10px;
          outline: none;
          min-height: ${minHeight - 2}px;
          white-space: pre-wrap;
          word-break: break-word;
          color: #fafafa;
          font-size: 13px;
          font-family: inherit;
          line-height: 1.5;
        }
        .wf-mention-editor .ProseMirror p {
          margin: 0;
        }
        .wf-mention-editor .ProseMirror p.is-empty:first-child::before {
          content: attr(data-placeholder);
          color: #52525b;
          pointer-events: none;
          float: left;
        }
        .wf-mention-pill {
          display: inline;
          padding: 1px 7px;
          border-radius: 999px;
          background: rgb(37, 99, 235);
          color: white;
          font-weight: 600;
          font-size: 12px;
          font-family: var(--font-geist-mono), monospace;
          white-space: nowrap;
          user-select: none;
        }
      `}</style>
      <div
        className="wf-mention-editor"
        data-placeholder={placeholder}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Per-kind panel bodies ────────────────────────────────────────────────────

function SaveOutputField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (val: string) => void;
}) {
  return (
    <>
      <Separator className="bg-[#27272a] my-2" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#71717a",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Save output as
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#52525b",
                }}
              >
                <Info size={13} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              className="bg-[#18181b] border-[#3f3f46] text-[#a1a1aa] text-xs max-w-[220px] p-3 leading-relaxed"
            >
              {/* Placeholder — content coming soon */}
              Give this a name and other nodes in the workflow can use it.
              Useful for passing data to an LLM or running an eval on it.
            </PopoverContent>
          </Popover>
        </div>
        <input
          style={{
            ...panelInputStyle,
            fontFamily: "var(--font-geist-mono), monospace",
          }}
          placeholder="e.g. slack_output"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </>
  );
}

function RequiresInputVariableField({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Separator className="bg-[#27272a] my-2" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Checkbox
            id="requires-input-variable"
            checked={!!data.requiresInputVariable}
            onCheckedChange={(checked) =>
              onChange({ requiresInputVariable: !!checked })
            }
            className="border-[#3f3f46] data-[state=checked]:bg-[#2D47BC] data-[state=checked]:border-[#2D47BC]"
          />
          <label
            htmlFor="requires-input-variable"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#71717a",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Requires input variable
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#52525b",
                }}
              >
                <Info size={13} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              className="bg-[#18181b] border-[#3f3f46] text-[#a1a1aa] text-xs max-w-[220px] p-3 leading-relaxed"
            >
              Placeholder — content coming soon.
            </PopoverContent>
          </Popover>
        </div>
        {data.requiresInputVariable && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#71717a",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Input variable name
              </div>
              <input
                style={{
                  ...panelInputStyle,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
                placeholder="e.g. my_input"
                value={data.inputVariableName ?? ""}
                onChange={(e) =>
                  onChange({ inputVariableName: e.target.value || undefined })
                }
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#71717a",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Input variable type
              </div>
              <Select
                value={data.inputVariableType ?? "string"}
                onValueChange={(val: "string" | "file") =>
                  onChange({ inputVariableType: val })
                }
              >
                <SelectTrigger className="w-full bg-[#09090b] border-[#3f3f46] text-[#fafafa] hover:bg-[#09090b] focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                  <SelectItem
                    value="string"
                    className="text-[#fafafa] focus:bg-[#27272a]"
                  >
                    String
                  </SelectItem>
                  <SelectItem
                    value="file"
                    className="text-[#fafafa] focus:bg-[#27272a]"
                  >
                    File
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TriggerPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <>
      <PanelField label="HTTP Method">
        <select
          style={panelSelectStyle}
          value={data.triggerMethod ?? "POST"}
          onChange={(e) =>
            onChange({
              triggerMethod: e.target
                .value as WorkflowNodeData["triggerMethod"],
            })
          }
        >
          {(["GET", "POST", "PUT", "DELETE"] as const).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </PanelField>
      <PanelField label="Webhook Path">
        <input
          style={panelInputStyle}
          placeholder="/webhook/my-trigger"
          value={data.webhookPath ?? ""}
          onChange={(e) => onChange({ webhookPath: e.target.value })}
        />
      </PanelField>
      <PanelField label="Description">
        <textarea
          style={panelTextareaStyle}
          placeholder="What triggers this workflow?"
          value={data.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </PanelField>
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

function LLMPanel({
  data,
  onChange,
  onSave,
  availableVariables,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  onSave: (patch: Partial<WorkflowNodeData>) => Promise<boolean>;
  availableVariables: WorkflowVariable[];
}) {
  return (
    <>
      <PanelField label="Model">
        <Select
          value={data.model ?? "gpt-4o"}
          onValueChange={(val) => {
            onChange({ model: val });
            onSave({ model: val });
          }}
        >
          <SelectTrigger className="w-full bg-[#09090b] border-[#3f3f46] text-[#fafafa] hover:bg-[#09090b] focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="focus:bg-[#27272a] focus:text-[#fafafa]"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PanelField>
      <PanelField label="System Prompt">
        <WorkflowMentionTextarea
          value={data.systemPrompt ?? ""}
          onChange={(v) => onChange({ systemPrompt: v })}
          variables={availableVariables}
          placeholder="You are a helpful assistant..."
          minHeight={120}
        />
      </PanelField>
      <PanelField label="User Prompt">
        <WorkflowMentionTextarea
          value={data.userPrompt ?? ""}
          onChange={(v) => onChange({ userPrompt: v })}
          variables={availableVariables}
          placeholder="Type @ to reference a variable…"
          minHeight={80}
        />
      </PanelField>
      <PanelField label={`Temperature — ${data.temperature ?? 0.7}`}>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={data.temperature ?? 0.7}
          onChange={(e) =>
            onChange({ temperature: parseFloat(e.target.value) })
          }
          style={{ width: "100%", accentColor: KIND_STYLES.llm.border }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#52525b",
            marginTop: 4,
          }}
        >
          <span>Precise (0)</span>
          <span>Creative (2)</span>
        </div>
      </PanelField>
      <PanelField label="Description">
        <textarea
          style={panelTextareaStyle}
          placeholder="What does this LLM step do?"
          value={data.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </PanelField>
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

type SlackChannel = { id: string; name: string };

function SlackReadPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  useEffect(() => {
    const fetchChannels = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setIsLoadingChannels(true);
      try {
        const res = await fetch(
          `/api/slack/list_channels?uid=${encodeURIComponent(user.uid)}`,
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.ok && Array.isArray(json.channels)) {
          setChannels(json.channels);
        }
      } catch (error) {
        console.error("Failed to fetch Slack channels:", error);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    fetchChannels();
  }, []);

  return (
    <>
      <PanelField label="Channel">
        {isLoadingChannels ? (
          <Skeleton className="h-9 w-full bg-zinc-800" />
        ) : (
          <Select
            value={data.slackChannelId ?? ""}
            onValueChange={(val) => {
              const ch = channels.find((c) => c.id === val);
              onChange({
                slackChannelId: val,
                slackChannelName: ch?.name ?? "",
              });
            }}
          >
            <SelectTrigger className="w-full bg-[#09090b] border-[#3f3f46] text-[#fafafa] hover:bg-[#09090b] focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
              {channels.length === 0 ? (
                <div className="px-3 py-4 text-sm text-[#71717a] text-center">
                  No channels found
                </div>
              ) : (
                channels.map((ch) => (
                  <SelectItem
                    key={ch.id}
                    value={ch.id}
                    className="focus:bg-[#27272a] focus:text-[#fafafa]"
                  >
                    # {ch.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </PanelField>

      <Separator className="bg-[#27272a] my-2" />

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "#a1a1aa",
          textTransform: "uppercase",
          marginBottom: 10,
          marginTop: 2,
        }}
      >
        Filters
      </div>

      <PanelField label="Time Range">
        <Select
          value={data.slackFilter ?? ""}
          onValueChange={(val) =>
            onChange({
              slackFilter: val as WorkflowNodeData["slackFilter"],
            })
          }
        >
          <SelectTrigger className="w-full bg-[#09090b] border-[#3f3f46] text-[#fafafa] hover:bg-[#09090b] focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Select a filter…" />
          </SelectTrigger>
          <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
            {[
              { value: "today", label: "Today" },
              { value: "last_week", label: "Last week" },
              { value: "last_month", label: "Last month" },
              { value: "message_count", label: "Message count" },
              { value: "custom", label: "Custom" },
            ].map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="focus:bg-[#27272a] focus:text-[#fafafa]"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PanelField>

      {data.slackFilter === "message_count" && (
        <PanelField label="Message Count">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min={1}
              style={{ ...panelInputStyle, flex: 1 }}
              placeholder="How many recent messages do you want to include?"
              value={data.slackMessageCount ?? ""}
              onChange={(e) =>
                onChange({
                  slackMessageCount: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined,
                })
              }
            />
          </div>
        </PanelField>
      )}

      {data.slackFilter === "custom" && (
        <PanelField label="Date Range">
          <CustomDateRangePicker
            value={data.slackCustomRange}
            onChange={(val) => onChange({ slackCustomRange: val })}
          />
        </PanelField>
      )}

      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

function SlackSendPanel() {
  return (
    <Card className="bg-[#09090b] border-[#3f3f46]">
      <CardContent className="pt-6 pb-5 flex flex-col items-center text-center gap-3">
        <Image
          src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
          alt="Slack"
          width={32}
          height={32}
          style={{ borderRadius: 6, opacity: 0.5 }}
        />
        <p className="text-sm text-[#71717a] leading-relaxed">
          Configure your agents to send Slack messages — coming soon.
        </p>
      </CardContent>
    </Card>
  );
}

type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    project: { name: string; key: string };
    status: { name: string };
    assignee?: { displayName: string };
  };
};

function JiraPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<JiraIssue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedKeys = new Set(
    (data.jiraSelectedTickets ?? []).map((t) => t.key),
  );

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    const user = auth.currentUser;
    if (!user) return;

    setIsSearching(true);
    setHasSearched(false);
    try {
      const res = await fetch("/api/jira/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          search_type: "query",
          search_input: searchInput.trim(),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setSearchResults(
        json.status === "success" && Array.isArray(json.data) ? json.data : [],
      );
    } catch (error) {
      console.error("Jira search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const toggleTicket = (issue: JiraIssue) => {
    const current = data.jiraSelectedTickets ?? [];
    const exists = current.some((t) => t.key === issue.key);
    const updated = exists
      ? current.filter((t) => t.key !== issue.key)
      : [
          ...current,
          {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            project: `${issue.fields.project.name} (${issue.fields.project.key})`,
            status: issue.fields.status.name,
            issueType: issue.fields.issuetype.name,
            assignee: issue.fields.assignee?.displayName,
          },
        ];
    onChange({ jiraSelectedTickets: updated });
  };

  return (
    <Tabs defaultValue="read" className="w-full">
      <TabsList className="w-full bg-[#09090b] border border-[#3f3f46] mb-4">
        <TabsTrigger
          value="read"
          className="flex-1 data-[state=active]:bg-[#27272a] data-[state=active]:text-[#fafafa] text-[#71717a]"
        >
          Read
        </TabsTrigger>
        <TabsTrigger
          value="write"
          className="flex-1 data-[state=active]:bg-[#27272a] data-[state=active]:text-[#fafafa] text-[#71717a] gap-2"
        >
          Write
          <Badge className="bg-[#2D47BC22] text-[#2D47BC] border border-[#2D47BC44] text-[9px] font-semibold px-1.5 py-0 leading-4 hover:bg-[#2D47BC22]">
            Soon
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="read">
        {/* Search bar */}
        <PanelField label="Search Jira">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...panelInputStyle, flex: 1 }}
              placeholder="e.g. project = TEST"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSearching) handleSearch();
              }}
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={!searchInput.trim() || isSearching}
              style={{
                padding: "8px 14px",
                background: "#2D47BC",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-geist-sans)",
                cursor:
                  !searchInput.trim() || isSearching
                    ? "not-allowed"
                    : "pointer",
                opacity: !searchInput.trim() || isSearching ? 0.5 : 1,
                whiteSpace: "nowrap",
                transition: "opacity 0.12s ease",
              }}
            >
              {isSearching ? "Searching…" : "Search"}
            </button>
          </div>
        </PanelField>

        {/* Selected tickets summary */}
        {selectedKeys.size > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "#52525b",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Selected ({selectedKeys.size})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(data.jiraSelectedTickets ?? []).map((t) => (
                <div
                  key={t.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    background: "#2D47BC1a",
                    border: "1px solid #2D47BC44",
                    borderRadius: 20,
                    fontSize: 11,
                    color: "#93b4ff",
                  }}
                >
                  {t.key}
                  <button
                    onClick={() =>
                      onChange({
                        jiraSelectedTickets: (
                          data.jiraSelectedTickets ?? []
                        ).filter((x) => x.key !== t.key),
                      })
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#93b4ff",
                      padding: 0,
                      lineHeight: 1,
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {isSearching && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-16 w-full bg-zinc-800 rounded-lg"
              />
            ))}
          </div>
        )}
        {!isSearching && hasSearched && searchResults.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "#52525b",
              textAlign: "center",
              padding: "12px 0",
            }}
          >
            No results found
          </p>
        )}
        {!isSearching && searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "#52525b",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Results ({searchResults.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {searchResults.map((issue) => {
                const isSelected = selectedKeys.has(issue.key);
                return (
                  <div
                    key={issue.id}
                    onClick={() => toggleTicket(issue)}
                    style={{
                      padding: "10px 12px",
                      background: isSelected ? "#2D47BC15" : "#09090b",
                      border: `1px solid ${isSelected ? "#2D47BC66" : "#3f3f46"}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#2D47BC",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {issue.key}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: "#52525b",
                              background: "#27272a",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {issue.fields.issuetype.name}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#d4d4d8",
                            fontWeight: 500,
                            marginBottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {issue.fields.summary}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            fontSize: 10,
                            color: "#52525b",
                          }}
                        >
                          <span>{issue.fields.project.key}</span>
                          <span>{issue.fields.status.name}</span>
                          {issue.fields.assignee && (
                            <span>{issue.fields.assignee.displayName}</span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: `1.5px solid ${isSelected ? "#2D47BC" : "#3f3f46"}`,
                          background: isSelected ? "#2D47BC" : "transparent",
                          flexShrink: 0,
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected && (
                          <Check size={10} style={{ color: "#fff" }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <SaveOutputField
          value={data.outputVariable}
          onChange={(val) => onChange({ outputVariable: val })}
        />
      </TabsContent>

      <TabsContent value="write">
        <Card className="bg-[#09090b] border-[#3f3f46]">
          <CardContent className="pt-6 pb-5 flex flex-col items-center text-center gap-3">
            <Image
              src="https://img.icons8.com/?size=100&id=oROcPah5ues6&format=png&color=000000"
              alt="Jira"
              width={32}
              height={32}
              style={{ borderRadius: 6, opacity: 0.5 }}
            />
            <p className="text-sm text-[#71717a] leading-relaxed">
              Configure your agents to write to Jira — coming soon.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function GongPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Action selector */}
      <PanelField label="Action">
        <Select
          value={data.gongAction ?? ""}
          onValueChange={(val) =>
            onChange({ gongAction: val as WorkflowNodeData["gongAction"] })
          }
        >
          <SelectTrigger className="bg-[#09090b] border-[#3f3f46] text-[#fafafa] focus:ring-[#2D47BC]">
            <SelectValue placeholder="Select an action…" />
          </SelectTrigger>
          <SelectContent className="bg-[#09090b] border-[#3f3f46]">
            <SelectItem
              value="get_call"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Get call
            </SelectItem>
            <SelectItem
              value="get_calls"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Get calls
            </SelectItem>
          </SelectContent>
        </Select>
      </PanelField>

      {/* Get call — call ID input */}
      {data.gongAction === "get_call" && (
        <PanelField label="Call ID">
          <input
            style={panelInputStyle}
            placeholder="Input a call ID"
            value={data.gongCallId ?? ""}
            onChange={(e) => onChange({ gongCallId: e.target.value })}
          />
        </PanelField>
      )}

      {/* Get calls — filter picker */}
      {data.gongAction === "get_calls" && (
        <>
          <Separator className="bg-[#27272a]" />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#52525b",
              textTransform: "uppercase",
            }}
          >
            Filters
          </div>

          <PanelField label="Filter by">
            <Select
              value={data.gongFilter ?? ""}
              onValueChange={(val) =>
                onChange({
                  gongFilter: val as WorkflowNodeData["gongFilter"],
                  // reset previous filter values when switching
                  gongCustomRange: undefined,
                  gongRep: undefined,
                  gongAccount: undefined,
                  gongMinDuration: undefined,
                })
              }
            >
              <SelectTrigger className="bg-[#09090b] border-[#3f3f46] text-[#fafafa] focus:ring-[#2D47BC]">
                <SelectValue placeholder="Choose a filter…" />
              </SelectTrigger>
              <SelectContent className="bg-[#09090b] border-[#3f3f46]">
                <SelectItem
                  value="date_range"
                  className="text-[#fafafa] focus:bg-[#27272a]"
                >
                  Date range
                </SelectItem>
                <SelectItem
                  value="by_rep"
                  className="text-[#fafafa] focus:bg-[#27272a]"
                >
                  By rep
                </SelectItem>
                <SelectItem
                  value="by_account"
                  className="text-[#fafafa] focus:bg-[#27272a]"
                >
                  By account / company name
                </SelectItem>
                <SelectItem
                  value="min_duration"
                  className="text-[#fafafa] focus:bg-[#27272a]"
                >
                  Min call duration
                </SelectItem>
              </SelectContent>
            </Select>
          </PanelField>

          {data.gongFilter === "date_range" && (
            <PanelField label="Date Range">
              <CustomDateRangePicker
                value={data.gongCustomRange}
                onChange={(val) => onChange({ gongCustomRange: val })}
              />
            </PanelField>
          )}

          {data.gongFilter === "by_rep" && (
            <PanelField label="Rep name">
              <input
                style={panelInputStyle}
                placeholder="e.g. Jane Smith"
                value={data.gongRep ?? ""}
                onChange={(e) => onChange({ gongRep: e.target.value })}
              />
            </PanelField>
          )}

          {data.gongFilter === "by_account" && (
            <PanelField label="Account / company name">
              <input
                style={panelInputStyle}
                placeholder="e.g. Acme Corp"
                value={data.gongAccount ?? ""}
                onChange={(e) => onChange({ gongAccount: e.target.value })}
              />
            </PanelField>
          )}

          {data.gongFilter === "min_duration" && (
            <PanelField label="Min call duration (minutes)">
              <input
                style={panelInputStyle}
                placeholder="e.g. 30"
                type="number"
                min={0}
                value={data.gongMinDuration ?? ""}
                onChange={(e) => onChange({ gongMinDuration: e.target.value })}
              />
            </PanelField>
          )}
        </>
      )}
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </div>
  );
}

function ApolloPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PanelField label="Action">
        <Select
          value={data.apolloAction ?? ""}
          onValueChange={(val) =>
            onChange({
              apolloAction: val as WorkflowNodeData["apolloAction"],
              apolloJobTitle: undefined,
              apolloCompanyName: undefined,
              apolloLocation: undefined,
              apolloIndustry: undefined,
              apolloEmployeeRange: undefined,
              apolloPersonEmail: undefined,
              apolloPersonLinkedin: undefined,
              apolloCompanyDomain: undefined,
            })
          }
        >
          <SelectTrigger className="bg-[#09090b] border-[#3f3f46] text-[#fafafa] focus:ring-[#2D47BC]">
            <SelectValue placeholder="Select an action…" />
          </SelectTrigger>
          <SelectContent className="bg-[#09090b] border-[#3f3f46]">
            <SelectItem
              value="search_people"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Search people
            </SelectItem>
            <SelectItem
              value="search_companies"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Search companies
            </SelectItem>
            <SelectItem
              value="enrich_person"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Enrich person
            </SelectItem>
            <SelectItem
              value="enrich_company"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Enrich company
            </SelectItem>
          </SelectContent>
        </Select>
      </PanelField>

      {data.apolloAction === "search_people" && (
        <>
          <Separator className="bg-[#27272a]" />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#52525b",
              textTransform: "uppercase",
            }}
          >
            Filters
          </div>
          <PanelField label="Job title">
            <input
              style={panelInputStyle}
              placeholder="e.g. Account Executive"
              value={data.apolloJobTitle ?? ""}
              onChange={(e) => onChange({ apolloJobTitle: e.target.value })}
            />
          </PanelField>
          <PanelField label="Company name">
            <input
              style={panelInputStyle}
              placeholder="e.g. Acme Corp"
              value={data.apolloCompanyName ?? ""}
              onChange={(e) => onChange({ apolloCompanyName: e.target.value })}
            />
          </PanelField>
          <PanelField label="Location">
            <input
              style={panelInputStyle}
              placeholder="e.g. San Francisco, CA"
              value={data.apolloLocation ?? ""}
              onChange={(e) => onChange({ apolloLocation: e.target.value })}
            />
          </PanelField>
        </>
      )}

      {data.apolloAction === "search_companies" && (
        <>
          <Separator className="bg-[#27272a]" />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#52525b",
              textTransform: "uppercase",
            }}
          >
            Filters
          </div>
          <PanelField label="Industry">
            <input
              style={panelInputStyle}
              placeholder="e.g. SaaS, Healthcare"
              value={data.apolloIndustry ?? ""}
              onChange={(e) => onChange({ apolloIndustry: e.target.value })}
            />
          </PanelField>
          <PanelField label="Employee count range">
            <input
              style={panelInputStyle}
              placeholder="e.g. 50-200"
              value={data.apolloEmployeeRange ?? ""}
              onChange={(e) =>
                onChange({ apolloEmployeeRange: e.target.value })
              }
            />
          </PanelField>
        </>
      )}

      {data.apolloAction === "enrich_person" && (
        <>
          <PanelField label="Email">
            <input
              style={panelInputStyle}
              placeholder="e.g. jane@acme.com"
              value={data.apolloPersonEmail ?? ""}
              onChange={(e) => onChange({ apolloPersonEmail: e.target.value })}
            />
          </PanelField>
          <PanelField label="LinkedIn URL">
            <input
              style={panelInputStyle}
              placeholder="e.g. https://linkedin.com/in/jane"
              value={data.apolloPersonLinkedin ?? ""}
              onChange={(e) =>
                onChange({ apolloPersonLinkedin: e.target.value })
              }
            />
          </PanelField>
        </>
      )}

      {data.apolloAction === "enrich_company" && (
        <PanelField label="Company domain">
          <input
            style={panelInputStyle}
            placeholder="e.g. acme.com"
            value={data.apolloCompanyDomain ?? ""}
            onChange={(e) => onChange({ apolloCompanyDomain: e.target.value })}
          />
        </PanelField>
      )}

      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </div>
  );
}

type ConfluencePage = { id: string; title: string; spaceKey?: string };
type ConfluenceSpace = { id: string; name: string; pages: ConfluencePage[] };

function ConfluencePanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const [searchTab, setSearchTab] = useState<"query" | "cql" | "spaces">(
    "query",
  );
  const [queryInput, setQueryInput] = useState("");
  const [cqlInput, setCqlInput] = useState("");
  const [searchResults, setSearchResults] = useState<ConfluencePage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [openSpaceId, setOpenSpaceId] = useState<string | null>(null);
  const [loadingPagesBySpace, setLoadingPagesBySpace] = useState<
    Record<string, boolean>
  >({});

  const selectedIds = new Set(
    (data.confluenceSelectedPages ?? []).map((p) => p.id),
  );

  const togglePage = (page: ConfluencePage) => {
    const current = data.confluenceSelectedPages ?? [];
    const updated = selectedIds.has(page.id)
      ? current.filter((p) => p.id !== page.id)
      : [...current, page];
    onChange({ confluenceSelectedPages: updated });
  };

  const handleSearch = async () => {
    const raw = searchTab === "query" ? queryInput.trim() : cqlInput.trim();
    if (!raw) return;
    const user = auth.currentUser;
    if (!user) return;

    const query =
      searchTab === "query" ? `text ~ "${raw.replace(/"/g, '\\"')}"` : raw;
    setIsSearching(true);
    setHasSearched(false);
    try {
      const res = await fetch(
        `/api/confluence/search?user_id=${user.uid}&query=${encodeURIComponent(query)}&limit=10`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.status === "success" && json.results) {
        setSearchResults(
          json.results.map((r: any) => ({
            id: r.content?.id || r.id,
            title: r.title || r.content?.title,
            spaceKey: r.resultGlobalContainer?.title,
          })),
        );
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Confluence search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  // Load spaces when Spaces tab opens
  useEffect(() => {
    if (searchTab !== "spaces" || spaces.length > 0) return;
    const fetchSpaces = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setIsLoadingSpaces(true);
      try {
        const res = await fetch(`/api/confluence/spaces?user_id=${user.uid}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.spaces)) {
          setSpaces(
            json.spaces.map((s: any) => ({
              id: s.id || s.key,
              name: s.name,
              pages: [],
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load Confluence spaces:", err);
      } finally {
        setIsLoadingSpaces(false);
      }
    };
    fetchSpaces();
  }, [searchTab, spaces.length]);

  // Load pages when a space is expanded
  useEffect(() => {
    if (!openSpaceId) return;
    const space = spaces.find((s) => s.id === openSpaceId);
    if (!space || space.pages.length > 0) return;
    const fetchPages = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setLoadingPagesBySpace((prev) => ({ ...prev, [openSpaceId]: true }));
      try {
        const res = await fetch(
          `/api/confluence/pages?user_id=${user.uid}&space_id=${openSpaceId}`,
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.pages)) {
          setSpaces((prev) =>
            prev.map((s) =>
              s.id === openSpaceId
                ? {
                    ...s,
                    pages: json.pages.map((p: any) => ({
                      id: p.id,
                      title: p.title,
                      spaceKey: p.spaceKey,
                    })),
                  }
                : s,
            ),
          );
        }
      } catch (err) {
        console.error("Failed to load Confluence pages:", err);
      } finally {
        setLoadingPagesBySpace((prev) => ({ ...prev, [openSpaceId]: false }));
      }
    };
    fetchPages();
  }, [openSpaceId, spaces]);

  const pageCard = (page: ConfluencePage) => {
    const isSelected = selectedIds.has(page.id);
    return (
      <div
        key={page.id}
        onClick={() => togglePage(page)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          background: isSelected ? "#2D47BC15" : "#09090b",
          border: `1px solid ${isSelected ? "#2D47BC66" : "#3f3f46"}`,
          borderRadius: 6,
          cursor: "pointer",
          transition: "all 0.12s ease",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "#d4d4d8",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {page.title}
        </span>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: `1.5px solid ${isSelected ? "#2D47BC" : "#3f3f46"}`,
            background: isSelected ? "#2D47BC" : "transparent",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSelected && <Check size={9} style={{ color: "#fff" }} />}
        </div>
      </div>
    );
  };

  const searchBar = (
    placeholder: string,
    value: string,
    setValue: (v: string) => void,
  ) => (
    <PanelField label="Search">
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...panelInputStyle, flex: 1 }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSearching) handleSearch();
          }}
          disabled={isSearching}
        />
        <button
          onClick={handleSearch}
          disabled={!value.trim() || isSearching}
          style={{
            padding: "8px 14px",
            background: "#2D47BC",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--font-geist-sans)",
            cursor: !value.trim() || isSearching ? "not-allowed" : "pointer",
            opacity: !value.trim() || isSearching ? 0.5 : 1,
            whiteSpace: "nowrap",
            transition: "opacity 0.12s ease",
          }}
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </div>
    </PanelField>
  );

  return (
    <Tabs defaultValue="read" className="w-full">
      <TabsList className="w-full bg-[#09090b] border border-[#3f3f46] mb-4">
        <TabsTrigger
          value="read"
          className="flex-1 data-[state=active]:bg-[#27272a] data-[state=active]:text-[#fafafa] text-[#71717a]"
        >
          Read
        </TabsTrigger>
        <TabsTrigger
          value="write"
          className="flex-1 data-[state=active]:bg-[#27272a] data-[state=active]:text-[#fafafa] text-[#71717a] gap-2"
        >
          Write
          <Badge className="bg-[#2D47BC22] text-[#2D47BC] border border-[#2D47BC44] text-[9px] font-semibold px-1.5 py-0 leading-4 hover:bg-[#2D47BC22]">
            Soon
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="read">
        {/* Selected pages chips */}
        {selectedIds.size > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "#52525b",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Selected ({selectedIds.size})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(data.confluenceSelectedPages ?? []).map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    background: "#2D47BC1a",
                    border: "1px solid #2D47BC44",
                    borderRadius: 20,
                    fontSize: 11,
                    color: "#93b4ff",
                  }}
                >
                  {p.title}
                  <button
                    onClick={() =>
                      onChange({
                        confluenceSelectedPages: (
                          data.confluenceSelectedPages ?? []
                        ).filter((x) => x.id !== p.id),
                      })
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#93b4ff",
                      padding: 0,
                      lineHeight: 1,
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inner search mode tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 12,
            borderBottom: "1px solid #27272a",
          }}
        >
          {(["query", "cql", "spaces"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSearchTab(tab);
                setHasSearched(false);
                setSearchResults([]);
              }}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${searchTab === tab ? "#2D47BC" : "transparent"}`,
                color: searchTab === tab ? "#2D47BC" : "#71717a",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-geist-sans)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.12s ease",
              }}
            >
              {tab === "query" ? "Query" : tab === "cql" ? "CQL" : "Spaces"}
            </button>
          ))}
        </div>

        {searchTab === "query" &&
          searchBar("e.g. meeting notes", queryInput, setQueryInput)}
        {searchTab === "cql" &&
          searchBar("e.g. space = ENG AND type = page", cqlInput, setCqlInput)}

        {/* Search results */}
        {(searchTab === "query" || searchTab === "cql") && (
          <>
            {isSearching && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-10 w-full bg-zinc-800 rounded-md"
                  />
                ))}
              </div>
            )}
            {!isSearching && hasSearched && searchResults.length === 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "#52525b",
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                No results found
              </p>
            )}
            {!isSearching && searchResults.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {searchResults.map((page) => pageCard(page))}
              </div>
            )}
          </>
        )}

        {/* Spaces browser */}
        {searchTab === "spaces" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {isLoadingSpaces &&
              [1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  className="h-9 w-full bg-zinc-800 rounded-md"
                />
              ))}
            {!isLoadingSpaces && spaces.length === 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "#52525b",
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                No spaces found
              </p>
            )}
            {spaces.map((space) => (
              <div key={space.id}>
                <button
                  onClick={() =>
                    setOpenSpaceId(openSpaceId === space.id ? null : space.id)
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: "#09090b",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    color: "#d4d4d8",
                    fontSize: 12,
                    fontFamily: "var(--font-geist-sans)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {space.name}
                  <span style={{ color: "#52525b", fontSize: 10 }}>
                    {openSpaceId === space.id ? "▲" : "▼"}
                  </span>
                </button>
                {openSpaceId === space.id && (
                  <div
                    style={{
                      marginTop: 4,
                      marginLeft: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {loadingPagesBySpace[space.id] && (
                      <Skeleton className="h-8 w-full bg-zinc-800 rounded-md" />
                    )}
                    {!loadingPagesBySpace[space.id] &&
                      space.pages.length === 0 && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#52525b",
                            padding: "6px 0",
                          }}
                        >
                          No pages found
                        </p>
                      )}
                    {space.pages.map((page) => pageCard(page))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <SaveOutputField
          value={data.outputVariable}
          onChange={(val) => onChange({ outputVariable: val })}
        />
      </TabsContent>

      <TabsContent value="write">
        <Card className="bg-[#09090b] border-[#3f3f46]">
          <CardContent className="pt-6 pb-5 flex flex-col items-center text-center gap-3">
            <Image
              src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
              alt="Confluence"
              width={32}
              height={32}
              style={{ borderRadius: 6, opacity: 0.5 }}
            />
            <p className="text-sm text-[#71717a] leading-relaxed">
              Configure your agents to write to Confluence — coming soon.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function ConnectorPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const meta = data.connectorService
    ? CONNECTOR_META[data.connectorService]
    : null;

  const isSlack = data.connectorService === "slack";
  const isJira = data.connectorService === "jira";
  const isConfluence = data.connectorService === "confluence";
  const isGong = data.connectorService === "gong";
  const isApollo = data.connectorService === "apollo";

  return (
    <>
      {/* Service badge — only for generic/unknown connectors */}
      {!isSlack && !isJira && !isConfluence && !isGong && !isApollo && (
        <PanelField label="Service">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "#09090b",
              border: "1px solid #3f3f46",
              borderRadius: 6,
              color: "#a1a1aa",
              fontSize: 13,
            }}
          >
            {meta ? (
              <>
                <span>{meta.icon}</span>
                <span style={{ color: "#fafafa" }}>{meta.label}</span>
              </>
            ) : (
              "No service selected"
            )}
          </div>
        </PanelField>
      )}

      {/* Slack: tabbed UI */}
      {isSlack ? (
        <Tabs defaultValue="read" className="w-full">
          <TabsList className="w-full bg-[#09090b] border border-[#3f3f46] mb-4">
            <TabsTrigger
              value="read"
              className="flex-1 data-[state=active]:bg-[#27272a] data-[state=active]:text-[#fafafa] text-[#71717a]"
            >
              Read messages
            </TabsTrigger>
            <TabsTrigger
              value="send"
              className="flex-1 data-[state=active]:bg-[#27272a] data-[state=active]:text-[#fafafa] text-[#71717a] gap-2"
            >
              Send messages
              <Badge className="bg-[#2D47BC22] text-[#2D47BC] border border-[#2D47BC44] text-[9px] font-semibold px-1.5 py-0 leading-4 hover:bg-[#2D47BC22]">
                Soon
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="read">
            <SlackReadPanel data={data} onChange={onChange} />
          </TabsContent>
          <TabsContent value="send">
            <SlackSendPanel />
          </TabsContent>
        </Tabs>
      ) : isJira ? (
        <JiraPanel data={data} onChange={onChange} />
      ) : isConfluence ? (
        <ConfluencePanel data={data} onChange={onChange} />
      ) : isGong ? (
        <GongPanel data={data} onChange={onChange} />
      ) : isApollo ? (
        <ApolloPanel data={data} onChange={onChange} />
      ) : (
        /* Generic connector fallback */
        <>
          <PanelField label="Action">
            <input
              style={panelInputStyle}
              placeholder="e.g. post_message, create_page…"
              value={data.connectorAction ?? ""}
              onChange={(e) => onChange({ connectorAction: e.target.value })}
            />
          </PanelField>
          <PanelField label="Description">
            <textarea
              style={panelTextareaStyle}
              placeholder="What does this connector do?"
              value={data.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </PanelField>
          <SaveOutputField
            value={data.outputVariable}
            onChange={(val) => onChange({ outputVariable: val })}
          />
        </>
      )}
    </>
  );
}

type TeamDocument = {
  id: string;
  nickname?: string;
  name?: string;
  filePath?: string;
};

function ProximityPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const [teamDocs, setTeamDocs] = useState<TeamDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch team documents
  useEffect(() => {
    if (data.evalProximityReferenceType !== "file") return;
    const fetchDocs = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setIsLoadingDocs(true);
      try {
        const res = await fetch("/api/get-team-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.uid }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        const teamId = json.team_id;
        if (!teamId) {
          setTeamDocs([]);
          return;
        }
        const snap = await getDocs(collection(db, "teams", teamId, "sources"));
        const docs: TeamDocument[] = [];
        snap.forEach((d) => {
          const doc = d.data();
          if (doc.type === "document") {
            docs.push({
              id: d.id,
              nickname: doc.nickname,
              name: doc.name,
              filePath: doc.filePath,
            });
          }
        });
        setTeamDocs(docs);
      } catch (err) {
        console.error("Failed to load team documents:", err);
        setTeamDocs([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [data.evalProximityReferenceType]);

  const handleFile = (file: File) => {
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const user = auth.currentUser;
    if (!user) return;
    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const storagePath = `users/${user.uid}/eval_references/${fileName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, selectedFile);
      onChange({
        evalProximityFilePath: storagePath,
        evalProximityFileName: selectedFile.name,
      });
      setSelectedFile(null);
      toast.success("Reference file uploaded");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Reference type */}
      <PanelField label="Reference type">
        <Select
          value={data.evalProximityReferenceType ?? ""}
          onValueChange={(val) =>
            onChange({
              evalProximityReferenceType: val as "file" | "website",
              evalProximityFileId: undefined,
              evalProximityFilePath: undefined,
              evalProximityFileName: undefined,
              evalProximityWebsite: undefined,
            })
          }
        >
          <SelectTrigger className="bg-[#09090b] border-[#3f3f46] text-[#fafafa] focus:ring-[#2D47BC]">
            <SelectValue placeholder="Choose reference type…" />
          </SelectTrigger>
          <SelectContent className="bg-[#09090b] border-[#3f3f46]">
            <SelectItem
              value="file"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              File
            </SelectItem>
            <SelectItem
              value="website"
              className="text-[#fafafa] focus:bg-[#27272a]"
            >
              Website
            </SelectItem>
          </SelectContent>
        </Select>
      </PanelField>

      {/* File mode */}
      {data.evalProximityReferenceType === "file" && (
        <>
          {/* Existing team docs dropdown */}
          <PanelField label="Select from team documents">
            {isLoadingDocs ? (
              <Skeleton className="h-9 w-full bg-zinc-800 rounded-md" />
            ) : (
              <Select
                value={data.evalProximityFileId ?? ""}
                onValueChange={(val) => {
                  const doc = teamDocs.find((d) => d.id === val);
                  onChange({
                    evalProximityFileId: val,
                    evalProximityFileName: doc?.nickname ?? doc?.name,
                  });
                }}
              >
                <SelectTrigger className="bg-[#09090b] border-[#3f3f46] text-[#fafafa] focus:ring-[#2D47BC]">
                  <SelectValue
                    placeholder={
                      teamDocs.length === 0
                        ? "No files in your team"
                        : "Choose a document…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-[#09090b] border-[#3f3f46]">
                  {teamDocs.length === 0 ? (
                    <SelectItem
                      value="__none__"
                      disabled
                      className="text-[#52525b]"
                    >
                      No files in your team
                    </SelectItem>
                  ) : (
                    teamDocs.map((doc) => (
                      <SelectItem
                        key={doc.id}
                        value={doc.id}
                        className="text-[#fafafa] focus:bg-[#27272a]"
                      >
                        {doc.nickname ?? doc.name ?? doc.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </PanelField>

          {/* Separator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: "#27272a" }} />
            <span
              style={{
                fontSize: 10,
                color: "#52525b",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              or upload new
            </span>
            <div style={{ flex: 1, height: 1, background: "#27272a" }} />
          </div>

          {/* Drag and drop */}
          {data.evalProximityFilePath && !selectedFile ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "14px 12px",
                background: "#09090b",
                border: "1px solid #2D47BC44",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <FileText size={24} style={{ color: "#2D47BC" }} />
              <p style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 500 }}>
                {data.evalProximityFileName ?? "Uploaded file"}
              </p>
              <button
                onClick={() =>
                  onChange({
                    evalProximityFilePath: undefined,
                    evalProximityFileName: undefined,
                  })
                }
                style={{
                  fontSize: 11,
                  color: "#71717a",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Remove
              </button>
            </div>
          ) : selectedFile ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "14px 12px",
                background: "#09090b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <FileText size={24} style={{ color: "#2D47BC" }} />
              <p style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 500 }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: 11, color: "#52525b" }}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  style={{
                    padding: "6px 14px",
                    background: "#2D47BC",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "var(--font-geist-sans)",
                    cursor: isUploading ? "not-allowed" : "pointer",
                    opacity: isUploading ? 0.6 : 1,
                  }}
                >
                  {isUploading ? "Uploading…" : "Upload"}
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  style={{
                    padding: "6px 14px",
                    background: "none",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    color: "#71717a",
                    fontSize: 12,
                    fontFamily: "var(--font-geist-sans)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? "#2D47BC" : "#3f3f46"}`,
                borderRadius: 8,
                padding: "24px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                background: isDragging ? "#2D47BC08" : "transparent",
                transition: "all 0.12s ease",
              }}
            >
              <Upload size={24} style={{ color: "#52525b" }} />
              <p
                style={{ fontSize: 12, color: "#71717a", textAlign: "center" }}
              >
                Drag and drop your file here, or
              </p>
              <span
                style={{
                  fontSize: 12,
                  color: "#2D47BC",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Choose file
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Website mode */}
      {data.evalProximityReferenceType === "website" && (
        <PanelField label="Website URL">
          <input
            style={panelInputStyle}
            placeholder="https://example.com/reference"
            value={data.evalProximityWebsite ?? ""}
            onChange={(e) => onChange({ evalProximityWebsite: e.target.value })}
          />
        </PanelField>
      )}
    </div>
  );
}

function EvalPanel({
  data,
  onChange,
  onSave,
  allNodes,
  currentNodeId,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  onSave: (patch: Partial<WorkflowNodeData>) => Promise<boolean>;
  allNodes: Node<WorkflowNodeData>[];
  currentNodeId: string;
}) {
  const inputVar = data.evalInputVariable ?? "";
  // Check if any other node in the workflow has this outputVariable set
  const isVariableValid: boolean =
    inputVar.trim().length > 0 &&
    allNodes.some(
      (n) =>
        n.id !== currentNodeId && n.data.outputVariable === inputVar.trim(),
    );

  const otherNodes = allNodes.filter((n) => n.id !== currentNodeId);

  const availableVariables: WorkflowVariable[] = otherNodes.flatMap((n) => {
    const vars: WorkflowVariable[] = [];
    if (n.data.outputVariable)
      vars.push({ name: n.data.outputVariable, kind: "output", nodeLabel: n.data.label });
    if (n.data.requiresInputVariable && n.data.inputVariableName)
      vars.push({ name: n.data.inputVariableName, kind: "input", nodeLabel: n.data.label });
    return vars;
  });

  const nodeSelectClass =
    "bg-[#09090b] border-[#3f3f46] text-[#fafafa] focus:ring-[#2D47BC]";

  return (
    <>
      {/* Eval Type */}
      <PanelField label="Eval Type">
        <Select
          value={data.evalType ?? ""}
          onValueChange={(val) => onChange({ evalType: val as EvalType })}
        >
          <SelectTrigger className={nodeSelectClass}>
            <SelectValue placeholder="Select eval type…" />
          </SelectTrigger>
          <SelectContent className="bg-[#09090b] border-[#3f3f46]">
            {(Object.keys(EVAL_META) as EvalType[]).map((t) => (
              <SelectItem
                key={t}
                value={t}
                className="text-[#fafafa] focus:bg-[#27272a]"
              >
                {EVAL_META[t].icon} {EVAL_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PanelField>

      {/* Type-specific criteria */}
      {data.evalType === "llm_judge" && (
        <>
          <PanelField label="Judge Model">
            <Select
              value={data.evalModel ?? "gpt-4o"}
              onValueChange={(val) => {
                onChange({ evalModel: val });
                onSave({ evalModel: val });
              }}
            >
              <SelectTrigger className="w-full bg-[#09090b] border-[#3f3f46] text-[#fafafa] hover:bg-[#09090b] focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="focus:bg-[#27272a] focus:text-[#fafafa]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PanelField>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#71717a",
                }}
              >
                Passing Criteria
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", color: "#52525b" }}
                  >
                    <Info size={12} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="bg-[#18181b] border-[#27272a] text-[#a1a1aa] text-xs max-w-[220px]"
                  side="right"
                >
                  These are the criteria the judge will use to determine a pass or not. Any inputs that don&apos;t meet this criteria will be marked &apos;fail&apos;.
                </PopoverContent>
              </Popover>
            </div>
            <WorkflowMentionTextarea
              value={data.evalCriteria ?? ""}
              onChange={(v) => onChange({ evalCriteria: v })}
              variables={availableVariables}
              placeholder="e.g. The response is concise, factually correct, and does not contain offensive language."
              minHeight={100}
            />
          </div>
        </>
      )}
      {data.evalType === "regex" && (
        <PanelField label="Regex Pattern">
          <input
            style={panelInputStyle}
            placeholder="^[a-zA-Z0-9]+$"
            value={data.evalCriteria ?? ""}
            onChange={(e) => onChange({ evalCriteria: e.target.value })}
          />
        </PanelField>
      )}
      {data.evalType === "proximity" && (
        <ProximityPanel data={data} onChange={onChange} />
      )}

      {/* Variable to evaluate */}
      {/* <PanelField label="Variable to evaluate">
        <input
          style={{
            ...panelInputStyle,
            fontFamily: "var(--font-geist-mono), monospace",
            color:
              inputVar.trim() === ""
                ? "#71717a"
                : isVariableValid
                  ? "#2D47BC"
                  : "#ef4444",
            borderColor:
              inputVar.trim() === ""
                ? "#3f3f46"
                : isVariableValid
                  ? "#2D47BC55"
                  : "#ef444455",
            transition: "color 0.15s ease, border-color 0.15s ease",
          }}
          placeholder="e.g. slack_output"
          value={inputVar}
          onChange={(e) => onChange({ evalInputVariable: e.target.value })}
        />
      </PanelField> */}

      {/* Pass / Fail routing */}
      <Separator className="bg-[#27272a] my-2" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(
          [
            { key: "evalPassNodeId", label: "On eval pass", color: "#4ade80" },
            { key: "evalFailNodeId", label: "On eval fail", color: "#f87171" },
          ] as const
        ).map(({ key, label, color }) => (
          <div
            key={key}
            style={{ display: "flex", flexDirection: "column", gap: 5 }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color,
              }}
            >
              {label}
            </span>
            <Select
              value={data[key] ?? ""}
              onValueChange={(val) => onChange({ [key]: val })}
            >
              <SelectTrigger className={nodeSelectClass}>
                <SelectValue placeholder="Select a node…" />
              </SelectTrigger>
              <SelectContent className="bg-[#09090b] border-[#3f3f46]">
                {otherNodes.length === 0 ? (
                  <SelectItem
                    value="__none__"
                    disabled
                    className="text-[#52525b]"
                  >
                    No other nodes
                  </SelectItem>
                ) : (
                  otherNodes.map((n) => (
                    <SelectItem
                      key={n.id}
                      value={n.id}
                      className="text-[#fafafa] focus:bg-[#27272a]"
                    >
                      {n.data.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </>
  );
}

function ForReviewPanel({
  data,
  onChange,
  availableVariables,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  availableVariables: WorkflowVariable[];
}) {
  return (
    <>
      <PanelField label="Review Instructions">
        <WorkflowMentionTextarea
          value={data.description ?? ""}
          onChange={(v) => onChange({ description: v })}
          variables={availableVariables}
          placeholder="What should the reviewer check for?"
          minHeight={100}
        />
      </PanelField>
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

function ActionPanel({
  data,
  onChange,
  availableVariables,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  availableVariables: WorkflowVariable[];
}) {
  return (
    <>
      <PanelField label="Action Type">
        <input
          style={panelInputStyle}
          placeholder="e.g. transform, filter, enrich…"
          value={data.actionType ?? ""}
          onChange={(e) => onChange({ actionType: e.target.value })}
        />
      </PanelField>
      <PanelField label="Parameters (JSON)">
        <WorkflowMentionTextarea
          value={data.actionParams ?? ""}
          onChange={(v) => onChange({ actionParams: v })}
          variables={availableVariables}
          placeholder={'{\n  "key": "value"\n}'}
          minHeight={100}
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        />
      </PanelField>
      <PanelField label="Description">
        <textarea
          style={panelTextareaStyle}
          placeholder="What does this action do?"
          value={data.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </PanelField>
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

function ConditionPanel({
  data,
  onChange,
  availableVariables,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  availableVariables: WorkflowVariable[];
}) {
  return (
    <>
      <PanelField label="Condition Expression">
        <WorkflowMentionTextarea
          value={data.conditionExpression ?? ""}
          onChange={(v) => onChange({ conditionExpression: v })}
          variables={availableVariables}
          placeholder="e.g. @output_var > 0.8"
          minHeight={80}
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        />
      </PanelField>
      <PanelField label="Description">
        <textarea
          style={panelTextareaStyle}
          placeholder="Describe the branching logic…"
          value={data.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </PanelField>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 4,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "#14532d22",
            border: "1px solid #16a34a44",
            borderRadius: 6,
            fontSize: 12,
            color: "#4ade80",
          }}
        >
          ✓ True → next node
        </div>
        <div
          style={{
            padding: "8px 12px",
            background: "#7f1d1d22",
            border: "1px solid #dc262644",
            borderRadius: 6,
            fontSize: 12,
            color: "#f87171",
          }}
        >
          ✗ False → next node
        </div>
      </div>
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

function OutputPanel({
  data,
  onChange,
}: {
  data: WorkflowNodeData;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <>
      <PanelField label="Output Format">
        <select
          style={panelSelectStyle}
          value={data.outputFormat ?? "json"}
          onChange={(e) =>
            onChange({
              outputFormat: e.target.value as WorkflowNodeData["outputFormat"],
            })
          }
        >
          {(["json", "text", "markdown"] as const).map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </select>
      </PanelField>
      <PanelField label="Destination">
        <input
          style={panelInputStyle}
          placeholder="e.g. response body, Slack channel, S3 key…"
          value={data.outputDestination ?? ""}
          onChange={(e) => onChange({ outputDestination: e.target.value })}
        />
      </PanelField>
      <PanelField label="Description">
        <textarea
          style={panelTextareaStyle}
          placeholder="What is emitted here?"
          value={data.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </PanelField>
      <SaveOutputField
        value={data.outputVariable}
        onChange={(val) => onChange({ outputVariable: val })}
      />
    </>
  );
}

// ─── Node Inspector Skeleton ──────────────────────────────────────────────────

function NodeInspectorSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ height: 3, background: accentColor, flexShrink: 0 }} />
      <div style={{ padding: "20px", flex: 1 }}>
        <Skeleton className="h-6 w-24 rounded-full mb-5 bg-zinc-800" />
        <div
          style={{
            fontSize: 10,
            color: "#52525b",
            marginBottom: 6,
            letterSpacing: "0.1em",
          }}
        >
          NODE LABEL
        </div>
        <Skeleton className="h-9 w-full mb-5 bg-zinc-800" />
        <div style={{ height: 1, background: "#27272a", margin: "0 0 20px" }} />
        <div
          style={{
            fontSize: 10,
            color: "#52525b",
            marginBottom: 6,
            letterSpacing: "0.1em",
          }}
        >
          MODEL
        </div>
        <Skeleton className="h-9 w-full mb-5 bg-zinc-800" />
        <div
          style={{
            fontSize: 10,
            color: "#52525b",
            marginBottom: 6,
            letterSpacing: "0.1em",
          }}
        >
          SYSTEM PROMPT
        </div>
        <Skeleton className="h-28 w-full mb-5 bg-zinc-800" />
        <div
          style={{
            fontSize: 10,
            color: "#52525b",
            marginBottom: 6,
            letterSpacing: "0.1em",
          }}
        >
          USER PROMPT
        </div>
        <Skeleton className="h-20 w-full bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Node Inspector Panel ─────────────────────────────────────────────────────

function NodeInspectorPanel({
  node,
  onChange,
  onSave,
  onDelete,
  allNodes,
}: {
  node: Node<WorkflowNodeData>;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  onSave: (patch: Partial<WorkflowNodeData>) => Promise<boolean>;
  onDelete: () => void;
  allNodes: Node<WorkflowNodeData>[];
}) {
  const { kind } = node.data;
  const styles = KIND_STYLES[kind];
  const meta = NODE_KINDS.find((n) => n.kind === kind);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const availableVariables: WorkflowVariable[] = allNodes
    .flatMap((n) => {
      const vars: WorkflowVariable[] = [];
      // Only include other nodes' outputs — you can't reference your own output in your own prompt
      if (n.id !== node.id && n.data.outputVariable)
        vars.push({ name: n.data.outputVariable, kind: "output", nodeLabel: n.data.label });
      // Include all nodes' input variables, including the current node's own input variable
      if (n.data.requiresInputVariable && n.data.inputVariableName)
        vars.push({ name: n.data.inputVariableName, kind: "input", nodeLabel: n.data.label });
      return vars;
    });

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const ok = await onSave({});
    setIsSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: styles.border, flexShrink: 0 }} />

      <div style={{ padding: "20px 20px 0", overflowY: "auto", flex: 1 }}>
        {/* Kind badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            background: `${styles.border}1a`,
            border: `1px solid ${styles.border}44`,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 12 }}>{meta?.label}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: styles.border,
            }}
          >
            {kind}
          </span>
        </div>

        {/* Label */}
        <PanelField label="Node Label">
          <input
            style={panelInputStyle}
            value={node.data.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </PanelField>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "#27272a",
            margin: "4px 0 20px",
          }}
        />

        {/* Requires input variable (all except trigger, eval, forReview) */}
        {kind !== "trigger" && kind !== "eval" && kind !== "forReview" && (
          <RequiresInputVariableField data={node.data} onChange={onChange} />
        )}

        {/* Kind-specific fields */}
        {kind === "trigger" && (
          <TriggerPanel data={node.data} onChange={onChange} />
        )}
        {kind === "llm" && (
          <LLMPanel data={node.data} onChange={onChange} onSave={onSave} availableVariables={availableVariables} />
        )}
        {kind === "connector" && (
          <ConnectorPanel data={node.data} onChange={onChange} />
        )}
        {kind === "eval" && (
          <EvalPanel
            data={node.data}
            onChange={onChange}
            onSave={onSave}
            allNodes={allNodes}
            currentNodeId={node.id}
          />
        )}
        {kind === "forReview" && (
          <ForReviewPanel data={node.data} onChange={onChange} availableVariables={availableVariables} />
        )}
        {kind === "action" && (
          <ActionPanel data={node.data} onChange={onChange} availableVariables={availableVariables} />
        )}
        {kind === "condition" && (
          <ConditionPanel data={node.data} onChange={onChange} availableVariables={availableVariables} />
        )}
        {kind === "complete" && (
          <OutputPanel data={node.data} onChange={onChange} />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid #27272a",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            width: "100%",
            padding: "9px",
            background: saveSuccess ? "#16a34a" : "#2D47BC",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-geist-sans)",
            cursor: isSaving ? "not-allowed" : "pointer",
            letterSpacing: "0.04em",
            transition: "background 0.2s ease, opacity 0.12s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: isSaving ? 0.8 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isSaving) e.currentTarget.style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = isSaving ? "0.8" : "1";
          }}
        >
          {isSaving && (
            <Loader2
              size={14}
              style={{ animation: "spin 0.7s linear infinite" }}
            />
          )}
          {saveSuccess && <Check size={14} />}
          {isSaving ? "Saving…" : saveSuccess ? "Saved" : "Save"}
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              style={{
                width: "100%",
                padding: "8px",
                background: "transparent",
                border: "1px solid #ef4444",
                borderRadius: 6,
                color: "#ef4444",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-geist-sans)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#ef444415")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Trash2 size={14} />
              Delete node
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete node</AlertDialogTitle>
              <AlertDialogDescription className="text-[#71717a]">
                Are you sure you want to delete &ldquo;{node.data.label}&rdquo;?
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-[#3f3f46] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialNodes: Node<WorkflowNodeData>[] = [
  {
    id: "n1",
    type: "workflow",
    position: { x: 80, y: 180 },
    data: {
      label: "HTTP Request",
      kind: "trigger",
      description: "Receives incoming webhook",
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "n1", target: "n2", style: { stroke: "#3f3f46" } },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function RunWorkflow({
  agentId,
  displayName,
}: {
  agentId: string | null;
  displayName?: string;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedKind, setSelectedKind] = useState<NodeKind>("action");
  const [nodeName, setNodeName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workflowDrawerOpen, setWorkflowDrawerOpen] = useState(false);
  const [drawerNodesOpen, setDrawerNodesOpen] = useState(true);
  const [drawerConnectorsOpen, setDrawerConnectorsOpen] = useState(true);
  const [drawerEvalsOpen, setDrawerEvalsOpen] = useState(true);
  const [inspectedNode, setInspectedNode] =
    useState<Node<WorkflowNodeData> | null>(null);
  const nodeIdRef = useRef(initialNodes.length + 1);

  const [isPanelLoading, setIsPanelLoading] = useState(false);

  const updateInspectedNode = useCallback(
    (patch: Partial<WorkflowNodeData>) => {
      if (!inspectedNode) return;
      const updatedData = { ...inspectedNode.data, ...patch };
      setNodes((nds) =>
        nds.map((n) =>
          n.id === inspectedNode.id ? { ...n, data: updatedData } : n,
        ),
      );
      setInspectedNode((prev) =>
        prev ? { ...prev, data: updatedData } : null,
      );
    },
    [inspectedNode],
  );

  // Fetch node data from backend whenever a node is opened in the panel
  useEffect(() => {
    if (!inspectedNode || !agentId) return;

    const nodeId = inspectedNode.id;

    const fetchNodeData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setIsPanelLoading(true);
      try {
        const res = await fetch("/api/workflow/get-node", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.uid,
            agent_id: agentId,
            node_id: nodeId,
          }),
        });

        if (!res.ok) return;
        const json = await res.json();

        if (json.success && json.data) {
          const merged = { ...inspectedNode.data, ...json.data };
          setNodes((nds) =>
            nds.map((n) => (n.id === nodeId ? { ...n, data: merged } : n)),
          );
          setInspectedNode((prev) =>
            prev?.id === nodeId ? { ...prev, data: merged } : prev,
          );
        }
      } catch (error) {
        console.error("Failed to fetch node data:", error);
      } finally {
        setIsPanelLoading(false);
      }
    };

    fetchNodeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectedNode?.id, agentId]);

  const saveNodeUpdate = useCallback(
    async (patch: Partial<WorkflowNodeData>): Promise<boolean> => {
      if (!inspectedNode || !agentId) return false;
      const user = auth.currentUser;
      if (!user) return false;

      const mergedData = { ...inspectedNode.data, ...patch };

      // Migrate legacy "output" kind to "complete"
      if ((mergedData.kind as string) === "output") {
        mergedData.kind = "complete";
      }

      // Ensure eval nodes always persist the judge model (may be at default if never changed)
      if (
        mergedData.kind === "eval" &&
        mergedData.evalType === "llm_judge" &&
        !mergedData.evalModel
      ) {
        mergedData.evalModel = "gpt-4o";
      }

      const payload = {
        user_id: user.uid,
        agent_id: agentId,
        node_id: inspectedNode.id,
        data: mergedData,
      };
      console.log("[update-node] sending:", payload);
      try {
        const res = await fetch("/api/workflow/update-node", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error("[update-node] error", res.status, errText);
          return false;
        }
        const json = await res.json();
        console.log("[update-node] success:", json);
        const ok = json.success === true;

        // For eval nodes, sync pass/fail edges after a successful save
        if (ok && mergedData.kind === "eval") {
          const nodeId = inspectedNode.id;
          setEdges((eds) => {
            // Remove old pass/fail edges originating from this eval node
            const filtered = eds.filter(
              (e) =>
                !(
                  e.source === nodeId &&
                  (e.data?.evalEdgeType === "pass" ||
                    e.data?.evalEdgeType === "fail")
                ),
            );

            const newEdges: Edge[] = [];

            if (mergedData.evalPassNodeId) {
              newEdges.push({
                id: `eval-pass-${nodeId}`,
                source: nodeId,
                target: mergedData.evalPassNodeId as string,
                label: "pass",
                labelStyle: { fill: "#4ade80", fontWeight: 600, fontSize: 11 },
                labelBgStyle: { fill: "#14532d", opacity: 0.85 },
                labelBgPadding: [6, 4] as [number, number],
                labelBgBorderRadius: 4,
                style: { stroke: "#4ade80", strokeWidth: 1.5 },
                data: { evalEdgeType: "pass" },
              });
            }

            if (mergedData.evalFailNodeId) {
              newEdges.push({
                id: `eval-fail-${nodeId}`,
                source: nodeId,
                target: mergedData.evalFailNodeId as string,
                label: "fail",
                labelStyle: { fill: "#f87171", fontWeight: 600, fontSize: 11 },
                labelBgStyle: { fill: "#7f1d1d", opacity: 0.85 },
                labelBgPadding: [6, 4] as [number, number],
                labelBgBorderRadius: 4,
                style: { stroke: "#f87171", strokeWidth: 1.5 },
                data: { evalEdgeType: "fail" },
              });
            }

            return [...filtered, ...newEdges];
          });
        }

        return ok;
      } catch (error) {
        console.error("[update-node] fetch failed:", error);
        return false;
      }
    },
    [inspectedNode, agentId],
  );

  useEffect(() => {
    if (!agentId) return;

    const loadWorkflow = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setIsLoading(true);
      try {
        const response = await fetch("/api/workflow/get-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.uid, agent_id: agentId }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data.success || !data.workflowConfig) return;

        const { nodes: backendNodes, edges: backendEdges } =
          data.workflowConfig;

        if (Array.isArray(backendNodes) && backendNodes.length > 0) {
          const migratedNodes = backendNodes.map((n: Node<WorkflowNodeData>) =>
            (n.data?.kind as string) === "output"
              ? { ...n, data: { ...n.data, kind: "complete" as NodeKind } }
              : n
          );
          setNodes(migratedNodes as Node<WorkflowNodeData>[]);
          nodeIdRef.current = backendNodes.length + 1;
        }

        if (Array.isArray(backendEdges)) {
          setEdges(
            backendEdges.map((e: Edge) => ({
              ...e,
              style: { stroke: "#3f3f46" },
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load workflow config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkflow();
  }, [agentId]);

  const saveWorkflow = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !agentId || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/workflow/save-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          nodes: nodes.map(({ id, type, position, data }) => ({
            id,
            type,
            position,
            data,
          })),
          edges: edges.map(({ id, source, target, label, data }) => ({
            id,
            source,
            target,
            ...(label !== undefined && { label }),
            ...(data !== undefined && { data }),
          })),
        }),
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);

      toast.success("Workflow saved");
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [agentId, nodes, edges, isSaving]);

  // Cmd+S / Ctrl+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveWorkflow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveWorkflow]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) =>
      setNodes(
        (nds) => applyNodeChanges(changes, nds) as Node<WorkflowNodeData>[],
      ),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, style: { stroke: "#3f3f46" } }, eds),
      ),
    [],
  );

  // Delete selected edge on Backspace / Delete
  const assignEvalEdgeType = useCallback(
    (edgeId: string, type: "pass" | "fail") => {
      setEdges((eds) => {
        const targetEdge = eds.find((e) => e.id === edgeId);
        if (!targetEdge) return eds;
        const sourceNodeId = targetEdge.source;

        return eds.map((e) => {
          // Demote any existing edge of the same type from the same source
          if (
            e.id !== edgeId &&
            e.source === sourceNodeId &&
            e.data?.evalEdgeType === type
          ) {
            return {
              ...e,
              label: undefined,
              labelStyle: undefined,
              labelBgStyle: undefined,
              style: { stroke: "#3f3f46", strokeWidth: 1.5 },
              data: { ...e.data, evalEdgeType: undefined },
            };
          }
          // Apply the new type to the clicked edge
          if (e.id === edgeId) {
            const isPass = type === "pass";
            return {
              ...e,
              label: type,
              labelStyle: {
                fill: isPass ? "#4ade80" : "#f87171",
                fontWeight: 600,
                fontSize: 11,
              },
              labelBgStyle: {
                fill: isPass ? "#14532d" : "#7f1d1d",
                opacity: 0.85,
              },
              labelBgPadding: [6, 4] as [number, number],
              labelBgBorderRadius: 4,
              style: {
                stroke: isPass ? "#4ade80" : "#f87171",
                strokeWidth: 1.5,
              },
              data: { ...e.data, evalEdgeType: type },
            };
          }
          return e;
        });
      });

      // Sync the eval node's pass/fail target
      setNodes((nds) => {
        const targetEdge = edges.find((e) => e.id === edgeId);
        if (!targetEdge) return nds;
        return nds.map((n) => {
          if (n.id !== targetEdge.source) return n;
          const field = type === "pass" ? "evalPassNodeId" : "evalFailNodeId";
          return { ...n, data: { ...n.data, [field]: targetEdge.target } };
        });
      });

      setEdgeContextMenu(null);
    },
    [edges],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && selectedEdgeId) {
        // Don't fire when typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (e.target as HTMLElement).isContentEditable
        )
          return;
        setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId]);

  const styledEdges = edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const isFromEval = sourceNode?.data.kind === "eval";
    const hasEvalLabel = !!edge.data?.evalEdgeType;

    if (edge.id === selectedEdgeId) {
      return {
        ...edge,
        style: {
          stroke: "#2D47BC",
          strokeWidth: 2.5,
          strokeDasharray: isFromEval && !hasEvalLabel ? "6,4" : undefined,
        },
      };
    }
    if (isFromEval && !hasEvalLabel) {
      return {
        ...edge,
        style: { stroke: "#52525b", strokeWidth: 1.5, strokeDasharray: "6,4" },
      };
    }
    return { ...edge, style: { stroke: "#3f3f46", strokeWidth: 1.5 } };
  });

  const addNode = useCallback(
    (
      kindOverride?: NodeKind,
      extraData?: { service?: ConnectorService; evalType?: EvalType },
    ) => {
      const kind = kindOverride ?? selectedKind;
      const label =
        !kindOverride && nodeName.trim()
          ? nodeName.trim()
          : kind === "connector" && extraData?.service
            ? `Connector: ${CONNECTOR_META[extraData.service].label}`
            : kind === "complete"
              ? `Complete ${nodeIdRef.current}`
              : `${kind} ${nodeIdRef.current}`;
      const id = `n${nodeIdRef.current++}`;
      const newNode: Node<WorkflowNodeData> = {
        id,
        type: "workflow",
        position: {
          x: 200 + Math.random() * 200,
          y: 150 + Math.random() * 200,
        },
        data: {
          label,
          kind,
          ...(extraData?.service
            ? { connectorService: extraData.service }
            : {}),
          ...(extraData?.evalType ? { evalType: extraData.evalType } : {}),
        },
      };
      setNodes((nds) => [...nds, newNode]);
      if (!kindOverride) setNodeName("");
    },
    [nodeName, selectedKind],
  );

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "calc(100vh - 8rem)",
        background: "#09090b",
        overflow: "hidden",
        borderRadius: 8,
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      {/* ── Sidebar (commented out) ── */}
      {false && (
        <aside
          style={{
            width: sidebarCollapsed ? 180 : 240,
            flexShrink: 0,
            background: "#18181b",
            borderRight: "1px solid #27272a",
            borderRadius: sidebarCollapsed ? 8 : 0,
            display: "flex",
            flexDirection: "column",
            padding: "20px 0",
            zIndex: 10,
            fontFamily: "inherit",
            transition: "width 0.2s ease, height 0.2s ease",
            overflow: "hidden",
            alignSelf: sidebarCollapsed ? "flex-start" : "stretch",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0 20px 20px",
              borderBottom: sidebarCollapsed ? "none" : "1px solid #27272a",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  color: "#52525b",
                  marginBottom: 4,
                }}
              >
                WORKFLOW
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fafafa",
                  letterSpacing: "-0.02em",
                }}
              >
                Builder
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed((c) => !c)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#52525b",
                padding: 2,
                display: "flex",
                alignItems: "center",
                marginTop: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#a1a1aa")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#52525b")}
              title={sidebarCollapsed ? "Expand" : "Collapse"}
            >
              {sidebarCollapsed ? (
                <Maximize2 size={14} />
              ) : (
                <Minimize2 size={14} />
              )}
            </button>
          </div>

          {/* Add node form */}
          {!sidebarCollapsed && (
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #27272a",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#52525b",
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                }}
              >
                ADD NODE
              </div>

              {/* Kind selector */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {NODE_KINDS.map(({ kind, label }) => (
                  <button
                    key={kind}
                    onClick={() => setSelectedKind(kind)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      background:
                        selectedKind === kind ? "#27272a" : "transparent",
                      border: `1px solid ${selectedKind === kind ? KIND_STYLES[kind].border : "#3f3f46"}`,
                      borderRadius: 6,
                      color:
                        selectedKind === kind
                          ? KIND_STYLES[kind].border
                          : "#71717a",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit",
                      transition: "all 0.12s ease",
                      textAlign: "left",
                    }}
                  >
                    {/* <span>{icon}</span> */}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Name input */}
              <input
                type="text"
                placeholder="Node label (optional)"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNode()}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "#09090b",
                  border: "1px solid #3f3f46",
                  borderRadius: 6,
                  color: "#fafafa",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                  marginBottom: 8,
                  boxSizing: "border-box",
                }}
              />

              <button
                onClick={() => addNode()}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: KIND_STYLES[selectedKind].border,
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  transition: "opacity 0.12s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                + Add Node
              </button>
            </div>
          )}

          {/* Legend */}
          {!sidebarCollapsed && (
            <div style={{ padding: "18px 20px", flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "#52525b",
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                }}
              >
                LEGEND
              </div>
              {NODE_KINDS.map(({ kind, label, description }) => (
                <div
                  key={kind}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 3,
                      height: 32,
                      borderRadius: 2,
                      background: KIND_STYLES[kind].border,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#d4d4d8",
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#52525b", marginTop: 1 }}
                    >
                      {description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {!sidebarCollapsed && (
            <div
              style={{ padding: "16px 20px", borderTop: "1px solid #27272a" }}
            >
              <div style={{ fontSize: 10, color: "#52525b", marginBottom: 4 }}>
                {nodes.length} nodes · {edges.length} edges
              </div>
              <button
                onClick={clearAll}
                style={{
                  background: "transparent",
                  border: "1px solid #3f3f46",
                  borderRadius: 6,
                  color: "#71717a",
                  fontSize: 11,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  padding: "6px 10px",
                }}
              >
                Clear canvas
              </button>
            </div>
          )}
        </aside>
      )}

      {/* ── Canvas ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .react-flow__node { background: transparent !important; }
      `}</style>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <main style={{ flex: 1, position: "relative" }}>
            <ReactFlow
              nodes={nodes}
              edges={styledEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              defaultEdgeOptions={{
                style: { stroke: "#3f3f46", strokeWidth: 1.5 },
                animated: false,
              }}
              onEdgeClick={(_e, edge) => {
                setSelectedEdgeId(edge.id);
                setEdgeContextMenu(null);
              }}
              onEdgeContextMenu={(e, edge) => {
                e.preventDefault();
                const sourceNode = nodes.find((n) => n.id === edge.source);
                if (sourceNode?.data.kind !== "eval") return;
                setSelectedEdgeId(edge.id);
                setEdgeContextMenu({
                  edgeId: edge.id,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onPaneClick={() => {
                setSelectedEdgeId(null);
                setEdgeContextMenu(null);
              }}
              onNodeClick={(_e, node) => {
                setEdgeContextMenu(null);
                const n = node as Node<WorkflowNodeData>;
                if ((n.data?.kind as string) === "output") {
                  n.data = { ...n.data, kind: "complete" };
                }
                setInspectedNode(n);
              }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="#27272a"
              />
              {/* React Flow zoom/fit controls — hidden to remove left white bar */}
              {false && (
                <Controls
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 8,
                  }}
                />
              )}
            </ReactFlow>

            {/* Bottom-left: Menu icon */}
            <div
              style={{ position: "absolute", bottom: 16, left: 16, zIndex: 10 }}
            >
              <button
                type="button"
                onClick={() => setWorkflowDrawerOpen(true)}
                style={{
                  padding: "10px",
                  background: "transparent",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  color: "#a1a1aa",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#fafafa";
                  e.currentTarget.style.borderColor = "#52525b";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#a1a1aa";
                  e.currentTarget.style.borderColor = "#3f3f46";
                }}
                title="Workflow overview"
              >
                <Menu size={16} />
              </button>
            </div>

            {/* Bottom-right: action buttons */}
            <div
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                zIndex: 10,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              {agentId && (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams({
                      id: agentId,
                      edit: "true",
                    });
                    if (displayName) params.set("name", displayName);
                    router.push(`/workflowAgent?${params.toString()}`);
                  }}
                  style={{
                    padding: "10px 20px",
                    background: "transparent",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    color: "#a1a1aa",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                    transition: "opacity 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#fafafa";
                    e.currentTarget.style.borderColor = "#52525b";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#a1a1aa";
                    e.currentTarget.style.borderColor = "#3f3f46";
                  }}
                >
                  Configure settings
                </button>
              )}
              <button
                onClick={saveWorkflow}
                disabled={isSaving || !agentId}
                style={{
                  padding: "10px 20px",
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  color: isSaving ? "#71717a" : "#fafafa",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: isSaving || !agentId ? "not-allowed" : "pointer",
                  letterSpacing: "0.03em",
                  transition: "opacity 0.12s ease",
                  opacity: isSaving || !agentId ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSaving && agentId)
                    e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity =
                    isSaving || !agentId ? "0.6" : "1";
                }}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {}}
                style={{
                  padding: "10px 20px",
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                  boxShadow: "0 4px 16px #3b82f640",
                  transition: "opacity 0.12s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                ▶ Run workflow
              </button>
            </div>

            {/* Loading overlay */}
            {isLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#09090b99",
                  zIndex: 20,
                  pointerEvents: "none",
                }}
              >
                <div style={{ textAlign: "center", color: "#71717a" }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      border: "2.5px solid #3f3f46",
                      borderTopColor: "#3b82f6",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      margin: "0 auto 10px",
                    }}
                  />
                  <div style={{ fontSize: 12 }}>Loading workflow…</div>
                </div>
              </div>
            )}

            {/* Empty state hint */}
            {nodes.length === 0 && !isLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{ textAlign: "center", color: "#3f3f46" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
                  <div style={{ fontSize: 13 }}>
                    Add a node from the sidebar to get started
                  </div>
                </div>
              </div>
            )}
          </main>
        </ContextMenuTrigger>
        <ContextMenuContent
          style={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            minWidth: 180,
            padding: 4,
          }}
        >
          {/* Trigger */}
          <ContextMenuItem
            onSelect={() => addNode("trigger")}
            style={{
              color: KIND_STYLES["trigger"].border,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ⚡ Add Trigger
          </ContextMenuItem>

          {/* LLM */}
          <ContextMenuItem
            onSelect={() => addNode("llm")}
            style={{
              color: KIND_STYLES["llm"].border,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            🤖 Add LLM
          </ContextMenuItem>

          {/* Connectors submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger
              style={{
                color: KIND_STYLES["connector"].border,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🔌 Add Connector
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                minWidth: 160,
                padding: 4,
              }}
            >
              {(
                [
                  "slack",
                  "notion",
                  "gong",
                  "jira",
                  "confluence",
                  "apollo",
                  "facebook_ads",
                  "linkedin_ads",
                ] as ConnectorService[]
              ).map((service) => {
                const comingSoon =
                  service === "facebook_ads" || service === "linkedin_ads";
                return (
                  <ContextMenuItem
                    key={service}
                    onSelect={() => {
                      if (!comingSoon) addNode("connector", { service });
                    }}
                    disabled={comingSoon}
                    style={{
                      color: comingSoon
                        ? "#52525b"
                        : KIND_STYLES["connector"].border,
                      fontFamily: "inherit",
                      fontSize: 13,
                      cursor: comingSoon ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    {CONNECTOR_META[service].label}
                    {comingSoon && (
                      <Badge className="bg-[#27272a] text-[#52525b] border border-[#3f3f46] text-[9px] font-semibold px-1.5 py-0 leading-4 hover:bg-[#27272a]">
                        Soon
                      </Badge>
                    )}
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Evals submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger
              style={{
                color: KIND_STYLES["eval"].border,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ◈ Add Eval
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                minWidth: 180,
                padding: 4,
              }}
            >
              {(
                [
                  "llm_judge",
                  "toxicity",
                  "pii",
                  "regex",
                  "proximity",
                ] as EvalType[]
              ).map((evalType) => (
                <ContextMenuItem
                  key={evalType}
                  onSelect={() => addNode("eval", { evalType })}
                  style={{
                    color: KIND_STYLES["eval"].border,
                    fontFamily: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {EVAL_META[evalType].icon} {EVAL_META[evalType].label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* For Review */}
          <ContextMenuItem
            onSelect={() => addNode("forReview")}
            style={{
              color: KIND_STYLES["forReview"].border,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            🚩 For Review
          </ContextMenuItem>

          <ContextMenuSeparator
            style={{ background: "#27272a", margin: "4px 0" }}
          />

          {/* Output */}
          <ContextMenuItem
            onSelect={() => addNode("complete")}
            style={{
              color: KIND_STYLES["complete"].border,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ✓ Add Complete
          </ContextMenuItem>
        </ContextMenuContent>
        {/* <ContextMenuContent
        style={{
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: 8,
          minWidth: 160,
        }}
      >
        {(["action", "condition", "complete"] as NodeKind[]).map((kind) => {
          const meta = NODE_KINDS.find((n) => n.kind === kind)!;
          return (
            <ContextMenuItem
              key={kind}
              onSelect={() => addNode(kind)}
              style={{
                color: KIND_STYLES[kind].border,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {meta.icon} Add {meta.label}
            </ContextMenuItem>
          );
        })}
      </ContextMenuContent> */}
      </ContextMenu>

      {/* ── Edge context menu (eval pass/fail assignment) ── */}
      {edgeContextMenu && (
        <div
          style={{
            position: "fixed",
            top: edgeContextMenu.y,
            left: edgeContextMenu.x,
            zIndex: 9999,
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            padding: 4,
            minWidth: 160,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            fontFamily: "var(--font-geist-sans)",
          }}
          onMouseLeave={() => setEdgeContextMenu(null)}
        >
          <button
            onClick={() => assignEvalEdgeType(edgeContextMenu.edgeId, "pass")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 10px",
              background: "none",
              border: "none",
              borderRadius: 6,
              color: "#4ade80",
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#14532d33")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#4ade80",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            Mark as Pass
          </button>
          <button
            onClick={() => assignEvalEdgeType(edgeContextMenu.edgeId, "fail")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 10px",
              background: "none",
              border: "none",
              borderRadius: 6,
              color: "#f87171",
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#7f1d1d33")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#f87171",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            Mark as Fail
          </button>
        </div>
      )}

      {/* ── Workflow Overview Drawer ── */}
      <Sheet open={workflowDrawerOpen} onOpenChange={setWorkflowDrawerOpen}>
        <SheetContent
          side="left"
          className="p-0 border-r border-[#27272a] bg-[#18181b] text-[#fafafa] w-[320px] sm:max-w-[320px] overflow-y-auto"
        >
          <SheetHeader className="px-5 py-4 border-b border-[#27272a]">
            <SheetTitle className="text-[#fafafa] text-sm font-semibold">
              {displayName || "Workflow"}
            </SheetTitle>
          </SheetHeader>
          <div className="py-2">
            {/* Nodes */}
            <div className="border-b border-[#27272a]">
              <button
                onClick={() => setDrawerNodesOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#27272a] transition-colors"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-[#52525b]">
                  Nodes
                </span>
                <ChevronDown
                  size={14}
                  className="text-[#52525b] transition-transform duration-200"
                  style={{
                    transform: drawerNodesOpen
                      ? "rotate(0deg)"
                      : "rotate(-90deg)",
                  }}
                />
              </button>
              {drawerNodesOpen && (
                <div className="px-5 pb-3 space-y-2">
                  {nodes.filter(
                    (n) =>
                      n.data.kind !== "connector" && n.data.kind !== "eval",
                  ).length === 0 ? (
                    <p className="text-xs text-[#52525b]">No nodes</p>
                  ) : (
                    nodes
                      .filter(
                        (n) =>
                          n.data.kind !== "connector" && n.data.kind !== "eval",
                      )
                      .map((n) => (
                        <Card
                          key={n.id}
                          className="bg-[#27272a] border-[#3f3f46]"
                        >
                          <CardContent className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-1.5 h-4 rounded-full flex-shrink-0"
                                style={{
                                  background:
                                    KIND_STYLES[n.data.kind]?.border ??
                                    "#52525b",
                                }}
                              />
                              <div>
                                <p className="text-xs font-semibold text-[#fafafa]">
                                  {n.data.label}
                                </p>
                                <p className="text-[10px] text-[#71717a] capitalize">
                                  {n.data.kind}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Connectors */}
            <div className="border-b border-[#27272a]">
              <button
                onClick={() => setDrawerConnectorsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#27272a] transition-colors"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-[#52525b]">
                  Connectors
                </span>
                <ChevronDown
                  size={14}
                  className="text-[#52525b] transition-transform duration-200"
                  style={{
                    transform: drawerConnectorsOpen
                      ? "rotate(0deg)"
                      : "rotate(-90deg)",
                  }}
                />
              </button>
              {drawerConnectorsOpen && (
                <div className="px-5 pb-3 space-y-2">
                  {(() => {
                    const connectorNodes = nodes.filter(
                      (n) => n.data.kind === "connector",
                    );
                    const seen = new Set<string>();
                    const unique = connectorNodes.filter((n) => {
                      const key = n.data.connectorService ?? "unknown";
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                    if (unique.length === 0)
                      return (
                        <p className="text-xs text-[#52525b]">No connectors</p>
                      );
                    return unique.map((n) => (
                      <Card
                        key={n.data.connectorService ?? n.id}
                        className="bg-[#27272a] border-[#3f3f46]"
                      >
                        <CardContent className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-1.5 h-4 rounded-full flex-shrink-0"
                              style={{
                                background: KIND_STYLES.connector.border,
                              }}
                            />
                            <div>
                              <p className="text-xs font-semibold text-[#fafafa] capitalize">
                                {n.data.connectorService ?? "Connector"}
                              </p>
                              <p className="text-[10px] text-[#71717a]">
                                connector
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Evals */}
            <div className="border-b border-[#27272a]">
              <button
                onClick={() => setDrawerEvalsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#27272a] transition-colors"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-[#52525b]">
                  Evals
                </span>
                <ChevronDown
                  size={14}
                  className="text-[#52525b] transition-transform duration-200"
                  style={{
                    transform: drawerEvalsOpen
                      ? "rotate(0deg)"
                      : "rotate(-90deg)",
                  }}
                />
              </button>
              {drawerEvalsOpen && (
                <div className="px-5 pb-3 space-y-2">
                  {(() => {
                    const evalNodes = nodes.filter(
                      (n) => n.data.kind === "eval",
                    );
                    const seen = new Set<string>();
                    const unique = evalNodes.filter((n) => {
                      const key = n.data.evalType ?? "unknown";
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                    if (unique.length === 0)
                      return <p className="text-xs text-[#52525b]">No evals</p>;
                    return unique.map((n) => (
                      <Card
                        key={n.data.evalType ?? n.id}
                        className="bg-[#27272a] border-[#3f3f46]"
                      >
                        <CardContent className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-1.5 h-4 rounded-full flex-shrink-0"
                              style={{ background: KIND_STYLES.eval.border }}
                            />
                            <div>
                              <p className="text-xs font-semibold text-[#fafafa] capitalize">
                                {(n.data.evalType ?? "eval").replace(/_/g, " ")}
                              </p>
                              <p className="text-[10px] text-[#71717a]">eval</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Node Inspector Sheet ── */}
      <Sheet
        open={!!inspectedNode}
        onOpenChange={(open) => !open && setInspectedNode(null)}
      >
        <SheetContent
          side="right"
          className="p-0 border-l border-[#27272a] bg-[#18181b] text-[#fafafa] w-[340px] sm:max-w-[340px]"
        >
          {/* visually-hidden accessible title required by SheetPrimitive */}
          <SheetHeader className="sr-only">
            <SheetTitle>Node Inspector</SheetTitle>
            <SheetDescription>Edit node properties</SheetDescription>
          </SheetHeader>
          {inspectedNode && isPanelLoading && (
            <NodeInspectorSkeleton
              accentColor={KIND_STYLES[inspectedNode.data.kind].border}
            />
          )}
          {inspectedNode && !isPanelLoading && (
            <NodeInspectorPanel
              node={inspectedNode}
              onChange={updateInspectedNode}
              onSave={saveNodeUpdate}
              allNodes={nodes}
              onDelete={async () => {
                const user = auth.currentUser;
                if (user && agentId) {
                  try {
                    await fetch("/api/workflow/delete-node", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        user_id: user.uid,
                        agent_id: agentId,
                        node_id: inspectedNode.id,
                      }),
                    });
                  } catch (error) {
                    console.error("Failed to delete node:", error);
                  }
                }
                setNodes((nds) => nds.filter((n) => n.id !== inspectedNode.id));
                setEdges((eds) =>
                  eds.filter(
                    (e) =>
                      e.source !== inspectedNode.id &&
                      e.target !== inspectedNode.id,
                  ),
                );
                setInspectedNode(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
