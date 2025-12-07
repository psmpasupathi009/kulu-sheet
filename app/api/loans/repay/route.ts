import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const repayLoanSchema = z.object({
  loanId: z.string().min(1, "Loan ID is required"),
  paymentDate: z.string(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = repayLoanSchema.parse(body);

    // Get loan with transactions
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        transactions: {
          orderBy: { month: "asc" },
        },
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    if (loan.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Loan is already completed" },
        { status: 400 }
      );
    }

    if (loan.status === "DEFAULTED") {
      return NextResponse.json(
        { error: "Cannot make payment on defaulted loan" },
        { status: 400 }
      );
    }

    // Simple monthly payment: principal / months (no interest, no penalties)
    const monthlyPayment = loan.principal / loan.months;
    
    // Check if loan is already completed
    if (loan.currentMonth >= loan.months) {
      return NextResponse.json(
        { error: "Loan is already fully paid" },
        { status: 400 }
      );
    }

    // Calculate next month to pay
    const nextMonth = loan.currentMonth + 1;

    // Check if payment for this month already exists (prevent duplicates)
    const existingPayment = loan.transactions.find(t => t.month === nextMonth);
    if (existingPayment) {
      return NextResponse.json(
        { error: `Payment for month ${nextMonth} has already been recorded. Please proceed to the next month.` },
        { status: 400 }
      );
    }

    // Calculate payment amount (one month's payment)
    const principalPayment = Math.min(monthlyPayment, loan.remaining);

    // Check if payment exceeds remaining
    if (principalPayment > loan.remaining) {
      return NextResponse.json(
        { error: `Payment exceeds remaining balance. Remaining: ₹${loan.remaining.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Calculate new values after payment
    const newRemaining = Math.max(0, loan.remaining - principalPayment);
    const newCurrentMonth = loan.currentMonth + 1;
    const newTotalPrincipalPaid = loan.totalPrincipalPaid + principalPayment;

    // Check if loan is complete (all months paid)
    const isComplete = newCurrentMonth >= loan.months || newRemaining <= 0.01;
    const newStatus = isComplete ? "COMPLETED" : (loan.status === "PENDING" ? "ACTIVE" : loan.status);

    // Create transaction and update loan in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create loan transaction
      const transaction = await tx.loanTransaction.create({
        data: {
          loanId: loan.id,
          date: new Date(data.paymentDate),
          amount: principalPayment,
          remaining: newRemaining,
          month: newCurrentMonth,
          paymentMethod: data.paymentMethod || null,
        },
      });

      // Update loan
      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          remaining: newRemaining,
          currentMonth: newCurrentMonth,
          totalPrincipalPaid: newTotalPrincipalPaid,
          status: newStatus,
          completedAt: newRemaining <= 0.01 ? new Date() : null,
        },
      });

      return { transaction, loan: updatedLoan };
    });

    return NextResponse.json(
      {
        payment: {
          id: result.transaction.id,
          amount: principalPayment,
          remaining: newRemaining,
          month: newCurrentMonth,
        },
        loan: result.loan,
        message: newStatus === "COMPLETED" 
          ? `Loan fully repaid! All ${loan.months} months completed.` 
          : `Monthly payment of ₹${principalPayment.toFixed(2)} recorded. Progress: ${newCurrentMonth}/${loan.months} months`,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error recording loan payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record payment" },
      { status: 500 }
    );
  }
}

