"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePostHog } from "posthog-js/react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useSidebar } from "@/components/ui/sidebar";
import { getTeamAgents, type Agent } from "@/tools/agent_tools";
import { auth, db } from "@/tools/firebase";

const PAGE_ITEMS = [
  { label: "Agents", href: "/", eventName: "nav: agents" },
  {
    label: "Members",
    href: "/members",
    eventName: "nav: members and permissions",
  },
  { label: "Settings", href: "/settings", eventName: "nav: settings" },
];

const isTextInputElement = (element: Element | null) => {
  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if ((element as HTMLElement).isContentEditable) {
    return true;
  }

  return (element as HTMLElement).getAttribute("role") === "textbox";
};

export function GlobalCommandMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) {
        return;
      }

      if (!user) {
        setAgents([]);
        setIsLoadingAgents(false);
        setUserId(null);
        setTeamId(null);
        return;
      }

      setUserId(user.uid);
      setIsLoadingAgents(true);
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const teamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;

        if (!teamId) {
          setAgents([]);
          setTeamId(null);
          return;
        }
        setTeamId(teamId);

        const teamAgents = await getTeamAgents(teamId, user.uid, {
          includeAllForAdmins: true,
        });
        if (isMounted) {
          setAgents(teamAgents);
        }
      } catch (error) {
        console.error("Failed to fetch agents for command menu:", error);
      } finally {
        if (isMounted) {
          setIsLoadingAgents(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getNavProps = () => {
    const eventProps: Record<string, string> = {};
    if (userId) {
      eventProps.user_id = userId;
    }
    if (teamId) {
      eventProps.team_id = teamId;
    }
    return eventProps;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextInputElement(document.activeElement)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (event.metaKey && event.key === "/") {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const agentItems = useMemo(
    () =>
      agents.map((agent) => ({
        agent,
        id: agent.id,
        label: agent.name || `${agent.type} agent`,
        value: `${agent.name ?? ""} ${agent.type}`.trim(),
      })),
    [agents]
  );

  const handleNavigate = (href: string, eventName: string) => {
    if (pathname !== href) {
      posthog?.capture(eventName, getNavProps());
    }
    router.push(href);
    setOpen(false);
  };

  const handleAgentNavigate = (agent: Agent) => {
    posthog?.capture("nav: agent", {
      ...getNavProps(),
      agent_id: agent.id,
      agent_name: agent.name ?? `${agent.type} agent`,
      agent_type: agent.type,
    });
    const params = new URLSearchParams({ id: agent.id });
    router.push(`/chatAgent?${params.toString()}`);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and agents..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Agents">
          {isLoadingAgents ? (
            <CommandItem disabled>Loading agents...</CommandItem>
          ) : agentItems.length > 0 ? (
            agentItems.map((agent) => (
              <CommandItem
                key={agent.id}
                value={agent.value}
                onSelect={() => handleAgentNavigate(agent.agent)}
              >
                {agent.label}
              </CommandItem>
            ))
          ) : (
            <CommandItem disabled>No agents found.</CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {PAGE_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={item.label}
              onSelect={() => handleNavigate(item.href, item.eventName)}
            >
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
