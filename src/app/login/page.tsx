"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/tools/firebase";
import {
  createOrUpdateUserDocument,
  getUserDocument,
  signOut,
} from "@/tools/auth_tools";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { joinTeamInviteCode } from "@/tools/api";
import { Loader2 } from "lucide-react";
import { MdCheckCircle, MdError } from "react-icons/md";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<
    "join" | "create" | null
  >(null);
  const [inviteCode, setInviteCode] = useState("");
  const [isValidatingInviteCode, setIsValidatingInviteCode] = useState(false);
  const [inviteCodeStatus, setInviteCodeStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const searchParams = useSearchParams();

  useEffect(() => {
    const inviteParam = searchParams.get("invite");
    if (!inviteParam) {
      return;
    }
    const normalizedInvite = inviteParam.replace(/\D/g, "").slice(0, 6);
    setSelectedOption("join");
    setInviteCode(normalizedInvite);
  }, [searchParams]);

  useEffect(() => {
    if (selectedOption !== "join") {
      setInviteCodeStatus("idle");
      return;
    }

    const trimmed = inviteCode.trim();
    if (trimmed.length !== 6) {
      setInviteCodeStatus("idle");
      setIsValidatingInviteCode(false);
      return;
    }

    setIsValidatingInviteCode(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await joinTeamInviteCode(trimmed);
        setInviteCodeStatus(response.ok ? "valid" : "invalid");
      } catch (error) {
        console.error("Error validating invite code:", error);
        setInviteCodeStatus("invalid");
      } finally {
        setIsValidatingInviteCode(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inviteCode, selectedOption]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const userSnap = await getUserDocument(result.user.uid);
      const isExistingUser = userSnap.exists();

      if (!isExistingUser) {
        if (!selectedOption) {
          toast.error("Please select a team option before signing in.");
          await signOut();
          setIsLoading(false);
          return;
        }
        if (selectedOption === "join" && !inviteCode.trim()) {
          toast.error("Please enter an invite code to join a team.");
          await signOut();
          setIsLoading(false);
          return;
        }
        if (selectedOption === "join" && inviteCodeStatus !== "valid") {
          toast.error("Please enter a valid invite code to join a team.");
          await signOut();
          setIsLoading(false);
          return;
        }
      }
      // Create or update user document in Firestore
      const createdTeamId = await createOrUpdateUserDocument(
        result.user,
        isExistingUser ? undefined : (selectedOption ?? undefined),
        inviteCode.trim()
      );
      if (createdTeamId) {
        sessionStorage.setItem("createdTeamId", createdTeamId);
      }
      // Redirect will be handled by AuthWrapper automatically
    } catch (error) {
      if (
        selectedOption === "join" &&
        error instanceof Error &&
        error.message === "Invalid invite code."
      ) {
        toast.error("Oops! Couldn't find a team with that code. Please try again.");
      } else {
        console.error("Error signing in with Google:", error);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col md:flex-row">
        <div className="order-1 flex w-full items-center justify-center p-8 md:order-2 md:w-1/2">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold">Welcome to Solari</h1>
              <p className="text-muted-foreground">
                Sign in to continue to your dashboard
              </p>
            </div>
            <div className="space-y-4">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? "Signing in..." : "Sign in with Google"}
              </Button>
            </div>
          </div>
        </div>
        <div className="order-2 flex w-full items-center justify-center p-8 md:order-1 md:w-1/2">
          <div className="w-full max-w-md space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedOption("join")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedOption("join");
                }
              }}
              className={`w-full rounded-lg border p-6 text-left transition-colors ${
                selectedOption === "join" ? "border-blue-500" : "border-border"
              }`}
            >
              <div className="text-lg font-semibold">Join an existing team</div>
              {selectedOption === "join" && (
                <>
                  <div className="text-m">
                    Enter your team's 6 digit invite code
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      <InputOTP
                        maxLength={6}
                        value={inviteCode}
                        onChange={setInviteCode}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                      {isValidatingInviteCode ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : inviteCodeStatus === "valid" ? (
                        <MdCheckCircle className="h-5 w-5 text-green-500" />
                      ) : inviteCodeStatus === "invalid" ? (
                        <MdError className="h-5 w-5 text-red-500" />
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedOption("create")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedOption("create");
                }
              }}
              className={`w-full rounded-lg border p-6 text-left transition-colors ${
                selectedOption === "create"
                  ? "border-blue-500"
                  : "border-border"
              }`}
            >
              <div className="text-lg font-semibold">Create a new team</div>
              {selectedOption === "create" && (
                <div className="text-m">
                  Create a brand new Solari team, and invite your team members
                  to it
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
