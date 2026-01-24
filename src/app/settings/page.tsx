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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function SettingsPage() {
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
          if (teamId) {
            setIsLoadingInviteCode(true);
            const teamRef = doc(db, "teams", teamId);
            const teamSnap = await getDoc(teamRef);
            if (teamSnap.exists()) {
              const teamData = teamSnap.data();
              setHasJiraAccessToken(!!teamData.jira_access_token);
              setInviteCode((teamData.invite_code as string) || null);
            } else {
              setInviteCode(null);
              setHasJiraAccessToken(false);
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
      await signOut();
      // Redirect will be handled by AuthWrapper automatically
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
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
      router.push("/settings/jira_callback");
      return;
    }

    window.location.href = `/api/jira/connect?uid=${encodeURIComponent(
      user.uid
    )}`;
  };

  const handleSlackCallback = () => {
    router.push("/settings/slack_callback");
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
          <h3 className="text-lg font-semibold mb-2">Account</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your account settings and sign out.
          </p>
          <Button
            onClick={handleSignOut}
            disabled={isSigningOut}
            variant="outline"
          >
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
