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
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { ArrowLeft, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  cycle?: {
    cycleNumber: number;
    startDate: string;
    totalMembers: number;
    monthlyAmount: number;
  } | null;
  sequence?: {
    month: number;
    loanAmount: number;
    status: string;
  } | null;
  principal: number;
  remaining: number;
  currentMonth: number;
  months: number;
  status: string;
  totalPrincipalPaid: number;
  latePaymentPenalty: number;
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
    isLate: false,
    overdueMonths: 0,
    paymentMethod: "" as "CASH" | "UPI" | "BANK_TRANSFER" | "",
  });

  // Calculate monthly payment amount based on loan (no interest)
  const calculateMonthlyPayment = (loan: Loan) => {
    if (!loan) return { principal: 0, total: 0 };
    const monthlyPrincipal = loan.principal / loan.months;
    return {
      principal: monthlyPrincipal,
      total: monthlyPrincipal,
    };
  };

  // Calculate missed months and penalties
  const calculateMissedMonths = (loan: Loan) => {
    if (!loan || !loan.disbursedAt)
      return {
        missedMonths: 0,
        expectedMonth: loan?.currentMonth || 0,
        isLate: false,
      };

    const disbursedDate = new Date(loan.disbursedAt);
    const today = new Date();
    const monthsSinceDisbursal = Math.floor(
      (today.getTime() - disbursedDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
    );
    const expectedMonth = monthsSinceDisbursal + 1;
    const missedMonths = Math.max(0, expectedMonth - loan.currentMonth - 1);

    // Calculate penalty for missed months (no interest)
    let accumulatedPenalty = 0;
    if (missedMonths > 0) {
      let tempRemaining = loan.remaining;
      for (let i = 0; i < missedMonths; i++) {
        accumulatedPenalty += (tempRemaining * 0.5) / 100;
      }
    }

    return {
      missedMonths,
      expectedMonth,
      isLate: missedMonths > 0,
      accumulatedPenalty,
      totalPenalty: accumulatedPenalty,
    };
  };

  const monthlyPayment = loan
    ? calculateMonthlyPayment(loan)
    : { principal: 0, total: 0 };

  const missedMonthsInfo = loan
    ? calculateMissedMonths(loan)
    : {
        missedMonths: 0,
        expectedMonth: 0,
        isLate: false,
        accumulatedPenalty: 0,
        totalPenalty: 0,
      };
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    setError("");
    setSuccess("");
    setRepaying(true);
    try {
      const response = await fetch("/api/loans/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          paymentDate: paymentForm.paymentDate,
          isLate: paymentForm.isLate,
          overdueMonths: paymentForm.overdueMonths,
          paymentMethod: paymentForm.paymentMethod || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let successMessage = `Payment of ₹${data.payment.total.toFixed(
          2
        )} recorded successfully!`;

        if (data.payment.missedMonths > 0) {
          successMessage += `\n⚠️ ${
            data.payment.missedMonths
          } month(s) missed - Penalty: ₹${data.payment.latePenalty.toFixed(
            2
          )} included.`;
        }

        setSuccess(successMessage);
        setShowPaymentForm(false);
        setPaymentForm({
          paymentDate: new Date().toISOString().split("T")[0],
          isLate: false,
          overdueMonths: 0,
          paymentMethod: "",
        });
        // Refresh loan data
        await fetchLoan(loan.id);
        setTimeout(() => setSuccess(""), 5000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      setError("Failed to record payment");
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
        setSuccess("Loan marked as defaulted");
        await fetchLoan(loan.id);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update loan status");
      }
    } catch (error) {
      console.error("Error updating loan:", error);
      setError("Failed to update loan status");
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
              <>
                {missedMonthsInfo.missedMonths > 0 && (
                  <div className="flex justify-between border-t pt-2 mt-2 items-center">
                    <span className="font-semibold text-red-600">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      Missed Months:
                    </span>
                    <span className="font-bold text-lg text-red-600">
                      {missedMonthsInfo.missedMonths} month(s)
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-muted-foreground font-semibold">
                    Monthly Payment:
                  </span>
                  <span
                    className={`font-bold text-lg ${
                      missedMonthsInfo.missedMonths > 0
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}>
                    ₹
                    {(
                      monthlyPayment.total + (missedMonthsInfo.totalPenalty ?? 0)
                    ).toFixed(2)}
                    {missedMonthsInfo.missedMonths > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (includes penalty)
                      </span>
                    )}
                  </span>
                </div>
              </>
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
            <div className="flex justify-between">
            </div>
            {loan.cycle && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cycle:</span>
                <span className="font-medium">#{loan.cycle.cycleNumber}</span>
              </div>
            )}
            {loan.sequence && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rotation Month:</span>
                <span className="font-medium">Month {loan.sequence.month}</span>
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
            {loan.latePaymentPenalty > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Late Penalty:</span>
                <span className="font-medium text-red-600">
                  ₹{loan.latePaymentPenalty.toFixed(2)}
                </span>
              </div>
            )}
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
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      {success && (
                        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            {success}
                          </AlertDescription>
                        </Alert>
                      )}
                      {missedMonthsInfo.missedMonths > 0 && (
                        <Alert variant="destructive" className="mb-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="font-semibold mb-1">
                              ⚠️ {missedMonthsInfo.missedMonths} Month(s) Missed
                              Payment
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="text-red-600">
                                Expected Month: {missedMonthsInfo.expectedMonth} |
                                Current: {loan.currentMonth + 1}
                              </div>
                              <div className="text-red-600">
                                Accumulated Interest: ₹0.00 (No interest)
                              </div>
                              <div className="text-red-600">
                                Late Penalty: ₹
                                {(missedMonthsInfo.accumulatedPenalty ?? 0).toFixed(2)}{" "}
                                (0.5% per month)
                              </div>
                              <div className="font-semibold mt-1 text-red-600">
                                Additional Amount Due: ₹
                                {(missedMonthsInfo.totalPenalty ?? 0).toFixed(2)}
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div
                        className={`p-3 rounded-lg border ${
                          missedMonthsInfo.missedMonths > 0
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        }`}>
                        <div
                          className={`text-sm font-semibold mb-2 ${
                            missedMonthsInfo.missedMonths > 0
                              ? "text-red-900 dark:text-red-100"
                              : "text-blue-900 dark:text-blue-100"
                          }`}>
                          Payment Breakdown
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Principal:
                            </span>
                            <span className="font-medium">
                              ₹{monthlyPayment.principal.toFixed(2)}
                            </span>
                          </div>
                          {missedMonthsInfo.missedMonths > 0 && (
                            <>
                              <div className="flex justify-between text-red-600">
                                <span className="text-muted-foreground">
                                  Accumulated Interest:
                                </span>
                                <span className="font-medium">
                                  ₹0.00 (No interest)
                                </span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                <span className="text-muted-foreground">
                                  Late Penalty:
                                </span>
                                <span className="font-medium">
                                  ₹
                                  {(missedMonthsInfo.accumulatedPenalty ?? 0).toFixed(
                                    2
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between border-t pt-1 mt-1">
                            <span className="font-semibold">
                              Total Payment:
                            </span>
                            <span
                              className={`font-bold ${
                                missedMonthsInfo.missedMonths > 0
                                  ? "text-red-600"
                                  : "text-blue-600"
                              }`}>
                              ₹
                              {(
                                monthlyPayment.total +
                                (missedMonthsInfo.totalPenalty ?? 0)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <FieldDescription className="mt-2">
                          {missedMonthsInfo.missedMonths > 0
                            ? "Penalties for missed months are automatically included"
                            : "This amount will be automatically calculated and recorded"}
                        </FieldDescription>
                      </div>
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
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentForm.isLate}
                            onChange={(e) =>
                              setPaymentForm({
                                ...paymentForm,
                                isLate: e.target.checked,
                                overdueMonths: e.target.checked
                                  ? paymentForm.overdueMonths
                                  : 0,
                              })
                            }
                            className="rounded"
                          />
                          <span className="text-sm">
                            This is a late payment
                          </span>
                        </label>
                      </Field>
                      {paymentForm.isLate && (
                        <Field>
                          <FieldLabel htmlFor="overdueMonths">
                            Overdue Months
                          </FieldLabel>
                          <Input
                            id="overdueMonths"
                            type="number"
                            min="0"
                            value={paymentForm.overdueMonths}
                            onChange={(e) =>
                              setPaymentForm({
                                ...paymentForm,
                                overdueMonths: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                          <FieldDescription>
                            Number of months overdue (0.5% penalty per week)
                          </FieldDescription>
                        </Field>
                      )}
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
                            setError("");
                            setSuccess("");
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
