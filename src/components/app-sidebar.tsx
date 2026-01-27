"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Settings, Users } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePostHog } from "posthog-js/react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { auth, db } from "@/tools/firebase";

const items = [
  {
    title: "Agents",
    url: "/",
    icon: LayoutDashboard,
    eventName: "nav: agents",
  },
  {
    title: "Members & Permissions",
    url: "/members",
    icon: Users,
    eventName: "nav: members and permissions",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    eventName: "nav: settings",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const posthog = usePostHog();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) {
        return;
      }
      if (!user) {
        setUserId(null);
        setTeamId(null);
        return;
      }
      setUserId(user.uid);
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        if (isMounted) {
          setTeamId(nextTeamId ?? null);
        }
      } catch (error) {
        console.error("Failed to load team id for nav tracking:", error);
        if (isMounted) {
          setTeamId(null);
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link
                      href={item.url}
                      onClick={() => {
                        if (pathname !== item.url) {
                          posthog?.capture(item.eventName, getNavProps());
                        }
                      }}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
