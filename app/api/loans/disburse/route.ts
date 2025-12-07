import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const disburseLoanSchema = z.object({
  sequenceId: z.string(),
  disbursedAt: z.string().optional(),
  guarantor1Id: z.string().optional(),
  guarantor2Id: z.string().optional(),
  disbursementMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
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
    const data = disburseLoanSchema.parse(body);

    // Get sequence with cycle and member
    const sequence = await prisma.loanSequence.findUnique({
      where: { id: data.sequenceId },
      include: {
        cycle: true,
        member: true,
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Loan sequence not found" },
        { status: 404 }
      );
    }

    if (sequence.status === "DISBURSED") {
      return NextResponse.json(
        { error: "Loan already disbursed" },
        { status: 400 }
      );
    }

    const loanAmount = sequence.loanAmount;
    const disbursedDate = data.disbursedAt ? new Date(data.disbursedAt) : new Date();

    // Get all savings to deduct from
    const allSavings = await prisma.savings.findMany({
      include: { member: true },
    });

    const totalSavings = allSavings.reduce(
      (sum, s) => sum + s.totalAmount,
      0
    );

    if (totalSavings < loanAmount) {
      return NextResponse.json(
        {
          error: `Insufficient savings pool. Available: ₹${totalSavings.toFixed(2)}, Required: ₹${loanAmount.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Create loan and deduct from savings in a transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // Deduct loan amount from savings pool proportionally
        let remainingLoanAmount = loanAmount;
        const savingsDeductions: Array<{ savingsId: string; amount: number; currentTotal: number }> = [];

        const sortedSavings = [...allSavings].sort(
          (a, b) => b.totalAmount - a.totalAmount
        );

        for (const savings of sortedSavings) {
          if (remainingLoanAmount <= 0) break;

          const deductionAmount = Math.min(
            remainingLoanAmount,
            savings.totalAmount
          );

          if (deductionAmount > 0) {
            savingsDeductions.push({
              savingsId: savings.id,
              amount: deductionAmount,
              currentTotal: savings.totalAmount,
            });
            remainingLoanAmount -= deductionAmount;
          }
        }

        // Apply deductions
        await Promise.all(
          savingsDeductions.map(async (deduction) => {
            const newTotal = deduction.currentTotal - deduction.amount;
            
            await tx.savings.update({
              where: { id: deduction.savingsId },
              data: { totalAmount: newTotal },
            });

            await tx.savingsTransaction.create({
              data: {
                savingsId: deduction.savingsId,
                date: disbursedDate,
                amount: -deduction.amount,
                total: newTotal,
              },
            });
          })
        );

        // Create loan
        const loan = await tx.loan.create({
          data: {
            memberId: sequence.memberId,
            cycleId: sequence.cycleId,
            sequenceId: sequence.id,
            principal: loanAmount,
            remaining: loanAmount,
            months: 10, // 10 months repayment
            currentMonth: 0,
            status: "ACTIVE",
            disbursedAt: disbursedDate,
            guarantor1Id: data.guarantor1Id || null,
            guarantor2Id: data.guarantor2Id || null,
            disbursementMethod: data.disbursementMethod || null,
          },
        });

        // Update sequence
        await tx.loanSequence.update({
          where: { id: sequence.id },
          data: {
            status: "DISBURSED",
            disbursedAt: disbursedDate,
          },
        });

        return { loan };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    return NextResponse.json(
      {
        loan: result.loan,
        message: "Loan disbursed successfully",
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

    console.error("Error disbursing loan:", error);
    return NextResponse.json(
      { error: "Failed to disburse loan" },
      { status: 500 }
    );
  }
}
