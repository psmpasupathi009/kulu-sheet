import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const repayLoanSchema = z.object({
  loanId: z.string(),
  paymentDate: z.string().optional(), // Optional, defaults to now
  isLate: z.boolean().default(false),
  overdueMonths: z.number().int().min(0).default(0),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = repayLoanSchema.parse(body);

    // Get loan with member and cycle info
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: true,
        cycle: {
          include: {
            groupFund: true,
            group: {
              include: {
                members: {
                  where: { isActive: true },
                  include: { member: true },
                },
              },
            },
          },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Non-admin users can only repay their own loans
    // Check if user's userId matches member's userId
    if (user.role !== "ADMIN") {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { userId: true },
      });

      if (!userRecord?.userId || userRecord.userId !== loan.member.userId) {
        return NextResponse.json(
          { error: "Forbidden - You can only repay your own loans" },
          { status: 403 }
        );
      }
    }

    if (loan.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Loan already completed" },
        { status: 400 }
      );
    }

    // Calculate expected month based on disbursal date
    const disbursedDate = loan.disbursedAt
      ? new Date(loan.disbursedAt)
      : new Date();
    const paymentDate = data.paymentDate
      ? new Date(data.paymentDate)
      : new Date();

    // Calculate months since disbursal (approximate)
    const monthsSinceDisbursal = Math.floor(
      (paymentDate.getTime() - disbursedDate.getTime()) /
        (30 * 24 * 60 * 60 * 1000)
    );

    // Expected month = months since disbursal + 1 (month 1 starts immediately)
    const expectedMonth = monthsSinceDisbursal + 1;

    // Calculate missed months (if current month is behind expected month)
    const missedMonths = Math.max(0, expectedMonth - loan.currentMonth - 1);

    // Auto-detect if payment is late
    const isLate = missedMonths > 0 || data.isLate;
    const overdueMonths =
      data.overdueMonths > 0 ? data.overdueMonths : missedMonths;

    // Calculate monthly payment amount based on loan (no interest)
    // Monthly principal = total principal / total months
    const monthlyPrincipal = loan.principal / loan.months;

    // No interest in monthly ROSCA system
    const monthlyInterest = 0;

    // If there are missed months, calculate accumulated penalty
    let accumulatedPenalty = 0;

    if (missedMonths > 0) {
      // Penalty: 0.5% of remaining balance per missed month
      let tempRemaining = loan.remaining;
      for (let i = 0; i < missedMonths; i++) {
        accumulatedPenalty += (tempRemaining * 0.5) / 100;
      }
    }

    // Total monthly payment (principal only, no interest)
    const monthlyPayment = monthlyPrincipal;

    // Calculate new remaining balance
    const newRemaining = Math.max(0, loan.remaining - monthlyPrincipal);
    const newMonth = loan.currentMonth + 1 + missedMonths; // Advance by missed months + 1

    // Calculate payment breakdown
    const payment = {
      principal: monthlyPrincipal,
      interest: 0, // No interest
      total: monthlyPayment,
      newBalance: newRemaining,
    };

    // Calculate late penalty
    let latePenalty = accumulatedPenalty;
    if (
      data.isLate &&
      data.overdueMonths > 0 &&
      data.overdueMonths !== missedMonths
    ) {
      // Manual override if different from calculated
      let tempRemaining = loan.remaining;
      for (let i = 0; i < data.overdueMonths; i++) {
        latePenalty += (tempRemaining * 0.5) / 100;
      }
    }

    // Total payment includes: monthly payment + late penalty (no interest)
    const totalPayment = payment.total + latePenalty;

    // Update loan
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        remaining: payment.newBalance,
        currentMonth: newMonth,
        totalPrincipalPaid: loan.totalPrincipalPaid + payment.principal,
        status: payment.newBalance <= 0 ? "COMPLETED" : "ACTIVE",
        completedAt: payment.newBalance <= 0 ? paymentDate : null,
        latePaymentPenalty: loan.latePaymentPenalty + latePenalty,
      },
    });

    // Create transaction
    const transaction = await prisma.loanTransaction.create({
      data: {
        loanId: loan.id,
        date: paymentDate,
        amount: payment.principal,
        penalty: latePenalty, // Penalty recorded separately
        remaining: payment.newBalance,
        month: newMonth,
      },
    });

    // Update group fund if cycle exists
    if (loan.cycle?.groupFund) {
      const groupFund = loan.cycle.groupFund;

      await prisma.groupFund.update({
        where: { id: groupFund.id },
        data: {
          investmentPool: {
            increment: payment.principal,
          },
          totalFunds: {
            increment: payment.principal,
          },
        },
      });
    }

    return NextResponse.json(
      {
        loan: updatedLoan,
        transaction,
        payment: {
          principal: payment.principal,
          latePenalty,
          total: totalPayment,
          newBalance: payment.newBalance,
          monthlyAmount: monthlyPayment, // Total amount to pay per month
          missedMonths: missedMonths, // Number of months missed
          expectedMonth: expectedMonth, // Expected month based on date
          isLate: isLate, // Whether payment is late
        },
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

    console.error("Error processing loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to process repayment" },
      { status: 500 }
    );
  }
}
