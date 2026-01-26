"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Lock,
  Mail,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { GoWorkflow } from "react-icons/go";
import { MdChatBubble } from "react-icons/md";
import { FaHandsHelping } from "react-icons/fa";
import { VscSettings } from "react-icons/vsc";
import { IoAnalyticsOutline } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { getCreatorFirstName, inviteTeamMembers } from "@/tools/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTeamAgents, Agent } from "@/tools/agent_tools";
import { auth, db } from "@/tools/firebase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Dummy data - will be replaced with Firebase data
const dummyTasks = {
  hasPendingTasks: false,
};

const dummyAgentRuns = [
  {
    id: "1",
    agentName: "HR copilot",
    nextRun: "Tomorrow @ 9am",
  },
];

// Helper function to get icon component based on agent type
function getAgentTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "workflow":
      return <GoWorkflow className="h-5 w-5" />;
    case "source chat":
      return <MdChatBubble className="h-5 w-5" />;
    case "copilot":
      return <FaHandsHelping className="h-5 w-5" />;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamDialogStep, setTeamDialogStep] = useState<1 | 2 | 3>(1);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [onboardingTeamName, setOnboardingTeamName] = useState<string | null>(
    null,
  );
  const [creatorFirstName, setCreatorFirstName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [isSavingTeamName, setIsSavingTeamName] = useState(false);
  const [teamNameSaved, setTeamNameSaved] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isLoadingInviteCode, setIsLoadingInviteCode] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [isInvitingMembers, setIsInvitingMembers] = useState(false);
  const [inviteButtonLabel, setInviteButtonLabel] = useState("Invite");
  const [hasInvitedMembers, setHasInvitedMembers] = useState(false);
  const [emailInviteFromAdmin, setEmailInviteFromAdmin] = useState(false);
  const [showPaymentAlternative, setShowPaymentAlternative] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [isBookingSetup, setIsBookingSetup] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isFreeTrialing, setisFreeTrialing] = useState(false);
  const [deleteAgentDialogOpen, setDeleteAgentDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);
  const deleteAgentLabel =
    agentToDelete?.name ||
    (agentToDelete?.type ? `${agentToDelete.type} agent` : "this agent");
  const billingStatusUnsubRef = useRef<null | (() => void)>(null);
  const billingSuccessTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoadingAgents(true);
        const user = auth.currentUser;
        if (!user) {
          setAgents([]);
          return;
        }
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const teamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        if (!teamId) {
          setAgents([]);
          return;
        }
        const teamAgents = await getTeamAgents(teamId, user.uid, {
          includeAllForAdmins: true,
        });
        setAgents(teamAgents);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    fetchAgents();
  }, []);

  useEffect(() => {
    return () => {
      if (billingStatusUnsubRef.current) {
        billingStatusUnsubRef.current();
        billingStatusUnsubRef.current = null;
      }
      if (billingSuccessTimeoutRef.current) {
        window.clearTimeout(billingSuccessTimeoutRef.current);
        billingSuccessTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let teamUserUnsubscribe: (() => void) | null = null;
    let teamUserTimeout: number | null = null;
    let handledOnboarding = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !isMounted) {
        return;
      }

      try {
        if (teamUserUnsubscribe) {
          teamUserUnsubscribe();
          teamUserUnsubscribe = null;
        }
        if (teamUserTimeout) {
          window.clearTimeout(teamUserTimeout);
          teamUserTimeout = null;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          return;
        }

        const teamId = userSnap.data().teamId as string | undefined;
        if (!teamId) {
          return;
        }

        setTeamId(teamId);

        const teamUserRef = doc(db, "teams", teamId, "users", user.uid);

        teamUserUnsubscribe = onSnapshot(
          teamUserRef,
          async (teamUserSnap) => {
            if (!isMounted || !teamUserSnap.exists() || handledOnboarding) {
              return;
            }

            const teamUserData = teamUserSnap.data();
            if (teamUserData?.show_onboarding === undefined) {
              return;
            }

            const showOnboarding = Boolean(teamUserData?.show_onboarding);
            if (!showOnboarding) {
              if (teamUserUnsubscribe) {
                teamUserUnsubscribe();
                teamUserUnsubscribe = null;
              }
              if (teamUserTimeout) {
                window.clearTimeout(teamUserTimeout);
                teamUserTimeout = null;
              }
              return;
            }

            handledOnboarding = true;
            try {
              const teamRef = doc(db, "teams", teamId);
              const teamSnap = await getDoc(teamRef);
              if (!teamSnap.exists()) {
                handledOnboarding = false;
                return;
              }
              const teamData = teamSnap.data();
              const createdBy = teamData?.createdBy as string | undefined;
              const isAdminUser = createdBy !== user.uid;
              const hasTeamName = Boolean(teamData?.team_name);
              if (isMounted) {
                setOnboardingTeamName(
                  typeof teamData?.team_name === "string"
                    ? teamData.team_name
                    : null,
                );
                setCreatorFirstName(null);
                setIsTeamAdmin(isAdminUser);
              }

              if (createdBy) {
                try {
                  const creatorResponse = await getCreatorFirstName(
                    teamId,
                    user.uid,
                  );
                  const creatorFirst = creatorResponse.ok
                    ? (creatorResponse.creator_first_name ?? null)
                    : null;
                  if (isMounted) {
                    setCreatorFirstName(creatorFirst);
                  }
                } catch (error) {
                  console.error("Failed to fetch creator first name:", error);
                }
              }

              if (isAdminUser) {
                setIsTeamAdmin(true);
                setTeamNameSaved(hasTeamName);
                setTeamDialogStep(hasTeamName ? 2 : 1);
                setMemberDialogOpen(false);
                setTeamDialogOpen(true);
              } else {
                setIsTeamAdmin(false);
                setTeamDialogOpen(false);
                setMemberDialogOpen(true);
              }
            } catch (error) {
              console.error("Failed to load team metadata:", error);
              handledOnboarding = false;
            }

            if (teamUserUnsubscribe) {
              teamUserUnsubscribe();
              teamUserUnsubscribe = null;
            }
            if (teamUserTimeout) {
              window.clearTimeout(teamUserTimeout);
              teamUserTimeout = null;
            }
          },
          (error) => {
            console.error("Failed to watch onboarding status:", error);
          },
        );

        teamUserTimeout = window.setTimeout(() => {
          if (teamUserUnsubscribe) {
            teamUserUnsubscribe();
            teamUserUnsubscribe = null;
          }
        }, 10000);
      } catch (error) {
        console.error("Failed to check team setup:", error);
      }
    });

    return () => {
      isMounted = false;
      if (teamUserUnsubscribe) {
        teamUserUnsubscribe();
      }
      if (teamUserTimeout) {
        window.clearTimeout(teamUserTimeout);
      }
      unsubscribe();
    };
  }, []);

  const handleTeamDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (!teamNameSaved || teamDialogStep >= 2) {
        return;
      }
    }
    setTeamDialogOpen(open);
  };

  const displayName = auth.currentUser?.displayName?.trim();
  const firstName = displayName ? displayName.split(" ")[0] : null;
  const memberTeamLabel = onboardingTeamName ? `${onboardingTeamName}` : "your";
  const memberCreatorName = creatorFirstName ?? "your team admin";
  const formattedInviteCode =
    inviteCode.length === 6
      ? `${inviteCode.slice(0, 3)}-${inviteCode.slice(3)}`
      : "";
  const paymentTeamLabel = onboardingTeamName || teamName.trim() || "Your team";

  const shouldLoadInviteCode =
    (teamDialogOpen && teamDialogStep === 2) || memberDialogOpen;

  const markOnboardingComplete = async () => {
    const user = auth.currentUser;
    if (!teamId || !user) {
      return;
    }

    try {
      await setDoc(
        doc(db, "teams", teamId, "users", user.uid),
        { show_onboarding: false, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      console.error("Failed to update onboarding status:", error);
      toast.error("Failed to update onboarding status.");
    }
  };

  const handleTeamNameNext = async () => {
    const trimmedName = teamName.trim();
    if (!teamId || !trimmedName) {
      return;
    }

    try {
      setIsSavingTeamName(true);
      const pineconeNamespace = `${trimmedName
        .toLowerCase()
        .replace(/\s+/g, "-")}-namespace`;
      await setDoc(
        doc(db, "teams", teamId),
        {
          team_name: trimmedName,
          pinecone_namespace: pineconeNamespace,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setTeamNameSaved(true);
      setTeamDialogStep(2);
      setTeamDialogOpen(true);
    } catch (error) {
      console.error("Failed to save team name:", error);
      toast.error("Failed to save team name. Please try again.");
    } finally {
      setIsSavingTeamName(false);
    }
  };

  useEffect(() => {
    if (!shouldLoadInviteCode || !teamId) {
      return;
    }

    const fetchTeamInviteCode = async () => {
      try {
        setIsLoadingInviteCode(true);
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);
        const teamData = teamSnap.data();

        if (!teamSnap.exists() || !teamData?.invite_code) {
          toast.error("Invite code is not available yet.");
          return;
        }

        setInviteCode(teamData.invite_code as string);
      } catch (error) {
        console.error("Failed to fetch invite code:", error);
        toast.error("Failed to load invite code.");
      } finally {
        setIsLoadingInviteCode(false);
      }
    };

    void fetchTeamInviteCode();
  }, [shouldLoadInviteCode, teamId]);

  useEffect(() => {
    if (!teamDialogOpen || teamDialogStep !== 3) {
      setShowPaymentAlternative(false);
      return;
    }

    setShowPaymentAlternative(false);
    const timeoutId = window.setTimeout(() => {
      setShowPaymentAlternative(true);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [teamDialogOpen, teamDialogStep]);

  const handleCopyInviteCode = async () => {
    try {
      if (!formattedInviteCode) {
        toast.error("Invite code is not ready yet.");
        return;
      }
      await navigator.clipboard.writeText(formattedInviteCode);
      toast.success("Invite code copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy invite code:", error);
      toast.error("Failed to copy invite code.");
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInviteByEmail = () => {
    setEmailInviteFromAdmin(isTeamAdmin);
    setHasInvitedMembers(false);
    setInviteButtonLabel("Invite");
    setTeamDialogOpen(false);
    setMemberDialogOpen(false);
    setIsEmailDialogOpen(true);
  };

  const handleAddEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) {
      return;
    }
    if (!isValidEmail(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (emailList.includes(trimmed)) {
      setEmailInput("");
      return;
    }
    setEmailList((prev) => [...prev, trimmed]);
    setEmailInput("");
  };

  const handleRemoveEmail = (email: string) => {
    setEmailList((prev) => prev.filter((item) => item !== email));
  };

  const handleClearEmails = () => {
    setEmailList([]);
  };

  const handleInviteMembers = async () => {
    if (hasInvitedMembers) {
      setIsEmailDialogOpen(false);
      if (emailInviteFromAdmin) {
        setTeamDialogOpen(true);
        setTeamDialogStep(3);
      } else {
        await markOnboardingComplete();
      }
      setHasInvitedMembers(false);
      setInviteButtonLabel("Invite");
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!teamId || !userId || emailList.length === 0) {
      return;
    }

    try {
      setIsInvitingMembers(true);
      const response = await inviteTeamMembers(teamId, emailList, userId);
      if (response.ok) {
        toast.success("Invitations set!");
        if (emailInviteFromAdmin) {
          setHasInvitedMembers(true);
          setInviteButtonLabel("Next");
          setEmailList([]);
          setEmailInput("");
        } else {
          setInviteButtonLabel("Done");
          await markOnboardingComplete();
          await new Promise((resolve) => setTimeout(resolve, 400));
          setIsEmailDialogOpen(false);
          setEmailList([]);
          setEmailInput("");
          setInviteButtonLabel("Invite");
        }
      } else {
        toast.error("Failed to send invitations.");
      }
    } catch (error) {
      console.error("Failed to invite members:", error);
      toast.error("Failed to send invitations.");
    } finally {
      setIsInvitingMembers(false);
    }
  };

  const handleCreatorDone = () => {
    setTeamDialogOpen(true);
    setTeamDialogStep(3);
  };

  const handleStartTrial = async () => {
    const user = auth.currentUser;
    if (!teamId || !user || isStartingTrial) {
      return;
    }

    setBillingSuccess(false);
    setIsStartingTrial(true);

    try {
      const response = await fetch("/api/stripe/create_checkout_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          purchase: !isFreeTrialing,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to start trial:", errorText);
        toast.error("Failed to start trial. Please try again.");
        setIsStartingTrial(false);
        return;
      }

      let data: { url?: string } | null = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }

      if (billingStatusUnsubRef.current) {
        billingStatusUnsubRef.current();
      }

      const teamRef = doc(db, "teams", teamId);
      billingStatusUnsubRef.current = onSnapshot(
        teamRef,
        (snap) => {
          const status = snap.data()?.billing?.status;
          if (
            status === "active" ||
            status === "trialing" ||
            status === "booking_confirmed"
          ) {
            if (billingStatusUnsubRef.current) {
              billingStatusUnsubRef.current();
              billingStatusUnsubRef.current = null;
            }
            setBillingSuccess(true);
            setIsStartingTrial(false);
            if (billingSuccessTimeoutRef.current) {
              window.clearTimeout(billingSuccessTimeoutRef.current);
            }
            billingSuccessTimeoutRef.current = window.setTimeout(() => {
              setTeamDialogOpen(false);
              setBillingSuccess(false);
              void markOnboardingComplete();
            }, 800);
          }
        },
        (error) => {
          console.error("Failed to watch billing status:", error);
          toast.error("Failed to confirm billing status.");
          if (billingStatusUnsubRef.current) {
            billingStatusUnsubRef.current();
            billingStatusUnsubRef.current = null;
          }
          setIsStartingTrial(false);
        },
      );
    } catch (error) {
      console.error("Failed to start trial:", error);
      toast.error("Failed to start trial. Please try again.");
      setIsStartingTrial(false);
    }
  };

  const handleGetSetUpAnyway = async () => {
    const user = auth.currentUser;
    if (!teamId || !user || isBookingSetup) {
      return;
    }

    setBookingSuccess(false);
    setIsBookingSetup(true);

    try {
      const response = await fetch("/api/cal/create_appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to start booking:", errorText);
        toast.error("Failed to start booking. Please try again.");
        setIsBookingSetup(false);
        return;
      }

      let data: { cal_url?: string } | null = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (data?.cal_url) {
        window.open(data.cal_url, "_blank", "noopener,noreferrer");
      }

      if (billingStatusUnsubRef.current) {
        billingStatusUnsubRef.current();
      }

      const teamRef = doc(db, "teams", teamId);
      billingStatusUnsubRef.current = onSnapshot(
        teamRef,
        (snap) => {
          const status = snap.data()?.billing?.status;
          if (status === "booking_confirmed") {
            if (billingStatusUnsubRef.current) {
              billingStatusUnsubRef.current();
              billingStatusUnsubRef.current = null;
            }
            setBookingSuccess(true);
            setIsBookingSetup(false);
            if (billingSuccessTimeoutRef.current) {
              window.clearTimeout(billingSuccessTimeoutRef.current);
            }
            billingSuccessTimeoutRef.current = window.setTimeout(() => {
              setTeamDialogOpen(false);
              setBookingSuccess(false);
              void markOnboardingComplete();
            }, 800);
          }
        },
        (error) => {
          console.error("Failed to watch booking status:", error);
          toast.error("Failed to confirm booking status.");
          if (billingStatusUnsubRef.current) {
            billingStatusUnsubRef.current();
            billingStatusUnsubRef.current = null;
          }
          setIsBookingSetup(false);
        },
      );
    } catch (error) {
      console.error("Failed to start booking:", error);
      toast.error("Failed to start booking. Please try again.");
      setIsBookingSetup(false);
    }
  };

  const handleMemberDone = async () => {
    setMemberDialogOpen(false);
    await markOnboardingComplete();
  };

  const handleAgentTypeSelect = (type: string) => {
    setIsMenuOpen(false);

    // Navigate to the corresponding agent creation page with ?new=true query param
    switch (type.toLowerCase()) {
      case "workflow":
        toast.info("Workflow coming soon!");
        break;
      case "source chat":
        router.push("/chatAgent?new=true");
        break;
      case "copilot":
        router.push("/copilotAgent?new=true");
        break;
      default:
        break;
    }
  };

  const handleAgentRowClick = (agent: Agent) => {
    const basePath =
      agent.type === "workflow"
        ? "/workflowAgent"
        : agent.type === "source chat"
          ? "/chatAgent"
          : "/copilotAgent";

    const params = new URLSearchParams({ id: agent.id });
    if (agent.name) {
      params.set("name", agent.name);
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  const handleInfoClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    agent: Agent,
  ) => {
    event.stopPropagation();
    router.push(`/agent-analytics?id=${agent.id}`);
  };

  const handleDeleteAgentConfirm = async () => {
    if (!agentToDelete || isDeletingAgent) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("You must be signed in to delete an agent.");
      return;
    }

    setIsDeletingAgent(true);
    try {
      const response = await fetch("/api/agent/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentToDelete.id,
        }),
      });

      let data: { status?: string; reason?: string } | null = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok || data?.status === "failure") {
        const reason = data?.reason?.trim();
        const message =
          reason && reason.toLowerCase().includes("permission error")
            ? "You don't have permission to delete this agent."
            : reason || `Failed to delete ${agentToDelete.name || "agent"}.`;
        toast.error(message);
        return;
      }

      setAgents((prev) =>
        prev.filter((agent) => agent.id !== agentToDelete.id),
      );
      setDeleteAgentDialogOpen(false);
      setAgentToDelete(null);
      toast.success("Agent deleted.");
    } catch (error) {
      console.error("Failed to delete agent:", error);
      toast.error("Something went wrong deleting the agent.");
    } finally {
      setIsDeletingAgent(false);
    }
  };

  return (
    <div className="space-y-4 relative pb-20">
      <AlertDialog
        open={teamDialogOpen}
        onOpenChange={handleTeamDialogOpenChange}
      >
        <AlertDialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            {teamDialogStep === 1 ? (
              <>
                <AlertDialogTitle className="text-2xl font-bold">
                  Welcome to Solari{firstName ? ` ${firstName}` : ""}!
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-semibold text-foreground">
                  Before getting you and your team up and running, lets get to
                  know each other first.
                </AlertDialogDescription>
                <AlertDialogDescription>
                  To start of - what would you like to name your team?
                </AlertDialogDescription>
              </>
            ) : teamDialogStep === 2 ? (
              <>
                <AlertDialogTitle className="text-2xl font-bold">
                  Welcome to Solari{firstName ? ` ${firstName}` : ""}!
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-semibold text-foreground">
                  Great! now would you like to invite any team members to this
                  space?
                </AlertDialogDescription>
                <AlertDialogDescription>
                  here’s a 6 digit code you can send them to let them join this
                  space. (Don’t worry you can always find this in settings).
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle className="text-2xl font-bold">
                  🎉 {paymentTeamLabel} is ready to go
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-semibold text-foreground">
                  You’re all set. Before you dive in, choose how you’d like to
                  get started with Solari.
                </AlertDialogDescription>
              </>
            )}
          </AlertDialogHeader>
          <div
            className={`flex-1 overflow-y-auto space-y-4 pr-1 ${
              teamDialogStep === 3 ? "pt-2" : ""
            }`}
          >
            {teamDialogStep === 1 && (
              <div className="space-y-3">
                <Input
                  placeholder="Enter your teams name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                />
              </div>
            )}
            {teamDialogStep === 2 && (
              <div className="flex items-center justify-center gap-4 rounded-md border border-border px-4 py-3">
                <InputOTP maxLength={6} value={inviteCode} disabled>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyInviteCode}
                  disabled={!formattedInviteCode || isLoadingInviteCode}
                  aria-label="Copy invite code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            {teamDialogStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Badge className="bg-emerald-500 text-emerald-950 hover:bg-emerald-500">
                    20% discount
                  </Badge>
                  <Switch
                    checked={isFreeTrialing}
                    onCheckedChange={setisFreeTrialing}
                  />
                  <span>7 day free trial</span>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleStartTrial}
                  disabled={isStartingTrial || billingSuccess}
                >
                  {billingSuccess ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                      <span className="text-emerald-500">Success!</span>
                    </>
                  ) : isStartingTrial ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Waiting for confirmation...
                    </>
                  ) : isFreeTrialing ? (
                    "Start your 7 day free trial"
                  ) : (
                    "Start subscription"
                  )}
                </Button>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground text-center">
                  <Lock className="h-4 w-4" />
                  <span>Full access to Solari. No charge today.</span>
                </div>
                {showPaymentAlternative && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="text-sm text-muted-foreground text-center">
                      Don’t have access to a card?{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="px-1"
                        onClick={handleGetSetUpAnyway}
                        disabled={isBookingSetup || bookingSuccess}
                      >
                        {bookingSuccess ? (
                          <span className="inline-flex items-center text-emerald-500">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Success!
                          </span>
                        ) : isBookingSetup ? (
                          <span className="inline-flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Opening...
                          </span>
                        ) : (
                          "Get set up anyway"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {teamDialogStep !== 3 && (
            <AlertDialogFooter
              className={`${teamDialogStep === 2 ? "sm:justify-between" : ""} pt-4 mt-auto`}
            >
              {teamDialogStep === 2 ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleInviteByEmail}
                    className="justify-start border border-white"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    or - invite them by email
                  </Button>
                  <Button type="button" onClick={handleCreatorDone}>
                    Next
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleTeamNameNext}
                  disabled={!teamName.trim() || isSavingTeamName}
                >
                  {isSavingTeamName ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              )}
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteAgentDialogOpen}
        onOpenChange={(open) => {
          setDeleteAgentDialogOpen(open);
          if (!open) {
            setAgentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAgentLabel}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteAgentDialogOpen(false);
                setAgentToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgentConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingAgent}
            >
              {isDeletingAgent ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* TODO - edit this to make it  for members - non-creator agents (only invite agents). */}
      <AlertDialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <AlertDialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold">
              Welcome to {memberTeamLabel}'s Solari team{" "}
              {firstName ? ` ${firstName}` : ""}!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-semibold text-foreground">
              {memberCreatorName} invited you to this space. Need to invite
              others?
            </AlertDialogDescription>
            <AlertDialogDescription>
              Here’s a 6 digit code you can send them to let them join this team
              as well.
            </AlertDialogDescription>
            <AlertDialogDescription>
              <span className="italic">
                (Don't worry about losing this code, you can always find it in
                settings)
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex items-center justify-center gap-4 rounded-md border border-border px-4 py-3">
              <InputOTP maxLength={6} value={inviteCode} disabled>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSeparator />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopyInviteCode}
                disabled={!formattedInviteCode || isLoadingInviteCode}
                aria-label="Copy invite code"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <AlertDialogFooter className="sm:justify-between pt-4 mt-auto">
            <Button
              variant="ghost"
              onClick={handleInviteByEmail}
              className="justify-start border border-white"
            >
              <Mail className="mr-2 h-4 w-4" />
              or - invite them by email
            </Button>
            <AlertDialogAction onClick={handleMemberDone}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <AlertDialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold">
              Invite team members
            </AlertDialogTitle>
            <AlertDialogDescription>
              Add email addresses to invite your teammates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter email address"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddEmail();
                  }
                }}
              />
              <Button type="button" onClick={handleAddEmail}>
                Add
              </Button>
            </div>
            {emailList.length > 0 ? (
              <div className="flex flex-col gap-2">
                {emailList.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEmail(email)}
                      aria-label={`Remove ${email}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No email addresses added yet.
              </div>
            )}
          </div>
          <AlertDialogFooter className="sm:justify-between pt-4 mt-auto">
            <Button variant="outline" onClick={handleClearEmails}>
              Clear
            </Button>
            <Button
              onClick={handleInviteMembers}
              disabled={
                (!hasInvitedMembers && emailList.length === 0) ||
                isInvitingMembers
              }
            >
              {isInvitingMembers ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inviting
                </>
              ) : (
                inviteButtonLabel
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Top two boxes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Your Tasks Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Tasks</h2>
          <div className="rounded-lg border bg-card p-6">
            {dummyTasks.hasPendingTasks ? (
              <p className="text-sm text-muted-foreground">
                You have pending tasks
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  No pending tasks
                </p>
                <Link
                  href="#"
                  className="text-sm text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
                >
                  What are agent tasks? →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Upcoming agent runs Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Upcoming agent runs</h2>
          <div className="rounded-lg border bg-card p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Agent name
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Next run
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dummyAgentRuns.length > 0 ? (
                    dummyAgentRuns.map((run) => (
                      <tr key={run.id} className="border-b last:border-b-0">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{run.agentName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">{run.nextRun}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-4 px-4 text-center text-sm text-muted-foreground"
                      >
                        No upcoming runs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Agents table section - full width */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Agents</h2>
        <div className="rounded-lg border bg-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Analytics
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Settings
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAgents ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-4 text-center text-sm text-muted-foreground"
                    >
                      Loading agents...
                    </td>
                  </tr>
                ) : agents.length > 0 ? (
                  agents.map((agent) => (
                    <tr
                      key={agent.id}
                      onClick={() => handleAgentRowClick(agent)}
                      className="border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          {getAgentTypeIcon(agent.type)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {agent.name || `${agent.type} agent`}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(event) => handleInfoClick(event, agent)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`View analytics for ${
                            agent.name || agent.type
                          }`}
                        >
                          <IoAnalyticsOutline className="h-5 w-5" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Open ${agent.name || agent.type} options`}
                            >
                              <VscSettings className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setAgentToDelete(agent);
                                setDeleteAgentDialogOpen(true);
                              }}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setAgentToDelete(agent);
                                setDeleteAgentDialogOpen(true);
                              }}
                              disabled={isDeletingAgent}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-4 text-center text-sm text-muted-foreground"
                    >
                      No agents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="rounded-lg px-6 h-14 shadow-lg hover:shadow-xl transition-shadow gap-2 bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-5 w-5" />
              <span>Add new agent</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => handleAgentTypeSelect("workflow")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <GoWorkflow className="h-4 w-4" />
              <span>Workflow</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAgentTypeSelect("source chat")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <MdChatBubble className="h-4 w-4" />
              <span>Source Chat</span>
            </DropdownMenuItem>
            {/* <DropdownMenuItem
              onClick={() => handleAgentTypeSelect("copilot")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <FaHandsHelping className="h-4 w-4" />
              <span>Copilot</span>
            </DropdownMenuItem> */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
