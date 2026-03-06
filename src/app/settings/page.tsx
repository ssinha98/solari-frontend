"use client";

import { useState, useEffect } from "react";
import { signOut } from "@/tools/auth_tools";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { auth, db } from "@/tools/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import Image from "next/image";
import { Copy, Loader2, Eye, EyeClosed } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

export default function SettingsPage() {
  const posthog = usePostHog();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasJiraAccessToken, setHasJiraAccessToken] = useState<boolean | null>(
    null
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSlackInstallation, setHasSlackInstallation] = useState<
    boolean | null
  >(null);
  const [isConnectingSlack, setIsConnectingSlack] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isLoadingInviteCode, setIsLoadingInviteCode] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [profile, setProfile] = useState<{
    photoURL?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null>(null);
  const [pipedriveMasked, setPipedriveMasked] = useState<string | null>(null);
  const [apolloMasked, setApolloMasked] = useState<string | null>(null);
  const [pipedriveAddOpen, setPipedriveAddOpen] = useState(false);
  const [apolloAddOpen, setApolloAddOpen] = useState(false);
  const [pipedriveDeleteOpen, setPipedriveDeleteOpen] = useState(false);
  const [apolloDeleteOpen, setApolloDeleteOpen] = useState(false);
  const [pipedriveApiKeyInput, setPipedriveApiKeyInput] = useState("");
  const [apolloApiKeyInput, setApolloApiKeyInput] = useState("");
  const [isSavingPipedrive, setIsSavingPipedrive] = useState(false);
  const [isSavingApollo, setIsSavingApollo] = useState(false);
  const [isDeletingPipedrive, setIsDeletingPipedrive] = useState(false);
  const [isDeletingApollo, setIsDeletingApollo] = useState(false);
  const [showPipedriveKey, setShowPipedriveKey] = useState(false);
  const [showApolloKey, setShowApolloKey] = useState(false);
  const router = useRouter();

  const maskApiKey = (key: string): string => {
    if (!key || key.length < 4) return "•••";
    return `${key[0]}...${key.slice(-2)}`;
  };

  useEffect(() => {
    const checkAccessTokens = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          return;
        }

        // Check Jira access token
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        let teamId: string | undefined;

        if (userSnap.exists()) {
          const userData = userSnap.data();
          teamId = userData.teamId as string | undefined;
          setTeamId(teamId ?? null);
          setProfile({
            photoURL:
              (userData.photoURL as string | undefined) ??
              user.photoURL ??
              null,
            displayName:
              (userData.displayName as string | undefined) ??
              user.displayName ??
              null,
            email: (userData.email as string | undefined) ?? user.email ?? null,
          });
          if (teamId) {
            setIsLoadingInviteCode(true);
            const teamRef = doc(db, "teams", teamId);
            const teamSnap = await getDoc(teamRef);
            if (teamSnap.exists()) {
              const teamData = teamSnap.data();
              setHasJiraAccessToken(!!teamData.jira_access_token);
              setInviteCode((teamData.invite_code as string) || null);
              setTeamName(
                typeof teamData.team_name === "string" ? teamData.team_name : "",
              );
              setPipedriveMasked(
                (teamData.pipedrive_api_key_masked as string) || null,
              );
              setApolloMasked(
                (teamData.apollo_api_key_masked as string) || null,
              );
            } else {
              setInviteCode(null);
              setHasJiraAccessToken(false);
              setTeamName("");
              setPipedriveMasked(null);
              setApolloMasked(null);
            }
            setIsLoadingInviteCode(false);
            const memberSnap = await getDoc(doc(db, "teams", teamId, "users", user.uid));
            if (memberSnap.exists()) {
              setIsAdmin(memberSnap.data().role === "admin");
            } else {
              setIsAdmin(false);
            }
          } else {
            setHasJiraAccessToken(false);
            setInviteCode(null);
            setIsAdmin(false);
            setTeamId(null);
            setPipedriveMasked(null);
            setApolloMasked(null);
          }
        } else {
          setHasJiraAccessToken(false);
          setInviteCode(null);
          setIsAdmin(false);
          setTeamId(null);
          setProfile({
            photoURL: user.photoURL ?? null,
            displayName: user.displayName ?? null,
            email: user.email ?? null,
          });
        }

        if (teamId) {
          // Check Slack installation by querying slack_installations subcollection
          const slackInstallationsRef = collection(
            db,
            "teams",
            teamId,
            "users",
            user.uid,
            "slack_installations"
          );
          const slackInstallationsSnapshot = await getDocs(slackInstallationsRef);

          let hasBotToken = false;
          slackInstallationsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.slack_bot_token || data.bot_token) {
              hasBotToken = true;
            }
          });

          setHasSlackInstallation(hasBotToken);
        } else {
          setHasSlackInstallation(false);
        }

      } catch (error) {
        console.error("Error checking access tokens:", error);
        setHasJiraAccessToken(false);
        setHasSlackInstallation(false);
        setInviteCode(null);
        setIsAdmin(false);
        setIsLoadingInviteCode(false);
        setPipedriveMasked(null);
        setApolloMasked(null);
      }
    };

    checkAccessTokens();
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      posthog?.capture("settings:sign out", getPosthogAuthProps());
      await signOut();
      // Redirect will be handled by AuthWrapper automatically
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
  };

  const getPosthogAuthProps = () => {
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
    return eventProps;
  };

  const handleJiraCallback = () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    if (!teamId) {
      toast.error("Team ID is required");
      return;
    }

    if (hasJiraAccessToken) {
      posthog?.capture("settings: configure_atlassian", getPosthogAuthProps());
      router.push("/settings/jira_callback");
      return;
    }

    posthog?.capture("settings: atlassian_started", getPosthogAuthProps());
    window.open(
      `/api/jira/connect?uid=${encodeURIComponent(user.uid)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleSlackCallback = async () => {
    if (hasSlackInstallation) {
      posthog?.capture("settings: configure_slack", getPosthogAuthProps());
      router.push("/settings/slack_callback");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    try {
      posthog?.capture("settings:slack_started", getPosthogAuthProps());
      setIsConnectingSlack(true);
      const response = await fetch("/api/slack/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: user.uid }),
        redirect: "follow",
      });

      if (response.redirected) {
        window.open(response.url, "_blank", "noopener,noreferrer");
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to start Slack auth.");
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const authorizeUrl =
          data?.authorize_url || data?.url || data?.redirect_url;
        if (authorizeUrl) {
          window.open(authorizeUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }

      toast.error("Failed to start Slack auth.");
    } catch (error) {
      console.error("Failed to start Slack auth:", error);
      toast.error("Failed to start Slack auth.");
    } finally {
      setIsConnectingSlack(false);
    }
  };

  const formattedInviteCode =
    inviteCode && inviteCode.length === 6
      ? `${inviteCode.slice(0, 3)}-${inviteCode.slice(3)}`
      : null;

  const handleCopyInviteCode = async () => {
    try {
      if (!formattedInviteCode) {
        toast.error("Invite code is not available.");
        return;
      }
      await navigator.clipboard.writeText(formattedInviteCode);
      toast.success("Invite code copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy invite code:", error);
      toast.error("Failed to copy invite code.");
    }
  };

  const handleManageBilling = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("User must be authenticated");
        return;
      }

      posthog?.capture("settings: manage billing", getPosthogAuthProps());
      const payload = {
        user_id: user.uid,
      };

      console.log("Manage billing payload:", payload);

      setIsBillingLoading(true);
      const response = await fetch(
        "/api/stripe/manage_billing",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create billing portal session");
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Billing portal URL missing");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      toast.error("Failed to open billing portal.");
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleAddPipedriveKey = async () => {
    const user = auth.currentUser;
    const key = pipedriveApiKeyInput.trim();
    if (!key || !user) {
      toast.error("API key required");
      return;
    }
    try {
      setIsSavingPipedrive(true);
      const res = await fetch("/api/pipedrive/api_key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid, api_key: key }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to save API key");
      }
      const data = (await res.json()) as { masked_key?: string };
      setPipedriveMasked(data.masked_key ?? maskApiKey(key));
      setPipedriveApiKeyInput("");
      setPipedriveAddOpen(false);
      toast.success("Pipedrive API key saved");
    } catch (error) {
      console.error("Failed to save Pipedrive API key:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save API key"
      );
    } finally {
      setIsSavingPipedrive(false);
    }
  };

  const handleDeletePipedriveKey = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setIsDeletingPipedrive(true);
      const res = await fetch("/api/pipedrive/api_key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to remove API key");
      }
      setPipedriveMasked(null);
      setPipedriveDeleteOpen(false);
      toast.success("Pipedrive API key removed");
    } catch (error) {
      console.error("Failed to remove Pipedrive API key:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove API key"
      );
    } finally {
      setIsDeletingPipedrive(false);
    }
  };

  const handleAddApolloKey = async () => {
    const user = auth.currentUser;
    const key = apolloApiKeyInput.trim();
    if (!key || !user) {
      toast.error("API key required");
      return;
    }
    try {
      setIsSavingApollo(true);
      const res = await fetch("/api/apollo/api_key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid, api_key: key }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to save API key");
      }
      const data = (await res.json()) as { masked_key?: string };
      setApolloMasked(data.masked_key ?? maskApiKey(key));
      setApolloApiKeyInput("");
      setApolloAddOpen(false);
      toast.success("Apollo API key saved");
    } catch (error) {
      console.error("Failed to save Apollo API key:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save API key"
      );
    } finally {
      setIsSavingApollo(false);
    }
  };

  const handleDeleteApolloKey = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setIsDeletingApollo(true);
      const res = await fetch("/api/apollo/api_key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to remove API key");
      }
      setApolloMasked(null);
      setApolloDeleteOpen(false);
      toast.success("Apollo API key removed");
    } catch (error) {
      console.error("Failed to remove Apollo API key:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove API key"
      );
    } finally {
      setIsDeletingApollo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">
            Manage members and permissions
          </h3>
          <p className="text-sm text-muted-foreground">
            Share this invite code to add teammates to your workspace.
          </p>
        </div>
        {isLoadingInviteCode ? (
          <div className="flex items-center justify-center rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : formattedInviteCode ? (
          <div className="flex items-center justify-center gap-4 rounded-md border border-border px-4 py-3">
            <InputOTP maxLength={6} value={inviteCode ?? ""} disabled>
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
              aria-label="Copy invite code"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground font-mono">
            no invite code
          </div>
        )}
      </div>
      <div>
        <p className="text-muted-foreground">
          Configure your application settings.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Integrations</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect and manage your third-party integrations.
          </p>

          {!isAdmin ? (
            <p className="text-sm text-muted-foreground py-4">
              Only team admins can manage integrations.
            </p>
          ) : (
            <>
          {/* Atlassian Connection Card */}
            <div
              className="rounded-lg border bg-card p-4 mb-4 cursor-pointer hover:bg-accent transition-colors"
              role="button"
              tabIndex={0}
              onClick={handleJiraCallback}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleJiraCallback();
                }
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center">
                    <Image
                      src="https://img.icons8.com/?size=100&id=RduYmqw5H7xm&format=png&color=000000"
                      alt="Atlassian"
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                  </div>
                  <div>
                    <h4 className="text-base font-medium mb-1">
                      Atlassian connection
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {hasJiraAccessToken === null
                        ? "Checking connection status..."
                        : hasJiraAccessToken
                          ? "Connected"
                          : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button onClick={handleJiraCallback} variant="outline">
                  {hasJiraAccessToken === null
                    ? "Loading..."
                    : hasJiraAccessToken
                      ? "Configure Atlassian"
                      : "Log into Jira and Confluence"}
                </Button>
              </div>
            </div>

          {/* Slack Connection Card */}
          <div
            className="rounded-lg border bg-card p-4 cursor-pointer hover:bg-accent transition-colors"
            role="button"
            tabIndex={0}
            onClick={handleSlackCallback}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSlackCallback();
              }
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center">
                  <Image
                    src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
                    alt="Slack"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                  />
                </div>
                <div>
                  <h4 className="text-base font-medium mb-1">
                    Slack connection
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {hasSlackInstallation === null
                      ? "Checking connection status..."
                      : hasSlackInstallation
                        ? "Connected"
                        : "Not connected"}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSlackCallback}
                variant="outline"
                disabled={isConnectingSlack}
              >
                {isConnectingSlack
                  ? "Connecting..."
                  : hasSlackInstallation === null
                    ? "Loading..."
                    : hasSlackInstallation
                      ? "Configure Slack"
                      : "Log into Slack"}
              </Button>
            </div>
          </div>

          {/* Pipedrive API Key Card */}
          <div className="rounded-lg border bg-card p-4 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center overflow-hidden bg-muted">
                  <Image
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMiaXM3Qt8jYH_v3BxmqK7HNwEeADjKmVI6w&s"
                    alt="Pipedrive"
                    width={40}
                    height={40}
                    className="h-10 w-10 object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-base font-medium mb-1">Pipedrive</h4>
                  <p className="text-sm text-muted-foreground">
                    {pipedriveMasked ? (
                      <span className="font-mono">{pipedriveMasked}</span>
                    ) : (
                      "No API key"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {pipedriveMasked ? (
                  <>
                    <Button
                      onClick={() => setPipedriveDeleteOpen(true)}
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingPipedrive}
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setPipedriveAddOpen(true)}
                    variant="outline"
                    size="sm"
                    disabled={isSavingPipedrive}
                  >
                    Add API Key
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Apollo API Key Card */}
          <div className="rounded-lg border bg-card p-4 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center overflow-hidden bg-muted">
                  <Image
                    src="https://www.apollo.io/icon.svg?c17bbe217833d406"
                    alt="Apollo"
                    width={40}
                    height={40}
                    className="h-10 w-10 object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-base font-medium mb-1">Apollo</h4>
                  <p className="text-sm text-muted-foreground">
                    {apolloMasked ? (
                      <span className="font-mono">{apolloMasked}</span>
                    ) : (
                      "No API key"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {apolloMasked ? (
                  <Button
                    onClick={() => setApolloDeleteOpen(true)}
                    variant="destructive"
                    size="sm"
                    disabled={isDeletingApollo}
                  >
                    Delete
                  </Button>
                ) : (
                  <Button
                    onClick={() => setApolloAddOpen(true)}
                    variant="outline"
                    size="sm"
                    disabled={isSavingApollo}
                  >
                    Add API Key
                  </Button>
                )}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-2">Billing</h3>
          <p className="text-sm text-muted-foreground">
            Manage your billing settings and payment details.
          </p>
          <div className="mt-4">
            <Button
              onClick={handleManageBilling}
              variant="outline"
              disabled={isBillingLoading}
            >
              {isBillingLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2">Loading...</span>
                </>
              ) : (
                "Manage billing"
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-2">Account</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-muted">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName ?? "User avatar"}
                className="h-12 w-12 object-cover"
                width={48}
                height={48}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-12 w-12 flex items-center justify-center text-sm text-muted-foreground">
                {profile?.displayName?.[0] ?? "U"}
              </div>
            )}
          </div>
          <div>
            <div className="text-base font-medium">
              {profile?.displayName ?? "Unknown user"}
            </div>
            <div className="text-sm text-muted-foreground">
              {profile?.email ?? "No email"}
            </div>
          </div>
        </div>
        <Button
          onClick={handleSignOut}
          disabled={isSigningOut}
          variant="outline"
        >
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </Button>
      </div>

      {/* Pipedrive Add API Key Dialog */}
      <Dialog
        open={pipedriveAddOpen}
        onOpenChange={(open) => {
          setPipedriveAddOpen(open);
          if (!open) setShowPipedriveKey(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Pipedrive API Key</DialogTitle>
            <DialogDescription>
              Enter your Pipedrive API key. It will be stored securely and never
              shown in full again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="pipedrive-key" className="text-sm font-medium">
                API Key
              </label>
              <div className="relative">
                <Input
                  id="pipedrive-key"
                  type={showPipedriveKey ? "text" : "password"}
                  placeholder="Enter your Pipedrive API key"
                  value={pipedriveApiKeyInput}
                  onChange={(e) => setPipedriveApiKeyInput(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPipedriveKey((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPipedriveKey ? "Hide API key" : "Show API key"}
                >
                  {showPipedriveKey ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeClosed className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPipedriveAddOpen(false)}
              disabled={isSavingPipedrive}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPipedriveKey}
              disabled={!pipedriveApiKeyInput.trim() || isSavingPipedrive}
            >
              {isSavingPipedrive ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apollo Add API Key Dialog */}
      <Dialog
        open={apolloAddOpen}
        onOpenChange={(open) => {
          setApolloAddOpen(open);
          if (!open) setShowApolloKey(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Apollo API Key</DialogTitle>
            <DialogDescription>
              Enter your Apollo API key. It will be stored securely and never
              shown in full again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="apollo-key" className="text-sm font-medium">
                API Key
              </label>
              <div className="relative">
                <Input
                  id="apollo-key"
                  type={showApolloKey ? "text" : "password"}
                  placeholder="Enter your Apollo API key"
                  value={apolloApiKeyInput}
                  onChange={(e) => setApolloApiKeyInput(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApolloKey((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showApolloKey ? "Hide API key" : "Show API key"}
                >
                  {showApolloKey ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeClosed className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApolloAddOpen(false)}
              disabled={isSavingApollo}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddApolloKey}
              disabled={!apolloApiKeyInput.trim() || isSavingApollo}
            >
              {isSavingApollo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipedrive Delete Confirmation */}
      <AlertDialog open={pipedriveDeleteOpen} onOpenChange={setPipedriveDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pipedrive API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your Pipedrive API key? You will
              need to add it again to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPipedrive}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeletePipedriveKey();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingPipedrive}
            >
              {isDeletingPipedrive ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apollo Delete Confirmation */}
      <AlertDialog open={apolloDeleteOpen} onOpenChange={setApolloDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Apollo API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your Apollo API key? You will need
              to add it again to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingApollo}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteApolloKey();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingApollo}
            >
              {isDeletingApollo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
