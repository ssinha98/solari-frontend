"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Mention from "@tiptap/extension-mention";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { cn } from "@/lib/utils";
import { FileText, File } from "lucide-react";
import { IoIosDocument } from "react-icons/io";
import { CiGlobe, CiViewTable } from "react-icons/ci";
import Image from "next/image";

interface CustomEditorProps {
  value: string; // now expected to be HTML (to preserve mentions)
  onChange: (value: string) => void; // returns HTML
  onSend: (text: string) => void; // receives text content (mentions as @label)
  placeholder?: string;
  className?: string;
  mentionItems?: MentionItem[]; // sources to show in mention menu
}

type MentionItem = {
  id: string;
  label: string;
  type: "file" | "site" | "variable";
  nickname?: string; // original nickname for filtering
  name?: string; // original name as fallback
  description?: string; // source description
  sourceType?: string; // actual source type (e.g., "document", "website", "table")
};

const DEMO_ITEMS: MentionItem[] = [
  { id: "file_abc123", label: "Employee Handbook", type: "file" },
  { id: "site_def456", label: "Product Docs", type: "site" },
  { id: "var_xyz789", label: "Q4 Pipeline", type: "variable" },
];

const MENTION_MENU_ID = "tiptap-mention-menu";

// Helper function to create icon element based on source type
function createIconElement(sourceType?: string, name?: string): Element {
  const type = sourceType?.toLowerCase() || "";

  // Check for specific types first
  switch (type) {
    case "document": {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const path1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path1.setAttribute(
        "d",
        "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
      );
      const polyline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
      );
      polyline.setAttribute("points", "14 2 14 8 20 8");
      const line1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line1.setAttribute("x1", "16");
      line1.setAttribute("y1", "13");
      line1.setAttribute("x2", "8");
      line1.setAttribute("y2", "13");
      const line2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line2.setAttribute("x1", "16");
      line2.setAttribute("y1", "17");
      line2.setAttribute("x2", "8");
      line2.setAttribute("y2", "17");
      const polyline2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
      );
      polyline2.setAttribute("points", "10 9 9 9 8 9");
      svg.appendChild(path1);
      svg.appendChild(polyline);
      svg.appendChild(line1);
      svg.appendChild(line2);
      svg.appendChild(polyline2);
      return svg;
    }
    case "website": {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");
      const line1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line1.setAttribute("x1", "2");
      line1.setAttribute("y1", "12");
      line1.setAttribute("x2", "22");
      line1.setAttribute("y2", "12");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute(
        "d",
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      );
      svg.appendChild(circle);
      svg.appendChild(line1);
      svg.appendChild(path);
      return svg;
    }
    case "table": {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      rect.setAttribute("x", "3");
      rect.setAttribute("y", "3");
      rect.setAttribute("width", "18");
      rect.setAttribute("height", "18");
      rect.setAttribute("rx", "2");
      const line1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line1.setAttribute("x1", "3");
      line1.setAttribute("y1", "9");
      line1.setAttribute("x2", "21");
      line1.setAttribute("y2", "9");
      const line2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line2.setAttribute("x1", "9");
      line2.setAttribute("y1", "21");
      line2.setAttribute("x2", "9");
      line2.setAttribute("y2", "9");
      svg.appendChild(rect);
      svg.appendChild(line1);
      svg.appendChild(line2);
      return svg;
    }
    case "jira": {
      const img = document.createElement("img");
      img.src =
        "https://img.icons8.com/?size=100&id=oROcPah5ues6&format=png&color=000000";
      img.alt = "Jira";
      img.width = 16;
      img.height = 16;
      img.style.width = "16px";
      img.style.height = "16px";
      return img;
    }
    case "confluence": {
      const img = document.createElement("img");
      img.src =
        "https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000";
      img.alt = "Confluence";
      img.width = 16;
      img.height = 16;
      img.style.width = "16px";
      img.style.height = "16px";
      return img;
    }
    case "slack": {
      const img = document.createElement("img");
      img.src =
        "https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000";
      img.alt = "Slack";
      img.width = 16;
      img.height = 16;
      img.style.width = "16px";
      img.style.height = "16px";
      return img;
    }
    case "google drive":
    case "googledrive": {
      const img = document.createElement("img");
      img.src =
        "https://img.icons8.com/?size=100&id=13630&format=png&color=000000";
      img.alt = "Google Drive";
      img.width = 16;
      img.height = 16;
      img.style.width = "16px";
      img.style.height = "16px";
      return img;
    }
    case "notion": {
      const img = document.createElement("img");
      img.src =
        "https://img.icons8.com/?size=100&id=nvtEH6DpqruC&format=png&color=000000";
      img.alt = "Notion";
      img.width = 16;
      img.height = 16;
      img.style.width = "16px";
      img.style.height = "16px";
      return img;
    }
    case "gong": {
      const img = document.createElement("img");
      img.src =
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiRxcqf6E93pRSDFSa2o8vuXjzc6IdaafuWA&s";
      img.alt = "Gong";
      img.width = 16;
      img.height = 16;
      img.style.width = "16px";
      img.style.height = "16px";
      return img;
    }
  }

  // Fallback to file extension if type is not specified
  if (name) {
    const extension = name.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
      case "docx":
      case "doc": {
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        const path1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path1.setAttribute(
          "d",
          "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
        );
        const polyline = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polyline"
        );
        polyline.setAttribute("points", "14 2 14 8 20 8");
        const line1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line1.setAttribute("x1", "16");
        line1.setAttribute("y1", "13");
        line1.setAttribute("x2", "8");
        line1.setAttribute("y2", "13");
        const line2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line2.setAttribute("x1", "16");
        line2.setAttribute("y1", "17");
        line2.setAttribute("x2", "8");
        line2.setAttribute("y2", "17");
        const polyline2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polyline"
        );
        polyline2.setAttribute("points", "10 9 9 9 8 9");
        svg.appendChild(path1);
        svg.appendChild(polyline);
        svg.appendChild(line1);
        svg.appendChild(line2);
        svg.appendChild(polyline2);
        return svg;
      }
      case "md":
      case "txt": {
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        const path1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path1.setAttribute(
          "d",
          "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        );
        const path2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path2.setAttribute("d", "M14 2v6h6");
        const line1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line1.setAttribute("x1", "16");
        line1.setAttribute("y1", "13");
        line1.setAttribute("x2", "8");
        line1.setAttribute("y2", "13");
        const line2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line2.setAttribute("x1", "16");
        line2.setAttribute("y1", "17");
        line2.setAttribute("x2", "8");
        line2.setAttribute("y2", "17");
        svg.appendChild(path1);
        svg.appendChild(path2);
        svg.appendChild(line1);
        svg.appendChild(line2);
        return svg;
      }
    }
  }

  // Default file icon
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute(
    "d",
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  );
  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M14 2v6h6");
  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", "16");
  line1.setAttribute("y1", "13");
  line1.setAttribute("x2", "8");
  line1.setAttribute("y2", "13");
  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", "16");
  line2.setAttribute("y1", "17");
  line2.setAttribute("x2", "8");
  line2.setAttribute("y2", "17");
  svg.appendChild(path1);
  svg.appendChild(path2);
  svg.appendChild(line1);
  svg.appendChild(line2);
  return svg;
}

