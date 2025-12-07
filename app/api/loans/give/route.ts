import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const giveLoanSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  principal: z.number().positive("Loan amount must be positive"),
  months: z.number().int().positive().default(10),
  reason: z.string().optional(),
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
    const data = giveLoanSchema.parse(body);

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Verify guarantors if provided
    if (data.guarantor1Id) {
      const guarantor1 = await prisma.member.findUnique({
        where: { id: data.guarantor1Id },
      });
      if (!guarantor1) {
        return NextResponse.json(
          { error: "Guarantor 1 not found" },
          { status: 404 }
        );
      }
    }

    if (data.guarantor2Id) {
      const guarantor2 = await prisma.member.findUnique({
        where: { id: data.guarantor2Id },
      });
      if (!guarantor2) {
        return NextResponse.json(
          { error: "Guarantor 2 not found" },
          { status: 404 }
        );
      }
    }

    const loanAmount = data.principal;
    const disbursedDate = new Date();

    // Create loan and deduct from savings pool in a transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // Get all members with savings to deduct proportionally
        const allMembersWithSavings = await tx.member.findMany({
          where: {
            savings: {
              some: {
                totalAmount: {
                  gt: 0,
                },
              },
            },
          },
          include: {
            savings: true,
          },
        });

        if (allMembersWithSavings.length === 0) {
          throw new Error("No savings available to disburse loan");
        }

        // Calculate total savings
        const totalSavings = allMembersWithSavings.reduce(
          (sum, m) =>
            sum + m.savings.reduce((s, saving) => s + saving.totalAmount, 0),
          0
        );

        if (totalSavings < loanAmount) {
          throw new Error(
            `Insufficient savings. Available: ₹${totalSavings.toFixed(2)}, Required: ₹${loanAmount.toFixed(2)}`
          );
        }

        // Deduct loan amount proportionally from all members' savings
        let remainingLoanAmount = loanAmount;
        const savingsUpdates = [];

        for (const memberWithSavings of allMembersWithSavings) {
          const memberTotalSavings = memberWithSavings.savings.reduce(
            (sum, saving) => sum + saving.totalAmount,
            0
          );
          const proportion = memberTotalSavings / totalSavings;
          const deductionAmount = Math.min(
            remainingLoanAmount,
            memberTotalSavings * proportion
          );

          if (deductionAmount > 0) {
            // Deduct from each savings account proportionally
            for (const saving of memberWithSavings.savings) {
              if (remainingLoanAmount <= 0) break;

              const savingProportion = saving.totalAmount / memberTotalSavings;
              const savingDeduction = Math.min(
                remainingLoanAmount,
                deductionAmount * savingProportion
              );

              if (savingDeduction > 0 && saving.totalAmount > 0) {
                const newTotalAmount = Math.max(
                  0,
                  saving.totalAmount - savingDeduction
                );

                savingsUpdates.push(
                  tx.savings.update({
                    where: { id: saving.id },
                    data: { totalAmount: newTotalAmount },
                  })
                );

                // Create savings transaction
                savingsUpdates.push(
                  tx.savingsTransaction.create({
                    data: {
                      savingsId: saving.id,
                      date: disbursedDate,
                      amount: -savingDeduction,
                      total: newTotalAmount,
                    },
                  })
                );

                remainingLoanAmount -= savingDeduction;
              }
            }
          }
        }

        // Execute all savings updates in parallel
        await Promise.all(savingsUpdates);

        // Create loan
        const loan = await tx.loan.create({
          data: {
            memberId: data.memberId,
            principal: loanAmount,
            remaining: loanAmount,
            months: data.months,
            currentMonth: 0,
            status: "ACTIVE",
            disbursedAt: disbursedDate,
            reason: data.reason || null,
            guarantor1Id: data.guarantor1Id || null,
            guarantor2Id: data.guarantor2Id || null,
            disbursementMethod: data.disbursementMethod || null,
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
        message: `Loan of ₹${loanAmount.toFixed(2)} disbursed successfully to ${member.name}`,
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

    console.error("Error giving loan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to give loan" },
      { status: 500 }
    );
  }
}

