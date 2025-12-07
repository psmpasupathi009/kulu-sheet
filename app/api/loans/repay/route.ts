import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, parseBody, handleApiError } from "@/lib/api-utils";
import { z } from "zod";

const repayLoanSchema = z.object({
  loanId: z.string().min(1, "Loan ID is required"),
  paymentDate: z.string(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parseResult = parseBody(body, repayLoanSchema);
    if (parseResult instanceof NextResponse) return parseResult;
    const { data } = parseResult;

    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        transactions: {
          orderBy: { month: "asc" },
        },
        group: {
          select: {
            monthlyAmount: true,
            totalMembers: true,
          },
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

    // Check if loan is already completed
    if (loan.currentMonth >= loan.months) {
      return NextResponse.json(
        { error: "Loan is already fully paid" },
        { status: 400 }
      );
    }

    const remainingMonths = loan.months - loan.currentMonth;
    const monthlyPayment = loan.group?.monthlyAmount || (loan.months > 0 ? loan.principal / loan.months : loan.remaining);
    const actualPayment = Math.min(monthlyPayment, loan.remaining);
    const nextMonth = loan.currentMonth + 1;
    const existingPayment = loan.transactions.find(t => t.month === nextMonth);
    if (existingPayment) {
      return NextResponse.json(
        { 
          error: `Payment for month ${nextMonth} has already been recorded on ${new Date(existingPayment.date).toLocaleDateString()}. Cannot record duplicate payment.`,
          existingPayment: {
            date: existingPayment.date,
            amount: existingPayment.amount,
            month: existingPayment.month,
          }
        },
        { status: 400 }
      );
    }

    const principalPayment = actualPayment;

    if (principalPayment > loan.remaining) {
      return NextResponse.json(
        { error: `Payment exceeds remaining balance. Remaining: ₹${loan.remaining.toFixed(2)}` },
        { status: 400 }
      );
    }

    const newRemaining = Math.max(0, loan.remaining - principalPayment);
    const newCurrentMonth = loan.currentMonth + 1;
    const newTotalPrincipalPaid = loan.totalPrincipalPaid + principalPayment;
    const newRemainingMonths = loan.months - newCurrentMonth;
    const isComplete = newCurrentMonth >= loan.months || newRemaining <= 0.01;
    const newStatus = isComplete ? "COMPLETED" : (loan.status === "PENDING" ? "ACTIVE" : loan.status);

    const member = await prisma.member.findUnique({
      where: { id: loan.memberId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

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

      let savings = await tx.savings.findFirst({
        where: { memberId: loan.memberId },
      });

      if (!savings) {
        savings = await tx.savings.create({
          data: {
            memberId: loan.memberId,
            totalAmount: 0,
          },
        });
      }

      const allSavingsTransactions = await tx.savingsTransaction.findMany({
        where: { savingsId: savings.id },
        orderBy: { date: 'asc' },
      });

      const currentSavingsTotal = allSavingsTransactions.reduce(
        (sum, t) => sum + Math.max(0, t.amount || 0),
        0
      );

      const newSavingsTotal = currentSavingsTotal + principalPayment;

      const savingsTransaction = await tx.savingsTransaction.create({
        data: {
          savingsId: savings.id,
          date: new Date(data.paymentDate),
          amount: principalPayment, // Loan repayment increases savings
          total: newSavingsTotal,
          },
        });

        await tx.savings.update({
        where: { id: savings.id },
        data: {
          totalAmount: newSavingsTotal,
        },
      });

      return { transaction, loan: updatedLoan, savingsTransaction };
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
          ? `Loan fully repaid! All ${loan.months} months completed. Total paid: ₹${newTotalPrincipalPaid.toFixed(2)}.` 
          : `Monthly payment of ₹${principalPayment.toFixed(2)} recorded. Progress: ${newCurrentMonth}/${loan.months} months. Remaining: ₹${newRemaining.toFixed(2)} over ${newRemainingMonths} month(s).`,
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

