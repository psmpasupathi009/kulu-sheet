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
  IndianRupee,
  Users,
  Calendar,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Member {
  id: string;
  name: string;
  userId: string;
}

export default function GiveLoanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [formData, setFormData] = useState({
    principal: "",
    months: "10",
    reason: "",
    disbursementMethod: "CASH" as "CASH" | "UPI" | "BANK_TRANSFER",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Validation
    if (!selectedMemberId) {
      toast.error("Please select a member");
      setSubmitting(false);
      return;
    }

    if (!formData.principal || parseFloat(formData.principal) <= 0) {
      toast.error("Please enter a valid loan amount");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/loans/give", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId,
          principal: parseFloat(formData.principal),
          months: parseInt(formData.months),
          reason: formData.reason || undefined,
          disbursementMethod: formData.disbursementMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to give loan");
      }

      toast.success(data.message || "Loan given successfully!");
      setTimeout(() => {
        router.push("/dashbaord/loans");
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to give loan");
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
          <Link href="/dashbaord/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  const selectedMember = allMembers.find((m) => m.id === selectedMemberId);
  const loanAmount = parseFloat(formData.principal) || 0;
  const monthlyPayment = loanAmount / (parseInt(formData.months) || 10);

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
          <h1 className="text-2xl sm:text-3xl font-bold">Give Loan</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Give a loan to a member from the savings pool
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
          <CardDescription>
            Select a member and enter the loan amount. The amount will be
            deducted from the collective savings pool.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel>
                  <Users className="mr-2 h-4 w-4 inline" />
                  Select Member <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="border rounded-lg bg-card overflow-hidden">
                  {/* Scrollable Member List */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {allMembers.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No members found. Please create members first.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {allMembers.map((member) => (
                          <div
                            key={member.id}
                            className={`flex items-center space-x-3 p-3 rounded-md transition-colors mb-1 cursor-pointer ${
                              selectedMemberId === member.id
                                ? "bg-primary/10 border border-primary/20"
                                : "hover:bg-accent/50 border border-transparent"
                            }`}
                            onClick={() => setSelectedMemberId(member.id)}>
                            <Checkbox
                              id={`member-${member.id}`}
                              checked={selectedMemberId === member.id}
                              onCheckedChange={() => setSelectedMemberId(member.id)}
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <FieldDescription>
                  Select a member to receive the loan
                </FieldDescription>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="principal">
                    <IndianRupee className="mr-2 h-4 w-4 inline" />
                    Loan Amount <span className="text-destructive">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">₹</span>
                    <Input
                      id="principal"
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.principal}
                      onChange={(e) =>
                        setFormData({ ...formData, principal: e.target.value })
                      }
                      required
                      placeholder="Enter loan amount"
                      className="w-full pl-8"
                    />
                  </div>
                  <FieldDescription>
                    Total amount to be given as loan
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="months">
                    <Calendar className="mr-2 h-4 w-4 inline" />
                    Repayment Period (Months){" "}
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="months"
                    type="number"
                    min="1"
                    value={formData.months}
                    onChange={(e) =>
                      setFormData({ ...formData, months: e.target.value })
                    }
                    required
                    placeholder="10"
                    className="w-full"
                  />
                  <FieldDescription>
                    Number of months to repay the loan
                  </FieldDescription>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="reason">
                  <FileText className="mr-2 h-4 w-4 inline" />
                  Reason (Optional)
                </FieldLabel>
                <Input
                  id="reason"
                  type="text"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="Purpose of the loan"
                  className="w-full"
                />
                <FieldDescription>
                  Optional reason or purpose for the loan
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="disbursementMethod">
                  <IndianRupee className="mr-2 h-4 w-4 inline" />
                  Disbursement Method
                </FieldLabel>
                <select
                  id="disbursementMethod"
                  value={formData.disbursementMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      disbursementMethod: e.target.value as
                        | "CASH"
                        | "UPI"
                        | "BANK_TRANSFER",
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
                <FieldDescription>
                  Method used to disburse the loan
                </FieldDescription>
              </Field>

              {loanAmount > 0 && selectedMember && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Loan Summary:</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Member: <span className="font-semibold text-foreground">{selectedMember.name}</span>
                    </p>
                    <p>
                      Loan Amount:{" "}
                      <span className="font-semibold text-foreground">
                        ₹{loanAmount.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      Repayment Period:{" "}
                      <span className="font-semibold text-foreground">
                        {formData.months} months
                      </span>
                    </p>
                    <p>
                      Monthly Payment:{" "}
                      <span className="font-semibold text-foreground">
                        ₹{monthlyPayment.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-xs mt-2 pt-2 border-t">
                      The loan amount will be deducted from the collective
                      savings pool. No interest or penalties apply.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  className="flex-1 sm:flex-none sm:min-w-[200px]"
                  disabled={submitting || !selectedMemberId}>
                  {submitting ? (
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
                  onClick={() => router.push("/dashbaord/cycles")}
                  disabled={submitting}
                  className="sm:w-auto">
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