// Helper function to truncate description
function truncateDescription(
  description?: string,
  maxLength: number = 50
): string {
  if (!description) return "";
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
}

function mentionSuggestionRender(editor: any) {
  let root: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let items: MentionItem[] = [];
  let commandFn: ((item: any) => void) | null = null;

  const position = (clientRect?: () => DOMRect | null) => {
    if (!root || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;

    root.style.left = `${rect.left}px`;
    // Position above the input - measure height after DOM update
    setTimeout(() => {
      if (!root) return;
      const menuHeight = root.offsetHeight || 240; // fallback to maxHeight
      root.style.top = `${rect.top - menuHeight - 6}px`;
    }, 0);
  };

  const renderList = () => {
    if (!root) return;
    root.innerHTML = "";

    const box = document.createElement("div");
    box.style.padding = "6px";
    box.style.background = "var(--popover)"; // card/popover background
    box.style.border = "1px solid var(--border)"; // border color
    box.style.borderRadius = "10px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
    box.style.minWidth = "260px";
    box.style.maxHeight = "240px";
    box.style.overflow = "auto";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.style.padding = "10px";
      empty.style.fontSize = "13px";
      empty.style.color = "var(--muted-foreground)"; // muted-foreground
      empty.textContent = "No matches";
      box.appendChild(empty);
      root.appendChild(box);
      return;
    }

    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.style.padding = "8px 10px";
      row.style.borderRadius = "8px";
      row.style.cursor = "pointer";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.background =
        i === selectedIndex ? "rgb(37, 99, 235)" : "transparent"; // dark blue background for selected

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";
      left.style.flex = "1";
      left.style.minWidth = "0";

      const label = document.createElement("div");
      label.textContent = item.label;
      label.style.fontSize = "14px";
      label.style.fontWeight = "500";
      label.style.color =
        i === selectedIndex
          ? "white" // white text for selected
          : "var(--popover-foreground)"; // foreground color for unselected

      const meta = document.createElement("div");
      const truncatedDesc = truncateDescription(item.description);
      meta.textContent = truncatedDesc || "";
      meta.style.fontSize = "12px";
      meta.style.color =
        i === selectedIndex
          ? "white" // white text for selected (with opacity)
          : "var(--muted-foreground)"; // muted-foreground for unselected
      if (i === selectedIndex) {
        meta.style.opacity = "0.8"; // slightly transparent for meta text
      }

      left.appendChild(label);
      if (truncatedDesc) {
        left.appendChild(meta);
      }

      row.appendChild(left);

      row.addEventListener("mouseenter", () => {
        selectedIndex = i;
        renderList();
      });

      // Click handler - use mousedown to prevent editor from stealing focus
      row.addEventListener("mousedown", (e) => {
        e.preventDefault(); // IMPORTANT: stops editor from stealing focus/selection
        e.stopPropagation();
        if (commandFn && item) {
          commandFn(item);
          // Insert a regular space after mention to keep cursor in editor and prevent line break
          if (editor && editor.commands) {
            setTimeout(() => {
              editor.commands.insertContent(" ");
            }, 0);
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
      root.id = MENTION_MENU_ID;
      root.style.position = "absolute";
      root.style.zIndex = "9999";
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
      // Update items from props to ensure we have the latest
      const currentItems = props.items ?? items;
      if (!currentItems.length) return false;

      if (props.event.key === "ArrowDown") {
        props.event.preventDefault();
        props.event.stopPropagation();
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        renderList();
        return true;
      }

      if (props.event.key === "ArrowUp") {
        props.event.preventDefault();
        props.event.stopPropagation();
        selectedIndex =
          (selectedIndex - 1 + currentItems.length) % currentItems.length;
        renderList();
        return true;
      }

      if (props.event.key === "Enter") {
        props.event.preventDefault();
        props.event.stopPropagation();
        const item = currentItems[selectedIndex];
        // Use commandFn from closure, not props.command (which may be undefined)
        if (item && commandFn) {
          commandFn(item);
          // Insert a regular space after mention to keep cursor in editor and prevent line break
          if (editor && editor.commands) {
            setTimeout(() => {
              editor.commands.insertContent(" ");
            }, 0);
          }
          return true;
        }
        return true;
      }

      if (props.event.key === "Escape") {
        props.event.preventDefault();
        return true;
      }

      // Allow space to be typed without closing the menu
      if (props.event.key === " ") {
        // Don't prevent default - allow space to be inserted
        // The allowSpaces option in the config will keep the menu open
        return false;
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

export function CustomEditor({
  value,
  onChange,
  onSend,
  placeholder = "Type @ to tag a file...",
  className,
  mentionItems = DEMO_ITEMS,
  editorRef: externalEditorRef,
}: CustomEditorProps & { editorRef?: React.MutableRefObject<any> }) {
  // Use a ref to store the latest mentionItems so the items function can access them
  const mentionItemsRef = useRef(mentionItems);
  // Use a ref to store the editor so the mention render function can access it
  const editorRef = useRef<any>(null);

  // Update the ref whenever mentionItems changes
  useEffect(() => {
    mentionItemsRef.current = mentionItems;
  }, [mentionItems]);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            label: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-label"),
              renderHTML: (attributes) => {
                if (!attributes.label) {
                  return {};
                }
                return {
                  "data-label": attributes.label,
                };
              },
            },
            type: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-type"),
              renderHTML: (attributes) => {
                if (!attributes.type) {
                  return {};
                }
                return {
                  "data-type": attributes.type,
                };
              },
            },
          };
        },
        renderHTML({ node, HTMLAttributes }) {
          return [
            "span",
            {
              ...HTMLAttributes,
              class: "mention-pill",
              "data-type": node.attrs.type,
              "data-id": node.attrs.id,
              "data-label": node.attrs.label,
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
      }).configure({
        HTMLAttributes: {
          class: "mention-pill",
          contenteditable: "false",
        },
        suggestion: {
          char: "@",
          allowSpaces: true,
          items: ({ query }: { query: string }) => {
            const q = (query ?? "").toLowerCase();
            const items = mentionItemsRef.current;
            return items
              .filter((i) => {
                // Search by nickname first, then name, then label
                const nicknameMatch = i.nickname?.toLowerCase().includes(q);
                const nameMatch = i.name?.toLowerCase().includes(q);
                const labelMatch = i.label.toLowerCase().includes(q);
                return nicknameMatch || nameMatch || labelMatch;
              })
              .slice(0, 8);
          },
          render: () => mentionSuggestionRender(editorRef.current),
        },
        // store label as the visible text
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
      }),
    ],
    content: value || "<p></p>",
    autofocus: true,
    editable: true,
    injectCSS: false,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // IMPORTANT: save HTML so mentions are preserved
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "w-full min-h-[2.25rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none prose prose-sm max-w-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "[&_.is-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-empty:first-child::before]:text-muted-foreground [&_.is-empty:first-child::before]:float-left [&_.is-empty:first-child::before]:pointer-events-none"
        ),
        style:
          "white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;",
        "data-placeholder": placeholder,
      },
      handleKeyDown: (view, event) => {
        // Check for mention menu FIRST, before any other key handling
        const mentionMenuOpen = !!document.getElementById(MENTION_MENU_ID);
        if (mentionMenuOpen) {
          // If menu is open, don't handle any keys - let mention system handle them
          return false; // Let the mention suggestion system handle it
        }

        // Handle backspace to prevent cursor from jumping inside mention
        if (event.key === "Backspace") {
          const { state, dispatch } = view;
          const { selection } = state;
          const { $from } = selection;

          // If cursor is right after a mention node and we're deleting
          if ($from.nodeBefore?.type.name === "mention") {
            // Check if there's a space or text node after
            const pos = $from.pos;
            const nodeAfter = $from.nodeAfter;

            // If we're at the end of the paragraph or there's no text after,
            // ensure we don't enter the mention
            if (!nodeAfter || nodeAfter.isText) {
              // Allow normal deletion but prevent entering mention
              return false;
            }
          }
        }

        if (event.key === "Enter") {
          if (event.shiftKey) {
            // Allow Shift+Enter to create a new line
            return false;
          } else {
            // Enter without Shift sends the message (no line break)
            event.preventDefault();
            // Get text content (uses renderText for mentions)
            if (editor) {
              const textContent = editor.getText();
              onSend(textContent);
            }
            return true;
          }
        }
        return false;
      },
    },
  });

  // Store editor in ref for mention render function and expose to parent
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      if (externalEditorRef) {
        externalEditorRef.current = editor;
      }
    }
  }, [editor, externalEditorRef]);

  // Sync external value changes to the editor (compare HTML, not text)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "<p></p>";
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div
      className={cn("flex-1 w-full min-w-0 [&_.ProseMirror]:w-full", className)}
    >
      <style>{`
        .ProseMirror {
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
          min-width: 0;
          width: 100%;
        }
        .ProseMirror p {
          line-height: 1.5;
          margin: 0;
          word-break: normal;
        }
        /* Hide ProseMirror's trailing break that causes line breaks after inline nodes */
        .ProseMirror-trailingBreak {
          display: none !important;
        }
        .mention-pill {
          display: inline;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgb(37, 99, 235);
          color: white;
          font-weight: 600;
          font-size: 12px;
          line-height: inherit;
          border: 1px solid rgb(37, 99, 235);
          white-space: nowrap;
          user-select: none;
          pointer-events: auto;
          vertical-align: baseline;
          margin: 0;
        }
        .ProseMirror .mention-pill {
          cursor: default;
          word-break: keep-all;
        }
        .ProseMirror p .mention-pill {
          display: inline;
          vertical-align: baseline;
        }
      `}</style>

      <EditorContent editor={editor} />
    </div>
  );
}
