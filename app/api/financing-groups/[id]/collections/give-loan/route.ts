import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const giveLoanSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  disbursementMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: groupId } = await params;
    const body = await request.json();
    const data = giveLoanSchema.parse(body);

    // Get group with current collection
    const group = await prisma.financingGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            member: true,
          },
        },
        collections: {
          where: {
            isCompleted: true,
            loanDisbursed: false,
          },
          orderBy: { month: "desc" },
          take: 1,
          include: {
            payments: {
              where: {
                status: "PAID",
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    const collection = group.collections[0];
    if (!collection) {
      return NextResponse.json(
        { error: "No completed collection found for loan disbursement" },
        { status: 400 }
      );
    }

    // Find the selected member
    const loanMember = group.members.find(
      (gm) => gm.memberId === data.memberId
    );

    if (!loanMember) {
      return NextResponse.json(
        { error: "Selected member is not part of this group" },
        { status: 400 }
      );
    }

    // Check if this member already received a loan in this group
    const existingLoan = await prisma.loan.findFirst({
      where: {
        groupId: groupId,
        memberId: data.memberId,
      },
    });

    if (existingLoan) {
      return NextResponse.json(
        { error: "This member has already received a loan in this group. Each member can receive only one loan per financing group." },
        { status: 400 }
      );
    }

    const loanAmount = collection.totalCollected; // Pooled amount from all members
    const disbursedDate = new Date();

    // Repayment formula: repaymentMonths = totalMembers - loanMonth + 1
    // Example: 4 members, loan in month 1 → repays 4 months (4 - 1 + 1 = 4)
    // Example: 4 members, loan in month 2 → repays 3 months (4 - 2 + 1 = 3)
    // Example: 4 members, loan in month 4 → repays 1 month (4 - 4 + 1 = 1)
    const loanMonth = collection.month; // Month when loan is being disbursed
    const repaymentMonths = group.totalMembers - loanMonth + 1;
    
    // Check if the member has already paid in the collection month
    // If they paid ₹2000 in month 1, that counts towards the loan repayment
    // So remaining loan = total loan - their contribution in that month
    const memberPayment = collection.payments?.find(
      (p) => p.memberId === loanMember.memberId && p.status === "PAID"
    );

    const memberContribution = memberPayment?.amount || 0;
    const remainingLoanAmount = loanAmount - memberContribution;
    
    // Create loan from the pooled collection (no deduction from savings)
    // The loan comes from the collection, not from individual savings
    const result = await prisma.$transaction(
      async (tx) => {
        // Create loan
        // If member already paid in the loan month, mark that month as paid (currentMonth = 1)
        // Otherwise, start from 0
        const initialCurrentMonth = memberContribution > 0 ? 1 : 0;
        
        const loan = await tx.loan.create({
          data: {
            memberId: loanMember.memberId,
            groupId: groupId,
            principal: loanAmount, // Full loan amount received
            remaining: remainingLoanAmount, // Remaining after deducting their contribution
            months: repaymentMonths, // Total months member must pay (totalMembers - loanMonth + 1)
            loanMonth: loanMonth, // Record which month loan was disbursed
            currentMonth: initialCurrentMonth, // Start at 1 if they already paid in loan month, else 0
            status: "ACTIVE",
            disbursedAt: disbursedDate,
            disbursementMethod: data.disbursementMethod || null,
            totalPrincipalPaid: memberContribution, // Their contribution counts as first payment
          },
        });

        // If member already paid in the loan month, create a transaction record for it
        if (memberContribution > 0) {
          await tx.loanTransaction.create({
            data: {
              loanId: loan.id,
              date: memberPayment?.paymentDate || disbursedDate,
              amount: memberContribution,
              remaining: remainingLoanAmount,
              month: 1, // First month payment
              paymentMethod: memberPayment?.paymentMethod || null,
            },
          });
        }

        // Update collection
        await tx.monthlyCollection.update({
          where: { id: collection.id },
          data: {
            loanMemberId: loanMember.memberId,
            loanAmount: loanAmount,
            loanDisbursed: true,
          },
        });

        // Check if all members have received loans (financing group cycle complete)
        // Count all loans (ACTIVE, COMPLETED, PENDING) for this group
        const loansGiven = await tx.loan.count({
          where: {
            groupId: groupId,
          },
        });

        // If all members have received loans, mark group as inactive
        if (loansGiven >= group.totalMembers) {
          await tx.financingGroup.update({
            where: { id: groupId },
            data: {
              isActive: false,
              endDate: disbursedDate,
            },
          });
        }

        return { loan, member: loanMember.member };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    const message = memberContribution > 0
      ? `Loan of ₹${loanAmount.toFixed(2)} disbursed successfully to ${result.member.name}. Their contribution of ₹${memberContribution.toFixed(2)} in month ${loanMonth} is already counted. Remaining to repay: ₹${remainingLoanAmount.toFixed(2)} over ${repaymentMonths - 1} months.`
      : `Loan of ₹${loanAmount.toFixed(2)} disbursed successfully to ${result.member.name}. Remaining to repay: ₹${remainingLoanAmount.toFixed(2)} over ${repaymentMonths} months.`;

    return NextResponse.json(
      {
        loan: result.loan,
        message,
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

