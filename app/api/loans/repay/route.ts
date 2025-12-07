import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const repayLoanSchema = z.object({
  loanId: z.string(),
  paymentDate: z.string().optional(), // Optional, defaults to now
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(), // Payment method for repayment
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
        cycle: true,
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

    // Calculate monthly payment amount based on loan
    // Monthly principal = total principal / total months (no interest, no penalty)
    const monthlyPrincipal = loan.principal / loan.months;

    // No interest, no penalty - only principal payments
    const monthlyPayment = monthlyPrincipal;
    const totalPayment = monthlyPayment;

    // Calculate new remaining balance
    const newRemaining = Math.max(0, loan.remaining - monthlyPrincipal);
    const newMonth = loan.currentMonth + 1; // Advance by 1 month

    // Calculate payment breakdown
    const payment = {
      principal: monthlyPrincipal,
      interest: 0, // No interest
      total: totalPayment, // Principal only
      newBalance: newRemaining,
    };

    // Update loan
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        remaining: payment.newBalance,
        currentMonth: newMonth,
        totalPrincipalPaid: loan.totalPrincipalPaid + payment.principal,
        status: payment.newBalance <= 0 ? "COMPLETED" : "ACTIVE",
        completedAt: payment.newBalance <= 0 ? paymentDate : null,
      },
    });

    // Create transaction
    const transaction = await prisma.loanTransaction.create({
      data: {
        loanId: loan.id,
        date: paymentDate,
        amount: payment.principal,
        remaining: payment.newBalance,
        month: newMonth,
        paymentMethod: data.paymentMethod || null,
      },
    });

    // Add repayment back to savings pool proportionally
    // Get all members who have savings
    const allMembers = await prisma.member.findMany({
      where: {
        savings: {
          some: {},
        },
      },
      include: {
        savings: true,
      },
    });

    if (allMembers.length > 0) {
      // Calculate total savings to determine distribution proportion
      const totalSavings = allMembers.reduce(
        (sum, m) => sum + (m.savings[0]?.totalAmount || 0),
        0
      );

      if (totalSavings > 0) {
        // Distribute repayment proportionally based on each member's savings
        const distributionPromises = allMembers.map(async (member) => {
          const memberSavings = member.savings[0]?.totalAmount || 0;
          const savingsPercentage = memberSavings / totalSavings;
          const repaymentShare = payment.principal * savingsPercentage;

          if (repaymentShare > 0) {
            let savings = member.savings[0];
            if (!savings) {
              savings = await prisma.savings.create({
                data: {
                  memberId: member.id,
                  totalAmount: 0,
                },
              });
            }

            // Add repayment share to member's savings
            const newTotal = savings.totalAmount + repaymentShare;
            await prisma.savingsTransaction.create({
              data: {
                savingsId: savings.id,
                date: paymentDate,
                amount: repaymentShare,
                total: newTotal,
              },
            });

            await prisma.savings.update({
              where: { id: savings.id },
              data: {
                totalAmount: newTotal,
              },
            });
          }
        });

        await Promise.all(distributionPromises);
      } else {
        // If no savings exist, distribute equally among all members
        const equalShare = payment.principal / allMembers.length;
        const distributionPromises = allMembers.map(async (member) => {
          let savings = member.savings[0];
          if (!savings) {
            savings = await prisma.savings.create({
              data: {
                memberId: member.id,
                totalAmount: 0,
              },
            });
          }

          const newTotal = savings.totalAmount + equalShare;
          await prisma.savingsTransaction.create({
            data: {
              savingsId: savings.id,
              date: paymentDate,
              amount: equalShare,
              total: newTotal,
            },
          });

          await prisma.savings.update({
            where: { id: savings.id },
            data: {
              totalAmount: newTotal,
            },
          });
        });

        await Promise.all(distributionPromises);
      }
    }

    return NextResponse.json(
      {
        loan: updatedLoan,
        transaction,
        payment: {
          principal: payment.principal,
          total: payment.total,
          newBalance: payment.newBalance,
          monthlyAmount: monthlyPayment, // Total amount to pay per month (principal only)
          paymentMethod: data.paymentMethod || null,
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
