import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const repayROSCALoanSchema = z.object({
  loanId: z.string(),
  paymentDate: z.string(),
  isFullRepayment: z.boolean().default(false), // Full repayment with penalties
});

/**
 * ROSCA Repayment Calculation:
 * - Principal: ₹600
 * - Interest (2% × 10 weeks): ₹120
 * - Total: ₹720
 * - Penalty on loan (10%): ₹60 (₹10 per member)
 * - Penalty on interest (10%): ₹12 (₹2 per member)
 * - Total repayment: ₹792
 * - Per member share: ₹112 (₹100 savings + ₹10 loan penalty + ₹2 interest penalty)
 */
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
    const data = repayROSCALoanSchema.parse(body);

    // Get loan with member, cycle, and group info
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: true,
        cycle: {
          include: {
            group: {
              include: {
                members: {
                  where: { isActive: true },
                },
              },
            },
            groupFund: true,
            collections: {
              include: {
                payments: {
                  include: {
                    member: true,
                  },
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

    const group = loan.cycle?.group;
    if (!group) {
      return NextResponse.json(
        { error: "Group not found for this loan" },
        { status: 404 }
      );
    }

    // Get active members count
    const activeMembersCount = group.members?.length || 1;

    // ROSCA Calculations (Monthly, No Interest)
    const principal = loan.principal; // Total loan amount
    const months = loan.months; // 10 months

    // Calculate penalties
    const loanPenalty = (principal * group.penaltyLoanPercent) / 100; // 10% of principal
    const totalPenalty = loanPenalty; // Only loan penalty

    // Total repayment amount (principal only, no interest)
    const totalRepayment = principal + totalPenalty;

    // Per member share breakdown
    const perMemberSavings = group.monthlyAmount || 2000; // ₹2000 per month
    const perMemberLoanPenalty = loanPenalty / activeMembersCount;
    const perMemberTotal =
      perMemberSavings + perMemberLoanPenalty; // Monthly amount + penalty share

    if (data.isFullRepayment) {
      // Full repayment: borrower pays principal + penalty, others pay monthly amount + penalty share
      const newRemaining = 0;
      const newMonth = months;

      // Update loan
      const updatedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          remaining: newRemaining,
          currentMonth: newMonth,
          totalPrincipalPaid: principal,
          totalPenalty: totalPenalty,
          status: "COMPLETED",
          completedAt: new Date(data.paymentDate),
        },
      });

      // Create transaction for borrower's full payment
      const borrowerTransaction = await prisma.loanTransaction.create({
        data: {
          loanId: loan.id,
          date: new Date(data.paymentDate),
          amount: principal,
          penalty: totalPenalty,
          remaining: newRemaining,
          month: newMonth,
        },
      });

      // Get all members in the cycle (for penalty distribution)
      const cycleMembers = await prisma.member.findMany({
        where: {
          id: {
            in:
              loan.cycle?.collections
                .flatMap((c) => c.payments.map((p) => p.memberId))
                .filter((id, index, arr) => arr.indexOf(id) === index) || [],
          },
        },
      });

      // Update group fund
      if (loan.cycle?.groupFund) {
        const groupFund = loan.cycle.groupFund;
        await prisma.groupFund.update({
          where: { id: groupFund.id },
          data: {
            investmentPool: {
              increment: principal, // Borrower repays principal
            },
            totalFunds: {
              increment: principal, // Total repayment (principal only)
            },
          },
        });
      }

      return NextResponse.json(
        {
          loan: updatedLoan,
          transaction: borrowerTransaction,
          repayment: {
            principal: principal,
            penalty: totalPenalty,
            total: totalRepayment,
            perMemberShare: perMemberTotal,
            breakdown: {
              perMemberSavings: perMemberSavings,
              perMemberLoanPenalty: perMemberLoanPenalty,
            },
          },
          message: `Loan fully repaid. Borrower paid ₹${totalRepayment.toFixed(
            2
          )}. Each member owes ₹${perMemberTotal.toFixed(
            2
          )} (₹${perMemberSavings.toFixed(
            2
          )} monthly investment + ₹${perMemberLoanPenalty.toFixed(
            2
          )} loan penalty share).`,
        },
        { status: 200 }
      );
    } else {
      // Partial monthly repayment
      const monthlyPrincipal = principal / months; // Principal per month
      const monthlyPayment = monthlyPrincipal; // Only principal
      const newRemaining = loan.remaining - monthlyPrincipal;
      const newMonth = loan.currentMonth + 1;

      // Update loan
      const updatedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          remaining: newRemaining,
          currentMonth: newMonth,
          totalPrincipalPaid: loan.totalPrincipalPaid + monthlyPrincipal,
          status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
          completedAt: newRemaining <= 0 ? new Date() : null,
        },
      });

      // Create transaction
      const transaction = await prisma.loanTransaction.create({
        data: {
          loanId: loan.id,
          date: new Date(data.paymentDate),
          amount: monthlyPrincipal,
          penalty: 0,
          remaining: newRemaining,
          month: newMonth,
        },
      });

      // Update group fund
      if (loan.cycle?.groupFund) {
        const groupFund = loan.cycle.groupFund;
        await prisma.groupFund.update({
          where: { id: groupFund.id },
        data: {
          investmentPool: {
            increment: monthlyPrincipal,
          },
          totalFunds: {
            increment: monthlyPayment,
          },
        },
        });
      }

      return NextResponse.json(
        {
          loan: updatedLoan,
          transaction,
          payment: {
            principal: monthlyPrincipal,
            total: monthlyPayment,
            newBalance: newRemaining,
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error processing ROSCA loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to process repayment" },
      { status: 500 }
    );
  }
}
