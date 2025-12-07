"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { generatePaymentSchedule } from "@/lib/utils";

interface LoanTransaction {
  id: string;
  date: string;
  amount: number;
  interest: number;
  remaining: number;
  month: number;
}

interface Loan {
  id: string;
  member: {
    name: string;
    userId: string;
  };
  group?: {
    id: string;
    groupNumber: number;
    name: string | null;
    totalMembers: number;
    monthlyAmount: number;
    startDate: string;
  } | null;
  principal: number;
  remaining: number;
  currentMonth: number;
  months: number;
  status: string;
  totalPrincipalPaid: number;
  disbursedAt?: string | null;
  completedAt?: string | null;
  guarantor1?: {
    name: string;
    userId: string;
  } | null;
  guarantor2?: {
    name: string;
    userId: string;
  } | null;
  transactions: LoanTransaction[];
}

interface InterestDistribution {
  id: string;
  amount: number;
  distributionDate: string;
  groupMember: {
    member: {
      name: string;
      userId: string;
    };
    totalContributed: number;
  };
}

export default function LoanDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "" as "CASH" | "UPI" | "BANK_TRANSFER" | "",
  });

  // Simple monthly payment calculation: principal / months (no interest, no penalties)
  const monthlyPayment = loan ? loan.principal / loan.months : 0;

  useEffect(() => {
    if (params.id) {
      fetchLoan(params.id as string);
    }
  }, [params.id]);

  const fetchLoan = async (id: string) => {
    try {
      const response = await fetch(`/api/loans/${id}`);
      if (response.ok) {
        const data = await response.json();
        setLoan(data.loan);
      }
    } catch (error) {
      console.error("Error fetching loan:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRepay = async () => {
    if (!loan) return;

    setRepaying(true);
    try {
      const response = await fetch("/api/loans/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || `Monthly payment of ₹${data.payment.amount.toFixed(2)} recorded successfully!`);
        setShowPaymentForm(false);
        setPaymentForm({
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMethod: "",
        });
        // Refresh loan data
        await fetchLoan(loan.id);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setRepaying(false);
    }
  };

  const handleMarkDefaulted = async () => {
    if (
      !loan ||
      !confirm("Mark this loan as defaulted? This action cannot be undone.")
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DEFAULTED",
        }),
      });

      if (response.ok) {
        toast.success("Loan marked as defaulted");
        await fetchLoan(loan.id);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update loan status");
      }
    } catch (error) {
      console.error("Error updating loan:", error);
      toast.error("Failed to update loan status");
    }
  };

  const paymentSchedule = loan
    ? generatePaymentSchedule(
        loan.principal,
        loan.principal / loan.months, // Monthly principal payment
        0, // No interest
        loan.months,
        "DECLINING" // Not used but required by function
      )
    : [];

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!loan) {
    return <div>Loan not found</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            Loan Details
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 truncate">
            {loan.member.name} - {loan.member.userId}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal:</span>
              <span className="font-medium">₹{loan.principal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium">₹{loan.remaining.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="font-medium">No Interest</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Progress:</span>
              <span className="font-medium">
                {loan.currentMonth}/{loan.months} months
              </span>
            </div>
            {loan.status === "ACTIVE" && loan.remaining > 0 && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-muted-foreground font-semibold">
                  Monthly Payment:
                </span>
                <span className="font-bold text-lg text-blue-600">
                  ₹{monthlyPayment.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span
                className={`font-medium ${
                  loan.status === "COMPLETED"
                    ? "text-green-600"
                    : loan.status === "ACTIVE"
                    ? "text-blue-600"
                    : loan.status === "DEFAULTED"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}>
                {loan.status}
              </span>
            </div>
            {loan.group && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Financing Group:</span>
                <span className="font-medium">
                  {loan.group.name || `Group #${loan.group.groupNumber}`}
                </span>
              </div>
            )}
            {loan.disbursedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Disbursed:</span>
                <span className="font-medium">
                  {format(new Date(loan.disbursedAt), "dd/MM/yyyy")}
                </span>
              </div>
            )}
            {loan.completedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium">
                  {format(new Date(loan.completedAt), "dd/MM/yyyy")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Principal Paid:
              </span>
              <span className="font-medium">
                ₹{loan.totalPrincipalPaid.toFixed(2)}
              </span>
            </div>
            {loan.guarantor1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guarantor 1:</span>
                <span className="font-medium">{loan.guarantor1.name}</span>
              </div>
            )}
            {loan.guarantor2 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guarantor 2:</span>
                <span className="font-medium">{loan.guarantor2.name}</span>
              </div>
            )}
            {loan.status === "ACTIVE" && loan.remaining > 0 && (
              <div className="pt-4 border-t space-y-2">
                {!showPaymentForm ? (
                  <Button
                    className="w-full"
                    onClick={() => setShowPaymentForm(true)}>
                    Record Monthly Payment
                  </Button>
                ) : (
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Record Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                          Payment Details
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Monthly Payment:
                            </span>
                            <span className="font-medium">
                              ₹{monthlyPayment.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Progress:
                            </span>
                            <span className="font-medium">
                              {loan.currentMonth}/{loan.months} months
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Remaining:
                            </span>
                            <span className="font-medium">
                              ₹{loan.remaining.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Field>
                        <FieldLabel htmlFor="amount">
                          Payment Amount
                        </FieldLabel>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={monthlyPayment.toFixed(2)}
                          disabled
                          className="font-semibold"
                        />
                        <FieldDescription className="mt-2">
                          Monthly payment amount (Principal / Duration)
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="paymentDate">
                          <Calendar className="mr-2 h-4 w-4 inline" />
                          Payment Date
                        </FieldLabel>
                        <Input
                          id="paymentDate"
                          type="date"
                          value={paymentForm.paymentDate}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              paymentDate: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="paymentMethod">
                          Payment Method (Optional)
                        </FieldLabel>
                        <select
                          id="paymentMethod"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={paymentForm.paymentMethod}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              paymentMethod: e.target.value as "CASH" | "UPI" | "BANK_TRANSFER" | "",
                            })
                          }>
                          <option value="">Select payment method</option>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                        <FieldDescription>
                          How the repayment was made
                        </FieldDescription>
                      </Field>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1"
                          onClick={handleRepay}
                          disabled={repaying}>
                          {repaying ? "Processing..." : "Record Payment"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowPaymentForm(false);
                          }}
                          disabled={repaying}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {user?.role === "ADMIN" && loan.status === "ACTIVE" && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleMarkDefaulted}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Mark as Defaulted
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription className="mt-1">
                Complete payment breakdown (no interest)
                interest
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full sm:w-auto">
              {showSchedule ? "Hide" : "Show"} Schedule
            </Button>
          </div>
        </CardHeader>
        {showSchedule && (
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Principal Remaining</TableHead>
                    <TableHead>Principal Payment</TableHead>
                    <TableHead>Total Payment</TableHead>
                    <TableHead>New Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentSchedule.map((schedule, index) => {
                    const isPaid = loan.transactions.some(
                      (t) => t.month === schedule.month
                    );
                    return (
                      <TableRow
                        key={schedule.month}
                        className={
                          isPaid ? "bg-green-50 dark:bg-green-900/20" : ""
                        }>
                        <TableCell className="font-medium">
                          {schedule.month}
                          {isPaid && (
                            <CheckCircle2 className="ml-2 h-4 w-4 inline text-green-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          ₹{schedule.principalRemaining.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          ₹{schedule.principalPayment.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium">
                          ₹{schedule.totalPayment.toFixed(2)}
                        </TableCell>
                        <TableCell>₹{schedule.newBalance.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-3 sm:p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    Total Repayment:
                  </span>
                  <span className="ml-2 font-medium">
                    ₹
                    {paymentSchedule
                      .reduce((sum, s) => sum + s.totalPayment, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loan.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  loan.transactions.map((transaction, index) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>₹{transaction.amount.toFixed(2)}</TableCell>
                      <TableCell>₹{transaction.remaining.toFixed(2)}</TableCell>
                      <TableCell>{transaction.month}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
