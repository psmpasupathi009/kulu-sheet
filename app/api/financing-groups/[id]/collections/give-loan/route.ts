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

    // Create loan from the pooled collection (no deduction from savings)
    // The loan comes from the collection, not from individual savings
    const result = await prisma.$transaction(
      async (tx) => {
        // Create loan
        const loan = await tx.loan.create({
          data: {
            memberId: loanMember.memberId,
            groupId: groupId,
            principal: loanAmount,
            remaining: loanAmount,
            months: group.totalMembers, // Loan duration matches financing group total members
            currentMonth: 0,
            status: "ACTIVE",
            disbursedAt: disbursedDate,
            disbursementMethod: data.disbursementMethod || null,
          },
        });

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

    return NextResponse.json(
      {
        loan: result.loan,
        message: `Loan of ₹${loanAmount.toFixed(2)} disbursed successfully to ${result.member.name}`,
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

