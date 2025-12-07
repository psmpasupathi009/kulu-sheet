"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ArrowLeft,
  IndianRupee,
  Users,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { format, addMonths } from "date-fns";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Member {
  id: string;
  name: string;
  userId: string;
}

interface GroupMember {
  id: string;
  memberId: string;
  member: Member;
}

interface MonthlyCollection {
  id: string;
  month: number;
  collectionDate: string;
  totalCollected: number;
  expectedAmount: number;
  isCompleted: boolean;
  loanDisbursed: boolean;
  loanMemberId: string | null;
  loanAmount: number | null;
  payments: Array<{
    id: string;
    memberId: string;
    amount: number;
    paymentDate: string;
  status: string;
  member: {
    name: string;
    userId: string;
  };
  }>;
}

interface FinancingGroup {
  id: string;
  groupNumber: number;
  name: string | null;
  startDate: string;
  monthlyAmount: number;
  currentMonth: number;
  totalMembers: number;
  isActive: boolean;
  members: GroupMember[];
  collections: MonthlyCollection[];
}

export default function CyclesPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<FinancingGroup[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [createGroupForm, setCreateGroupForm] = useState({
    name: "",
    startDate: new Date().toISOString().split("T")[0],
    monthlyAmount: "2000",
    selectedMemberIds: [] as string[],
  });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState<string | null>(null);
  const [createCollectionForm, setCreateCollectionForm] = useState({
    collectionDate: new Date().toISOString().split("T")[0],
  });
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState<string | null>(null);
  const [recordPaymentForm, setRecordPaymentForm] = useState({
    memberId: "",
    amount: "",
    paymentMethod: "CASH" as "CASH" | "UPI" | "BANK_TRANSFER",
  });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [givingLoan, setGivingLoan] = useState<string | null>(null);
  const [showGiveLoanForm, setShowGiveLoanForm] = useState<string | null>(null);
  const [giveLoanForm, setGiveLoanForm] = useState({
    memberId: "",
    disbursementMethod: "CASH" as "CASH" | "UPI" | "BANK_TRANSFER",
  });

  useEffect(() => {
    fetchGroups();
    fetchAllMembers();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/financing-groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const response = await fetch("/api/members");
      if (response.ok) {
        const data = await response.json();
        setAllMembers(data.members || []);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setCreateGroupForm((prev) => {
      const newSelected = prev.selectedMemberIds.includes(memberId)
        ? prev.selectedMemberIds.filter((id) => id !== memberId)
        : [...prev.selectedMemberIds, memberId];

      return { ...prev, selectedMemberIds: newSelected };
    });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);

    if (createGroupForm.selectedMemberIds.length < 2) {
      toast.error("At least 2 members must be selected");
      setCreatingGroup(false);
      return;
    }

    try {
      const response = await fetch("/api/financing-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createGroupForm.name || undefined,
          startDate: createGroupForm.startDate,
          monthlyAmount: parseFloat(createGroupForm.monthlyAmount),
          memberIds: createGroupForm.selectedMemberIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create group");
      }

      toast.success("Financing group created successfully!");
      setShowCreateGroup(false);
      setCreateGroupForm({
        name: "",
        startDate: new Date().toISOString().split("T")[0],
        monthlyAmount: "2000",
        selectedMemberIds: [],
      });
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreateCollection = async (groupId: string) => {
    setCreatingCollection(true);

    try {
      const response = await fetch(`/api/financing-groups/${groupId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionDate: createCollectionForm.collectionDate,
        }),
      });

        const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create collection");
      }

      toast.success("Monthly collection created successfully!");
      setShowCreateCollection(null);
      setCreateCollectionForm({
        collectionDate: new Date().toISOString().split("T")[0],
      });
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to create collection");
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleRecordPayment = async (groupId: string) => {
    setRecordingPayment(true);

    if (!recordPaymentForm.memberId || !recordPaymentForm.amount) {
      toast.error("Please select a member and enter amount");
      setRecordingPayment(false);
      return;
    }

    try {
      const response = await fetch(`/api/financing-groups/${groupId}/collections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: recordPaymentForm.memberId,
          amount: parseFloat(recordPaymentForm.amount),
          paymentMethod: recordPaymentForm.paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error message if member already paid
        if (data.existingPayment) {
          toast.error(
            data.error || "This member has already paid for this month",
            {
              description: `Previous payment: ${new Date(data.existingPayment.date).toLocaleDateString()} - ₹${data.existingPayment.amount?.toFixed(2) || 'N/A'}`,
              duration: 5000,
            }
          );
        } else {
          toast.error(data.error || "Failed to record payment");
        }
        setRecordingPayment(false);
        return;
      }

      toast.success("Payment recorded successfully!");
      setShowRecordPayment(null);
      setRecordPaymentForm({
        memberId: "",
        amount: "",
        paymentMethod: "CASH",
      });
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleGiveLoan = async (groupId: string) => {
    if (!giveLoanForm.memberId) {
      toast.error("Please select a member to receive the loan");
      return;
    }

    setGivingLoan(groupId);

    try {
      const response = await fetch(`/api/financing-groups/${groupId}/collections/give-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: giveLoanForm.memberId,
          disbursementMethod: giveLoanForm.disbursementMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to give loan");
      }

      toast.success(data.message || "Loan given successfully!");
      setGivingLoan(null);
      setShowGiveLoanForm(null);
      setGiveLoanForm({
        memberId: "",
        disbursementMethod: "CASH",
      });
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to give loan");
      setGivingLoan(null);
    }
  };

  const handleEditCollection = async (groupId: string, collectionId: string, currentDate: string) => {
    const newDate = prompt("Enter new collection date (YYYY-MM-DD):", currentDate.split("T")[0]);
    if (!newDate) return;

    try {
      const response = await fetch(`/api/financing-groups/${groupId}/collections/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionDate: newDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update collection");
      }

      toast.success("Collection updated successfully!");
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to update collection");
    }
  };

  const handleDeleteCollection = async (groupId: string, collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection? This will also delete all payments recorded for this month.")) {
      return;
    }

    try {
      const response = await fetch(`/api/financing-groups/${groupId}/collections/${collectionId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete collection");
      }

      toast.success("Collection deleted successfully!");
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete collection");
    }
  };

  const handleReverseLoan = async (groupId: string, collectionId: string) => {
    if (!confirm("Are you sure you want to reverse this loan? This will delete the loan and make the collection available for loan disbursement again.")) {
      return;
    }

    try {
      const response = await fetch(`/api/financing-groups/${groupId}/collections/${collectionId}/reverse-loan`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reverse loan");
      }

      toast.success(data.message || "Loan reversed successfully!");
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Failed to reverse loan");
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="p-4 border border-destructive rounded-md bg-destructive/10">
          <p className="text-destructive">Access denied. Admin privileges required.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashbaord">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4 sm:p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Financing Groups</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Groups with variable members investing monthly. Each member receives the pooled loan once during the cycle.
          </p>
        </div>
        <Button onClick={() => setShowCreateGroup(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
          New Financing Group
          </Button>
      </div>

      {/* Create Group Form */}
      {showCreateGroup && (
        <Card>
            <CardHeader>
            <CardTitle>Create Financing Group</CardTitle>
              <CardDescription>
              Select members (minimum 2). Each will invest the monthly amount for the number of months equal to the number of members. Each member receives the pooled loan once.
              </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Group Name (Optional)</FieldLabel>
                  <Input
                    value={createGroupForm.name}
                    onChange={(e) =>
                      setCreateGroupForm({ ...createGroupForm, name: e.target.value })
                    }
                    placeholder="e.g., Group 1"
                  />
                </Field>

                <Field>
                  <FieldLabel>Start Date</FieldLabel>
                  <Input
                    type="date"
                    value={createGroupForm.startDate}
                    onChange={(e) =>
                      setCreateGroupForm({ ...createGroupForm, startDate: e.target.value })
                    }
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>
                    <IndianRupee className="mr-2 h-4 w-4 inline" />
                    Monthly Amount per Member
                  </FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={createGroupForm.monthlyAmount}
                      onChange={(e) =>
                        setCreateGroupForm({ ...createGroupForm, monthlyAmount: e.target.value })
                      }
                      required
                      placeholder="2000"
                      className="pl-8"
                    />
                  </div>
                  <FieldDescription>Amount each member invests per month (default: ₹2,000)</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>
                    Select Members ({createGroupForm.selectedMemberIds.length} selected)
                  </FieldLabel>
                  <div className="border rounded-lg bg-card overflow-hidden">
                    <div className="sticky top-0 bg-muted/50 p-3 border-b flex items-center justify-between z-10">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all"
                          checked={createGroupForm.selectedMemberIds.length === allMembers.length && allMembers.length > 0}
                          onCheckedChange={() => {
                            if (createGroupForm.selectedMemberIds.length === allMembers.length) {
                              setCreateGroupForm({ ...createGroupForm, selectedMemberIds: [] });
                            } else {
                              const allIds = allMembers.map((m) => m.id);
                              setCreateGroupForm({ ...createGroupForm, selectedMemberIds: allIds });
                            }
                          }}
                        />
                        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                          Select All
                        </Label>
                      </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-2">
                      {allMembers.map((member) => (
                        <div
                          key={member.id}
                          className={`flex items-center space-x-3 p-3 rounded-md transition-colors mb-1 ${
                            createGroupForm.selectedMemberIds.includes(member.id)
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-accent/50 border border-transparent"
                          }`}>
                          <Checkbox
                            id={`member-${member.id}`}
                            checked={createGroupForm.selectedMemberIds.includes(member.id)}
                            onCheckedChange={() => toggleMemberSelection(member.id)}
                          />
                          <Label
                            htmlFor={`member-${member.id}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1">
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {member.userId}
                              </p>
                            </div>
                          </Label>
                          {createGroupForm.selectedMemberIds.includes(member.id) && (
                            <span className="text-xs text-primary font-medium">
                              Month {createGroupForm.selectedMemberIds.indexOf(member.id) + 1}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <FieldDescription>
                    Select members (minimum 2). Admin will decide who receives the loan each month. The cycle duration equals the number of members.
                  </FieldDescription>
                </Field>

                <div className="flex gap-3 pt-4 border-t">
                  <Button type="submit" disabled={creatingGroup} className="flex-1">
                    {creatingGroup ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Group
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateGroup(false);
                      setCreateGroupForm({
                        name: "",
                        startDate: new Date().toISOString().split("T")[0],
                        monthlyAmount: "2000",
                        selectedMemberIds: [],
                      });
                    }}
                    disabled={creatingGroup}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </form>
            </CardContent>
          </Card>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No financing groups found. Create a new group to start.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            // Find the current active collection (incomplete or completed but loan not disbursed)
            // Prioritize incomplete collections, then completed but not disbursed
            const incompleteCollection = group.collections.find((c) => !c.isCompleted);
            const completedNotDisbursed = group.collections.find((c) => c.isCompleted && !c.loanDisbursed);
            const currentCollection = incompleteCollection || completedNotDisbursed;
            const pooledAmount = group.monthlyAmount * group.totalMembers;

            return (
              <Card key={group.id}>
            <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {group.name || `Group ${group.groupNumber}`} - {group.currentMonth > 0 ? format(addMonths(new Date(group.startDate), group.currentMonth - 1), 'MMMM yyyy') : 'Not Started'} ({group.currentMonth}/{group.totalMembers})
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Started: {format(new Date(group.startDate), "dd MMM yyyy")} | 
                        Monthly: ₹{group.monthlyAmount.toFixed(2)} × {group.totalMembers} = ₹{pooledAmount.toFixed(2)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
            </CardHeader>
            <CardContent className="space-y-4">
                  {/* Cycle Progress Tracker */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Cycle Progress</h3>
                      <span className="text-xs text-muted-foreground">
                        {group.collections.filter(c => c.loanDisbursed).length} / {group.totalMembers} loans given
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {group.members.map((gm) => {
                        const hasReceivedLoan = group.collections.some(
                          (c) => c.loanMemberId === gm.memberId && c.loanDisbursed
                        );
                        return (
                          <div
                            key={gm.id}
                            className={`p-2 border rounded-md text-sm ${
                              hasReceivedLoan
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/20"
                                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                            }`}>
                            <div className="font-medium flex items-center gap-2">
                              {hasReceivedLoan && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                              {gm.member.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {gm.member.userId}
                            </div>
                            {hasReceivedLoan && (
                              <div className="text-xs text-green-600 mt-1 font-medium">
                                ✓ Loan Received
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Create Collection */}
                  {group.isActive && group.currentMonth < group.totalMembers && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <h3 className="text-sm font-semibold mb-3">Monthly Collection</h3>
                      {showCreateCollection === group.id ? (
                        <div className="space-y-3">
              <Field>
                            <FieldLabel>Collection Date</FieldLabel>
                <Input
                  type="date"
                              value={createCollectionForm.collectionDate}
                  onChange={(e) =>
                                setCreateCollectionForm({
                                  ...createCollectionForm,
                                  collectionDate: e.target.value,
                                })
                  }
                />
              </Field>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleCreateCollection(group.id)}
                              disabled={creatingCollection}>
                              {creatingCollection ? "Creating..." : "Create Collection"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowCreateCollection(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCreateCollection(group.id)}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Create {format(addMonths(new Date(group.startDate), group.currentMonth), 'MMMM yyyy')} Collection
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Record Payment */}
                  {currentCollection && !currentCollection.loanDisbursed && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <h3 className="text-sm font-semibold mb-3">
                        Record Payment ({format(addMonths(new Date(group.startDate), currentCollection.month - 1), 'MMMM yyyy')})
                      </h3>
                      {currentCollection.isCompleted && (
                        <div className="mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-800 dark:text-green-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Collection completed. All members have paid. Ready for loan disbursement.
                          </p>
                        </div>
                      )}
                      {showRecordPayment === group.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRecordPayment(group.id);
                          }}
                          className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field>
                              <FieldLabel>Member</FieldLabel>
                              <select
                                value={recordPaymentForm.memberId}
                  onChange={(e) =>
                                  setRecordPaymentForm({
                                    ...recordPaymentForm,
                                    memberId: e.target.value,
                                  })
                                }
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="">Select member</option>
                                {group.members
                                  .filter(
                                    (gm) =>
                                      !(currentCollection.payments || []).some(
                                        (p) => p.memberId === gm.memberId && p.status === "PAID"
                                      )
                                  )
                                  .map((gm) => (
                                    <option key={gm.memberId} value={gm.memberId}>
                                      {gm.member.name} ({gm.member.userId})
                                    </option>
                                  ))}
                                {group.members.filter(
                                  (gm) =>
                                    !(currentCollection.payments || []).some(
                                      (p) => p.memberId === gm.memberId && p.status === "PAID"
                                    )
                                ).length === 0 && (
                                  <option value="" disabled>All members have paid for this month</option>
                                )}
                              </select>
                              {group.members.filter(
                                (gm) =>
                                  !(currentCollection.payments || []).some(
                                    (p) => p.memberId === gm.memberId && p.status === "PAID"
                                  )
                              ).length === 0 && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  All members have paid for this month
                                </p>
                              )}
                              {group.members.filter(
                                (gm) =>
                                  !(currentCollection.payments || []).some(
                                    (p) => p.memberId === gm.memberId && p.status === "PAID"
                                  )
                              ).length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Showing only unpaid members ({group.members.filter(
                                    (gm) =>
                                      !(currentCollection.payments || []).some(
                                        (p) => p.memberId === gm.memberId && p.status === "PAID"
                                      )
                                  ).length} remaining)
                                </p>
                              )}
              </Field>
              <Field>
                              <FieldLabel>Amount</FieldLabel>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">₹</span>
                <Input
                  type="number"
                  step="0.01"
                                  value={recordPaymentForm.amount}
                  onChange={(e) =>
                                    setRecordPaymentForm({
                                      ...recordPaymentForm,
                                      amount: e.target.value,
                                    })
                                  }
                                  required
                                  placeholder="2000"
                                  className="pl-8"
                                />
                              </div>
              </Field>
              <Field>
                              <FieldLabel>Payment Method</FieldLabel>
                              <select
                                value={recordPaymentForm.paymentMethod}
                    onChange={(e) =>
                                  setRecordPaymentForm({
                                    ...recordPaymentForm,
                                    paymentMethod: e.target.value as "CASH" | "UPI" | "BANK_TRANSFER",
                                  })
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                              </select>
              </Field>
                          </div>
              <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={recordingPayment}>
                              {recordingPayment ? "Recording..." : "Record Payment"}
                </Button>
                <Button
                              type="button"
                  variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowRecordPayment(null);
                                setRecordPaymentForm({
                                  memberId: "",
                                  amount: "",
                                  paymentMethod: "CASH",
                                });
                              }}>
                  Cancel
                </Button>
              </div>
                        </form>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRecordPayment(group.id)}>
                          Record Payment
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Give Loan */}
                  {currentCollection && currentCollection.isCompleted && !currentCollection.loanDisbursed && (
                    <div className="border rounded-lg p-4 bg-primary/5">
                      <h3 className="text-sm font-semibold mb-3">
                        Give Loan (Pooled Amount: ₹{currentCollection.totalCollected.toFixed(2)})
                      </h3>
                      {showGiveLoanForm === group.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleGiveLoan(group.id);
                          }}
                          className="space-y-3">
                          <Field>
                            <FieldLabel>Select Member to Receive Loan</FieldLabel>
                            <select
                              value={giveLoanForm.memberId}
                              onChange={(e) =>
                                setGiveLoanForm({
                                  ...giveLoanForm,
                                  memberId: e.target.value,
                                })
                              }
                              required
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                              <option value="">Select member</option>
                              {group.members
                                .filter((gm) => {
                                  // Filter out members who already received loans in this group
                                  const hasReceivedLoan = group.collections.some(
                                    (c) => c.loanMemberId === gm.memberId && c.loanDisbursed
                                  );
                                  return !hasReceivedLoan;
                                })
                                .map((gm) => (
                                  <option key={gm.memberId} value={gm.memberId}>
                                    {gm.member.name} ({gm.member.userId})
                                  </option>
                                ))}
                            </select>
                            <FieldDescription>
                              Select which member should receive the loan from this collection. Members who already received loans are not shown.
                            </FieldDescription>
                          </Field>
                          <Field>
                            <FieldLabel>Disbursement Method</FieldLabel>
                            <select
                              value={giveLoanForm.disbursementMethod}
                              onChange={(e) =>
                                setGiveLoanForm({
                                  ...giveLoanForm,
                                  disbursementMethod: e.target.value as "CASH" | "UPI" | "BANK_TRANSFER",
                                })
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                              <option value="CASH">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                          </Field>
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={givingLoan === group.id || !giveLoanForm.memberId}>
                              {givingLoan === group.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Giving Loan...
                                </>
                              ) : (
                                <>
                                  <IndianRupee className="mr-2 h-4 w-4" />
                                  Give Loan
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowGiveLoanForm(null);
                                setGiveLoanForm({
                                  memberId: "",
                                  disbursementMethod: "CASH",
                                });
                              }}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowGiveLoanForm(group.id)}>
                          <IndianRupee className="mr-2 h-4 w-4" />
                          Give Loan
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Loan Given Info */}
                  {currentCollection && currentCollection.loanDisbursed && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/20">
                      <p className="text-sm font-medium text-green-800 dark:text-green-400">
                        ✓ Loan Given
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Amount: ₹{currentCollection.loanAmount?.toFixed(2) || "0.00"} | 
                        Member: {group.members.find((gm) => gm.memberId === currentCollection.loanMemberId)?.member.name || "Unknown"}
                      </p>
                    </div>
                  )}

                  {/* Collections History */}
                  {group.collections.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Collected</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Loan</TableHead>
                            {user?.role === "ADMIN" && <TableHead>Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.collections.map((collection) => (
                            <TableRow key={collection.id}>
                              <TableCell className="font-medium">{format(addMonths(new Date(group.startDate), collection.month - 1), 'MMMM yyyy')}</TableCell>
                              <TableCell>
                                {format(new Date(collection.collectionDate), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell>₹{collection.totalCollected.toFixed(2)}</TableCell>
                              <TableCell>
                                {collection.isCompleted ? (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                    Completed
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                    Pending
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {collection.loanDisbursed ? (
                                  <span className="text-xs text-green-600">✓ Disbursed</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              {user?.role === "ADMIN" && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    {!collection.loanDisbursed && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleEditCollection(group.id, collection.id, collection.collectionDate)}
                                          className="h-7 px-2">
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleDeleteCollection(group.id, collection.id)}
                                          className="h-7 px-2">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                    {collection.loanDisbursed && (
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleReverseLoan(group.id, collection.id)}
                                        className="h-7 px-2 text-xs">
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Reverse
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
            </CardContent>
          </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
