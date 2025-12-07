import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createCycleSchema = z.object({
  memberId: z.string().min(1, "Member is required"), // Member receiving the loan
  loanAmount: z.number().positive("Loan amount must be positive"),
  loanMonths: z
    .number()
    .int()
    .positive("Loan duration must be positive")
    .default(10),
  monthlyAmount: z.number().positive().optional(), // Monthly contribution amount
  reason: z.string().optional(), // Reason for the loan
  disbursedAt: z.string().optional(), // Optional disbursal date
  disbursementMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
  guarantor1Id: z.string().optional(),
  guarantor2Id: z.string().optional(),
});

export async function GET(request: NextRequest) {
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

    const cycles = await prisma.loanCycle.findMany({
      include: {
        loans: {
          include: { member: true },
        },
        sequences: {
          include: { member: true },
          orderBy: { month: "asc" },
        },
      },
      orderBy: { cycleNumber: "desc" },
    });

    return NextResponse.json({ cycles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching cycles:", error);
    return NextResponse.json(
      { error: "Failed to fetch cycles" },
      { status: 500 }
    );
  }
}

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
    const data = createCycleSchema.parse(body);

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get all members who have savings to calculate total members
    const allMembers = await prisma.member.findMany({
      where: {
        savings: {
          some: {},
        },
      },
    });

    // Get the next cycle number
    const lastCycle = await prisma.loanCycle.findFirst({
      orderBy: { cycleNumber: "desc" },
    });

    const cycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    // Calculate start date (disbursal date or now)
    const startDate = data.disbursedAt
      ? new Date(data.disbursedAt)
      : new Date();

    // Get all savings to deduct from
    const allSavings = await prisma.savings.findMany({
      include: {
        member: true,
      },
    });

    const totalSavings = allSavings.reduce(
      (sum, s) => sum + s.totalAmount,
      0
    );

    if (totalSavings < data.loanAmount) {
      return NextResponse.json(
        {
          error: `Insufficient savings pool. Available: ₹${totalSavings.toFixed(2)}, Required: ₹${data.loanAmount.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Create cycle and loan in a transaction with increased timeout
    const result = await prisma.$transaction(
      async (tx) => {
        // Create cycle
        const cycle = await tx.loanCycle.create({
          data: {
            cycleNumber: cycleNumber,
            startDate: startDate,
            monthlyAmount: data.monthlyAmount || 2000,
            totalMembers: allMembers.length,
            isActive: true,
          },
        });

        // Deduct loan amount from savings pool proportionally
        // Calculate how much to deduct from each member's savings based on their contribution
        let remainingLoanAmount = data.loanAmount;
        const savingsDeductions: Array<{ savingsId: string; amount: number; currentTotal: number }> = [];

        // Sort savings by amount (descending) to deduct from largest first
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

        // Batch update savings using updateMany where possible
        // For each savings account, update and create transaction
        const savingsUpdatePromises = savingsDeductions.map(async (deduction) => {
          const newTotal = deduction.currentTotal - deduction.amount;
          
          // Update savings
          await tx.savings.update({
            where: { id: deduction.savingsId },
            data: { totalAmount: newTotal },
          });

          // Create savings transaction to record the deduction
          await tx.savingsTransaction.create({
            data: {
              savingsId: deduction.savingsId,
              date: startDate,
              amount: -deduction.amount, // Negative for deduction
              total: newTotal,
            },
          });
        });

        // Execute all savings updates in parallel
        await Promise.all(savingsUpdatePromises);

        // Create and disburse the loan
        const loan = await tx.loan.create({
          data: {
            memberId: data.memberId,
            cycleId: cycle.id,
            principal: data.loanAmount,
            remaining: data.loanAmount,
            months: data.loanMonths,
            currentMonth: 0,
            status: "ACTIVE",
            disbursedAt: startDate,
            disbursementMethod: data.disbursementMethod || null,
            guarantor1Id: data.guarantor1Id || null,
            guarantor2Id: data.guarantor2Id || null,
            ...(data.reason && { reason: data.reason }),
          },
        });

        return { cycle, loan };
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot
        timeout: 15000, // Maximum time the transaction can run (15 seconds)
      }
    );

    return NextResponse.json(
      {
        cycle: result.cycle,
        loan: result.loan,
        message: "Loan cycle created and loan disbursed successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating cycle:", error);
    return NextResponse.json(
      { error: "Failed to create cycle" },
      { status: 500 }
    );
  }
}
