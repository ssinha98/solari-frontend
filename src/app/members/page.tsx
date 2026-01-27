"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Copy, Loader2, Mail, Pencil, Plus, X } from "lucide-react";
import { auth, db } from "@/tools/firebase";
import {
  addAgentMembers,
  getCreatorFirstName,
  inviteTeamMembers,
  listTeamMembers,
  removeAgentMember,
  updateTeamMemberRole,
} from "@/tools/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";

type Agent = {
  agent_id: string;
  agent_name?: string;
  role?: "edit" | "view" | "admin";
};

type Member = {
  uid: string;
  displayName?: string;
  email?: string;
  role?: "admin" | "member";
  agents?: Agent[];
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<
    "admin" | "member" | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    agentId: string;
    agentName: string;
    memberId: string;
    memberDisplayName: string;
  } | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isLoadingInviteCode, setIsLoadingInviteCode] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [isInvitingMembers, setIsInvitingMembers] = useState(false);
  const [inviteButtonLabel, setInviteButtonLabel] = useState("Invite");
  const [teamNameForInvite, setTeamNameForInvite] = useState<string | null>(
    null,
  );
  const [creatorFirstName, setCreatorFirstName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        setMembers([]);
        setTeamId(null);
        setCurrentUserId(null);
        setCurrentUserRole(null);
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.uid);

      try {
        setIsLoading(true);
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;

        if (!nextTeamId) {
          setMembers([]);
          setTeamId(null);
          setCurrentUserRole(null);
          setIsLoading(false);
          return;
        }

        setTeamId(nextTeamId);

        const response = await listTeamMembers(nextTeamId, user.uid);
        if (!response.ok) {
          toast.error("Failed to load members.");
          setMembers([]);
          setCurrentUserRole(null);
        } else {
          setMembers(response.members);
        }
      } catch (error) {
        console.error("Failed to load members:", error);
        toast.error("Failed to load members.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUserRole = async () => {
      if (!teamId || !currentUserId) {
        setCurrentUserRole(null);
        return;
      }

      try {
        const roleSnap = await getDoc(
          doc(db, "teams", teamId, "users", currentUserId),
        );
        const nextRole = roleSnap.exists()
          ? (roleSnap.data().role as "admin" | "member" | undefined)
          : undefined;
        if (isMounted) {
          setCurrentUserRole(nextRole ?? null);
        }
      } catch (error) {
        console.error("Failed to load current user role:", error);
        if (isMounted) {
          setCurrentUserRole(null);
        }
      }
    };

    loadCurrentUserRole();

    return () => {
      isMounted = false;
    };
  }, [teamId, currentUserId]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const name = (member.displayName ?? "").toLowerCase();
      const email = (member.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [members, searchQuery]);
  const isAdmin = currentUserRole === "admin";
  const displayName = auth.currentUser?.displayName?.trim();
  const firstName = displayName ? displayName.split(" ")[0] : null;
  const memberTeamLabel = teamNameForInvite || "your";
  const memberCreatorName = creatorFirstName ?? "your team admin";
  const formattedInviteCode =
    inviteCode.length === 6
      ? `${inviteCode.slice(0, 3)}-${inviteCode.slice(3)}`
      : "";

  const handleRoleChange = async (
    memberId: string,
    nextRole: "admin" | "member",
  ) => {
    if (currentUserRole !== "admin") {
      toast.error("you dont have permission to make changes");
      return;
    }
    if (!teamId) {
      return;
    }

    const previousRole =
      members.find((member) => member.uid === memberId)?.role ?? "member";

    setMembers((prev) =>
      prev.map((member) =>
        member.uid === memberId ? { ...member, role: nextRole } : member,
      ),
    );

    try {
      const response = await updateTeamMemberRole(teamId, memberId, nextRole);
      if (!response.ok) {
        throw new Error("Role update failed.");
      }
      toast.success("permission updated!");
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error("Failed to update role.");
      setMembers((prev) =>
        prev.map((member) =>
          member.uid === memberId ? { ...member, role: previousRole } : member,
        ),
      );
    }
  };

  const handleAgentRoleChange = async (
    agentId: string,
    nextRole: "edit" | "view" | "admin",
  ) => {
    if (!isAdmin) {
      toast.error("you dont have permission to make changes");
      return;
    }
    if (!teamId || !selectedMember) return;

    const memberEmail = selectedMember.email;
    if (!memberEmail) {
      toast.error("Member email missing.");
      return;
    }

    const previousRole =
      selectedMember.agents?.find((agent) => agent.agent_id === agentId)
        ?.role ?? "view";
    const agentName =
      selectedMember.agents?.find((agent) => agent.agent_id === agentId)
        ?.agent_name ?? "";

    const updateLocalRole = (role: "edit" | "view" | "admin") => {
      setMembers((prev) =>
        prev.map((member) =>
          member.uid === selectedMember.uid
            ? {
                ...member,
                agents: member.agents?.map((agent) =>
                  agent.agent_id === agentId ? { ...agent, role } : agent,
                ),
              }
            : member,
        ),
      );

      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              agents: prev.agents?.map((agent) =>
                agent.agent_id === agentId ? { ...agent, role } : agent,
              ),
            }
          : prev,
      );
    };

    updateLocalRole(nextRole);

    try {
      await addAgentMembers(teamId, agentId, agentName, [
        { email: memberEmail, permission: nextRole },
      ]);
      toast.success("Agent role updated.");
    } catch (error) {
      console.error("Failed to update agent role:", error);
      toast.error("Failed to update agent role.");
      updateLocalRole(previousRole);
    }
  };

  const handleRemoveRequest = (agent: Agent) => {
    if (!selectedMember) return;
    const memberDisplayName =
      selectedMember.displayName ?? selectedMember.email ?? "member";

    setPendingRemoval({
      agentId: agent.agent_id,
      agentName: agent.agent_name ?? "agent",
      memberId: selectedMember.uid,
      memberDisplayName,
    });
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!isAdmin) {
      toast.error("you dont have permission to make changes");
      return;
    }
    if (!teamId || !pendingRemoval) return;

    try {
      const response = await removeAgentMember(
        teamId,
        pendingRemoval.agentId,
        pendingRemoval.memberId,
      );

      if (!response.success) {
        throw new Error(response.error || "Remove failed.");
      }

      setMembers((prev) =>
        prev.map((member) =>
          member.uid === pendingRemoval.memberId
            ? {
                ...member,
                agents: member.agents?.filter(
                  (agent) => agent.agent_id !== pendingRemoval.agentId,
                ),
              }
            : member,
        ),
      );

      setSelectedMember((prev) =>
        prev && prev.uid === pendingRemoval.memberId
          ? {
              ...prev,
              agents: prev.agents?.filter(
                (agent) => agent.agent_id !== pendingRemoval.agentId,
              ),
            }
          : prev,
      );

      toast.success("Member removed from agent.");
      setRemoveDialogOpen(false);
      setPendingRemoval(null);
    } catch (error) {
      console.error("Failed to remove member from agent:", error);
      toast.error("Failed to remove member.");
    }
  };

  useEffect(() => {
    if (!memberDialogOpen || !teamId || !currentUserId) {
      return;
    }

    const fetchInviteDialogData = async () => {
      try {
        setIsLoadingInviteCode(true);
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) {
          toast.error("Invite code is not available yet.");
          return;
        }

        const teamData = teamSnap.data();
        if (teamData?.invite_code) {
          setInviteCode(teamData.invite_code as string);
        } else {
          toast.error("Invite code is not available yet.");
        }

        if (teamData?.team_name) {
          setTeamNameForInvite(teamData.team_name as string);
        }

        try {
          const creatorResponse = await getCreatorFirstName(
            teamId,
            currentUserId,
          );
          if (creatorResponse.ok && creatorResponse.creator_first_name) {
            setCreatorFirstName(creatorResponse.creator_first_name);
          }
        } catch (error) {
          console.error("Failed to load creator name:", error);
        }
      } catch (error) {
        console.error("Failed to fetch invite code:", error);
        toast.error("Failed to load invite code.");
      } finally {
        setIsLoadingInviteCode(false);
      }
    };

    void fetchInviteDialogData();
  }, [memberDialogOpen, teamId, currentUserId]);

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
    if (!teamId || !currentUserId || emailList.length === 0) {
      return;
    }

    try {
      setIsInvitingMembers(true);
      const response = await inviteTeamMembers(
        teamId,
        emailList,
        currentUserId,
      );
      if (response.ok) {
        setInviteButtonLabel("Done");
        toast.success("Invitations sent!");
        await new Promise((resolve) => setTimeout(resolve, 400));
        setIsEmailDialogOpen(false);
        setEmailList([]);
        setEmailInput("");
        setInviteButtonLabel("Invite");
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

  const handleAgentsClick = (member: Member) => {
    setSelectedMember(member);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search members by name or email..."
        />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Agents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-sm text-muted-foreground"
                >
                  Loading members...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-sm text-muted-foreground"
                >
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow
                  key={member.uid}
                  onClick={() => handleAgentsClick(member)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    {member.displayName || "—"}
                  </TableCell>
                  <TableCell>{member.email || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={member.role ?? "member"}
                      onValueChange={(value) =>
                        handleRoleChange(
                          member.uid,
                          value as "admin" | "member",
                        )
                      }
                      disabled={!isAdmin}
                    >
                      <SelectTrigger
                        className="w-[120px]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">member</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {member.agents?.length ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAgentsClick(member)}
                        className="inline-flex items-center rounded-md p-1 text-muted-foreground hover:text-foreground"
                        aria-label={`Edit agents for ${member.displayName ?? member.email ?? "member"}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedMember(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Agents</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 px-2">
            {selectedMember?.agents?.length ? (
              selectedMember.agents.map((agent) => (
                <div
                  key={agent.agent_id}
                  className="flex items-center justify-between gap-4 rounded-md border bg-card p-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {agent.agent_name || "Unnamed agent"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {agent.agent_id}
                    </div>
                  </div>
                  <Select
                    value={agent.role ?? "view"}
                    onValueChange={(value) =>
                      value === "remove"
                        ? handleRemoveRequest(agent)
                        : handleAgentRoleChange(
                            agent.agent_id,
                            value as "edit" | "view" | "admin",
                          )
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">view</SelectItem>
                      <SelectItem value="edit">edit</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem
                        value="remove"
                        className="text-red-500 focus:text-red-500"
                        disabled={!isAdmin}
                      >
                        remove
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No agents assigned.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          setRemoveDialogOpen(open);
          if (!open) setPendingRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm removal</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval
                ? `Are you sure you want to delete ${pendingRemoval.memberDisplayName} from ${pendingRemoval.agentName}?`
                : "Are you sure you want to remove this member?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <AlertDialogContent
          className="max-h-[80vh] overflow-hidden flex flex-col"
          onEscapeKeyDown={() => {
            setMemberDialogOpen(false);
          }}
          onOverlayClick={() => setMemberDialogOpen(false)}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold">
              Invite members to {memberTeamLabel}'s Solari team{" "}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Here’s a 6 digit code you can send them to let them join this team
              as well.
            </AlertDialogDescription>
            <AlertDialogDescription>
              <span className="italic">
                {/* (Don't worry about losing this code, you can always find it in
                Members and Permissions) */}
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
            <AlertDialogAction onClick={() => setMemberDialogOpen(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <AlertDialogContent
          className="max-h-[80vh] overflow-hidden flex flex-col"
          onEscapeKeyDown={() => {
            setIsEmailDialogOpen(false);
          }}
          onOverlayClick={() => setIsEmailDialogOpen(false)}
        >
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
              disabled={emailList.length === 0 || isInvitingMembers}
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

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-lg px-6 h-14 shadow-lg hover:shadow-xl transition-shadow gap-2 bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground"
          onClick={() => setMemberDialogOpen(true)}
          disabled={!teamId}
        >
          <Plus className="h-5 w-5" />
          <span>Invite members</span>
        </Button>
      </div>
    </div>
  );
}
