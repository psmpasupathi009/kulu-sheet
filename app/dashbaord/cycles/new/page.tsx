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
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

interface Member {
  id: string;
  name: string;
  userId: string;
}

export default function NewCyclePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    monthlyAmount: "2000",
    startDate: new Date().toISOString().split("T")[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllMembers();
  }, []);

  const fetchAllMembers = async () => {
    try {
      const response = await fetch("/api/members");
      if (response.ok) {
        const data = await response.json();
        setAllMembers(data.members || []);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Validation
    if (selectedMemberIds.length === 0) {
      toast.error("Please select at least one member");
      setSubmitting(false);
      return;
    }

    if (!formData.monthlyAmount || parseFloat(formData.monthlyAmount) <= 0) {
      toast.error("Please enter a valid monthly contribution amount");
      setSubmitting(false);
      return;
    }

    try {
      const startDate = new Date(formData.startDate);
      startDate.setHours(0, 0, 0, 0);

      const response = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedMemberIds,
          monthlyAmount: parseFloat(formData.monthlyAmount),
          startDate: startDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create cycle");
      }

      toast.success(data.message || "Cycle created successfully!");
      setTimeout(() => {
        router.push("/dashbaord/cycles");
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to create cycle");
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <div className="p-4 border border-destructive rounded-md bg-destructive/10">
          <p className="text-destructive">
            Access denied. Admin privileges required.
          </p>
        </div>
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

  const monthlyAmount = parseFloat(formData.monthlyAmount) || 0;
  const totalMembers = selectedMemberIds.length;
  const pooledLoanAmount = monthlyAmount * totalMembers;

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
            Create New Loan Cycle
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Set up a monthly rotation cycle where members invest monthly and receive loans in rotation
          </p>
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>Cycle Configuration</CardTitle>
          <CardDescription>
            Select members who will participate in this cycle. Each member will invest monthly, 
            and the pooled amount will be given as a loan to one member each month in rotation. 
            Each loan must be repaid within 10 months without interest or penalties.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <FieldGroup>
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
                  Amount each member will contribute every month
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="startDate">
                  <Calendar className="mr-2 h-4 w-4 inline" />
                  Cycle Start Date <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
                <FieldDescription>
                  Date when the cycle will begin
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>
                  <Users className="mr-2 h-4 w-4 inline" />
                  Select Members{" "}
                  <span className="text-destructive">*</span>
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({selectedMemberIds.length} selected)
                  </span>
                </FieldLabel>
                <div className="border rounded-md p-4 max-h-96 overflow-y-auto">
                  {allMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No members found. Please create members first.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {allMembers.map((member) => (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                            selectedMemberIds.includes(member.id)
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-accent"
                          }`}
                          onClick={() => toggleMemberSelection(member.id)}>
                          <div className="flex items-center gap-3">
                            {selectedMemberIds.includes(member.id) ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <XCircle className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">
                                ID: {member.userId}
                              </p>
                            </div>
                          </div>
                          {selectedMemberIds.includes(member.id) && (
                            <span className="text-sm text-primary font-medium">
                              Month {selectedMemberIds.indexOf(member.id) + 1}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <FieldDescription>
                  Click on members to select them. Selected members will receive loans in rotation order (Month 1, Month 2, etc.)
                </FieldDescription>
              </Field>

              {totalMembers > 0 && monthlyAmount > 0 && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Cycle Summary:</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Total Members: {totalMembers}</p>
                    <p>Monthly Contribution per Member: ₹{monthlyAmount.toFixed(2)}</p>
                    <p className="font-semibold text-foreground">
                      Pooled Loan Amount (per month): ₹{pooledLoanAmount.toFixed(2)}
                    </p>
                    <p className="text-xs mt-2 pt-2 border-t">
                      Each member will receive ₹{pooledLoanAmount.toFixed(2)} in their assigned month 
                      and must repay it within 10 months (₹{(pooledLoanAmount / 10).toFixed(2)} per month) 
                      without interest or penalties.
                    </p>
                  </div>
                </div>
              )}

              <Field>
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={submitting || totalMembers === 0}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating Cycle...
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-4 w-4" />
                        Create Cycle
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
