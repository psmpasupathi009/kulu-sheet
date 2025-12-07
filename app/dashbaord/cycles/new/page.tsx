"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  Building2,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

interface Group {
  id: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
  userId: string;
}

export default function NewCyclePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [formData, setFormData] = useState({
    groupId: "",
    memberId: "",
    loanAmount: "",
    loanMonths: "10",
    monthlyAmount: "2000",
    reason: "",
    disbursedAt: new Date().toISOString().split("T")[0],
    guarantor1Id: "",
    guarantor2Id: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    fetchGroups();
    fetchAllMembers();
  }, []);

  useEffect(() => {
    if (formData.groupId) {
      fetchGroupMembers(formData.groupId);
    } else {
      setGroupMembers([]);
      setFormData((prev) => ({ ...prev, memberId: "" }));
    }
  }, [formData.groupId]);

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
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
        setAllMembers(data.members);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members`);
      if (response.ok) {
        const data = await response.json();

        // Handle both response structures
        const membersList = data.members || [];

        // Filter active members and extract member data
        const activeMembers = membersList
          .filter((gm: { isActive?: boolean; member?: { id: string } }) => {
            const isActive = gm.isActive !== false; // Default to true if not specified
            const hasMember = gm.member && gm.member.id;
            return isActive && hasMember;
          })
          .map(
            (gm: {
              member: { id: string; name?: string; userId?: string };
            }) => {
              const member = gm.member;
              return {
                id: member.id,
                name: member.name || "Unknown",
                userId: member.userId || member.id,
              };
            }
          );

        setGroupMembers(activeMembers);

        // Reset member selection if current selection is not in the list
        if (
          formData.memberId &&
          !activeMembers.some((m: Member) => m.id === formData.memberId)
        ) {
          setFormData((prev) => ({ ...prev, memberId: "" }));
        }

        if (activeMembers.length === 0) {
          setError(
            "No active members found in this group. Please add members to the group first."
          );
        } else {
          setError(""); // Clear error if members are found
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "Failed to fetch group members:",
          response.status,
          errorData
        );
        setGroupMembers([]);
        setError(errorData.error || "Failed to load group members");
      }
    } catch (error) {
      console.error("Error fetching group members:", error);
      setGroupMembers([]);
      setError("Error loading group members. Please try again.");
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    // Validation
    if (!formData.memberId) {
      setError("Please select a member");
      setSubmitting(false);
      return;
    }

    if (!formData.loanAmount || parseFloat(formData.loanAmount) <= 0) {
      setError("Please enter a valid loan amount");
      setSubmitting(false);
      return;
    }

    if (!formData.loanMonths || parseInt(formData.loanMonths) <= 0) {
      setError("Please enter a valid loan duration");
      setSubmitting(false);
      return;
    }

    try {
      const disbursedAt = new Date(formData.disbursedAt);
      disbursedAt.setHours(0, 0, 0, 0);

      const response = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: formData.groupId || undefined,
          memberId: formData.memberId,
          loanAmount: parseFloat(formData.loanAmount),
          loanMonths: parseInt(formData.loanMonths),
          monthlyAmount: parseFloat(formData.monthlyAmount),
          reason: formData.reason || undefined,
          disbursedAt: disbursedAt.toISOString(),
          guarantor1Id: formData.guarantor1Id || undefined,
          guarantor2Id: formData.guarantor2Id || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create loan cycle");
      }

      setSuccess("Loan cycle created and loan disbursed successfully!");
      setTimeout(() => {
        router.push("/dashbaord/cycles");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create loan cycle");
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Access denied. Admin privileges required.
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/dashbaord/cycles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cycles
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  // Calculate total interest
  const loanAmount = parseFloat(formData.loanAmount) || 0;
  const loanMonths = parseInt(formData.loanMonths) || 0;
  const monthlyPayment =
    loanAmount && loanMonths
      ? loanAmount / loanMonths // Monthly payment = loan amount / months
      : 0;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/cycles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Create Loan Cycle & Disburse Loan
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Create a new loan cycle and disburse loan to a member
          </p>
        </div>
      </div>

      {(error || success) && (
        <Alert
          variant={error ? "destructive" : "default"}
          className={
            success ? "border-green-200 bg-green-50 dark:bg-green-900/20" : ""
          }>
          <AlertDescription
            className={success ? "text-green-800 dark:text-green-200" : ""}>
            {error || success}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
          <CardDescription>
            Create a new ROSCA cycle. Members invest monthly, and one member receives a loan each month (rotating). 
            The first member will receive the loan immediately. Other members can be added later with catch-up payments if joining mid-cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="groupId">
                  <Building2 className="mr-2 h-4 w-4 inline" />
                  Group (Optional)
                </FieldLabel>
                <select
                  id="groupId"
                  value={formData.groupId}
                  onChange={(e) =>
                    setFormData({ ...formData, groupId: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">No Group (Simple Cycle)</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <FieldDescription>
                  Optional: Select a group if this cycle is part of a group. Leave empty for a simple cycle.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="memberId">
                  <User className="mr-2 h-4 w-4 inline" />
                  Member (Receiving First Loan){" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <select
                  id="memberId"
                  value={formData.memberId}
                  onChange={(e) =>
                    setFormData({ ...formData, memberId: e.target.value })
                  }
                  required
                  disabled={
                    !!formData.groupId &&
                    (loadingMembers || groupMembers.length === 0)
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">
                    {formData.groupId
                      ? loadingMembers
                        ? "Loading members..."
                        : groupMembers.length === 0
                        ? "No active members in this group"
                        : "Select a member from group"
                      : "Select a member"}
                  </option>
                  {formData.groupId && groupMembers.length > 0
                    ? groupMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId || member.id})
                        </option>
                      ))
                    : allMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId || member.id})
                        </option>
                      ))}
                </select>
                <FieldDescription>
                  {formData.groupId
                    ? `Select the member who will receive the first loan. ${groupMembers.length} member(s) available in group.`
                    : "Select the member who will receive the first loan in this cycle. Other members can be added later."}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="monthlyAmount">
                  <DollarSign className="mr-2 h-4 w-4 inline" />
                  Monthly Contribution Amount (₹){" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="monthlyAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.monthlyAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, monthlyAmount: e.target.value })
                  }
                  required
                  placeholder="2000"
                />
                <FieldDescription>
                  Monthly amount each member will contribute to the cycle
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="loanAmount">
                  <DollarSign className="mr-2 h-4 w-4 inline" />
                  Loan Amount (₹) <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="loanAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.loanAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, loanAmount: e.target.value })
                  }
                  required
                  placeholder="1000"
                />
                <FieldDescription>
                  Total loan amount to be disbursed to the member
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="loanMonths">
                  <Clock className="mr-2 h-4 w-4 inline" />
                  Loan Duration (Months){" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="loanMonths"
                  type="number"
                  min="1"
                  value={formData.loanMonths}
                  onChange={(e) =>
                    setFormData({ ...formData, loanMonths: e.target.value })
                  }
                  required
                  placeholder="10"
                />
                <FieldDescription>
                  Number of months for loan repayment (default: 10 months). Member needs to pay the loan amount within this duration.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="reason">
                  <FileText className="mr-2 h-4 w-4 inline" />
                  Reason for Loan (Optional)
                </FieldLabel>
                <Input
                  id="reason"
                  type="text"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="e.g., Business expansion, Medical emergency, etc."
                />
                <FieldDescription>
                  Optional: Purpose or reason for this loan
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="disbursedAt">
                  <Calendar className="mr-2 h-4 w-4 inline" />
                  Disbursal Date <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="disbursedAt"
                  type="date"
                  value={formData.disbursedAt}
                  onChange={(e) =>
                    setFormData({ ...formData, disbursedAt: e.target.value })
                  }
                  required
                />
                <FieldDescription>
                  Date when the loan will be disbursed
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="guarantor1Id">
                  <Users className="mr-2 h-4 w-4 inline" />
                  Guarantor 1 (Optional)
                </FieldLabel>
                <select
                  id="guarantor1Id"
                  value={formData.guarantor1Id}
                  onChange={(e) =>
                    setFormData({ ...formData, guarantor1Id: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">None</option>
                  {allMembers
                    .filter((m) => m.id !== formData.memberId)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.userId})
                      </option>
                    ))}
                </select>
                <FieldDescription>
                  Optional: First guarantor for this loan
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="guarantor2Id">
                  <Users className="mr-2 h-4 w-4 inline" />
                  Guarantor 2 (Optional)
                </FieldLabel>
                <select
                  id="guarantor2Id"
                  value={formData.guarantor2Id}
                  onChange={(e) =>
                    setFormData({ ...formData, guarantor2Id: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">None</option>
                  {allMembers
                    .filter(
                      (m) =>
                        m.id !== formData.memberId &&
                        m.id !== formData.guarantor1Id
                    )
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.userId})
                      </option>
                    ))}
                </select>
                <FieldDescription>
                  Optional: Second guarantor for this loan
                </FieldDescription>
              </Field>

              {loanAmount > 0 && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Loan Summary:</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Principal: ₹{loanAmount.toFixed(2)}</p>
                    <p>
                      Monthly Payment: ₹
                      {monthlyPayment.toFixed(2)}
                    </p>
                    <p className="font-semibold text-foreground">
                      Total Loan Amount: ₹{loanAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <Field>
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating & Disbursing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Create Cycle & Disburse Loan
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashbaord/cycles")}>
                    Cancel
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
