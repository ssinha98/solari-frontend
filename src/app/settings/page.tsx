"use client";

import { useState, useEffect } from "react";
import { signOut } from "@/tools/auth_tools";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { auth, db } from "@/tools/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import Image from "next/image";
import { Copy, Loader2 } from "lucide-react";
import { getBackendUrl } from "@/tools/backend-config";
import { usePostHog } from "posthog-js/react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

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
  const router = useRouter();

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
            } else {
              setInviteCode(null);
              setHasJiraAccessToken(false);
              setTeamName("");
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

          {/* Atlassian Connection Card */}
          {isAdmin && (
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
          )}

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
    </div>
  );
}
