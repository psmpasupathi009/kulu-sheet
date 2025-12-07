import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const addMemberToCycleSchema = z.object({
  memberId: z.string(),
  monthlyAmount: z.number().positive(),
  joiningDate: z.string(),
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

    const { id: cycleId } = await params;
    const body = await request.json();
    const data = addMemberToCycleSchema.parse(body);

    // Get cycle
    const cycle = await prisma.loanCycle.findUnique({
      where: { id: cycleId },
      include: {
        sequences: {
          include: {
            loan: true, // Check if loan was disbursed
          },
          orderBy: { month: "asc" },
        },
        collections: {
          orderBy: { month: "asc" },
        },
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if member is already in cycle
    const existingSequence = cycle.sequences.find(
      (seq) => seq.memberId === data.memberId
    );

    if (existingSequence) {
      return NextResponse.json(
        { error: "Member is already in this cycle" },
        { status: 400 }
      );
    }

    // Calculate catch-up payment: monthlyAmount * number of months loans have already been given
    // Count how many sequences have been disbursed (loans already given)
    const loansAlreadyGiven = cycle.sequences.filter(
      (seq) => seq.status === "DISBURSED" || seq.loan !== null
    ).length;

    // New member pays: monthlyAmount * number of months loans have already been given
    const catchUpAmount = data.monthlyAmount * loansAlreadyGiven;
    const nextAvailableMonth =
      cycle.sequences.length > 0
        ? Math.max(...cycle.sequences.map((s) => s.month)) + 1
        : cycle.currentMonth + 1;

    // Calculate loan amount for this member (pooled amount = monthlyAmount * totalMembers after adding this member)
    const newTotalMembers = cycle.totalMembers + 1;
    const loanAmount = cycle.monthlyAmount * newTotalMembers;

    // Create sequence for the member
    const result = await prisma.$transaction(async (tx) => {
      // Update cycle total members
      await tx.loanCycle.update({
        where: { id: cycleId },
        data: {
          totalMembers: newTotalMembers,
        },
      });

      // Update existing PENDING sequences' loan amounts to reflect new total
      // Since we're adding a member, the pooled amount increases for future loans
      // Only update sequences that haven't been disbursed yet
      await Promise.all(
        cycle.sequences
          .filter((seq) => seq.status === "PENDING")
          .map(async (seq) => {
            await tx.loanSequence.update({
              where: { id: seq.id },
              data: {
                loanAmount: loanAmount, // Update to new pooled amount
              },
            });
          })
      );

      // Create loan sequence for new member
      const sequence = await tx.loanSequence.create({
        data: {
          cycleId: cycleId,
          memberId: data.memberId,
          month: nextAvailableMonth,
          loanAmount: loanAmount, // Pooled amount = monthlyAmount * newTotalMembers
          status: "PENDING",
        },
      });

      // If catch-up payment is required, create a collection payment record
      if (catchUpAmount > 0 && cycle.collections.length > 0) {
        // Find or create collection for catch-up (use latest collection)
        const latestCollection = cycle.collections[cycle.collections.length - 1];
        
        // Create catch-up payment record
        await tx.collectionPayment.create({
          data: {
            collectionId: latestCollection.id,
            memberId: data.memberId,
            amount: catchUpAmount,
            paymentDate: new Date(data.joiningDate),
            paymentMethod: "CASH", // Default, can be updated
            status: "PAID",
          },
        });

        // Update collection total
        await tx.monthlyCollection.update({
          where: { id: latestCollection.id },
          data: {
            totalCollected: {
              increment: catchUpAmount,
            },
          },
        });

        // Add catch-up payment to member's savings
        let savings = await tx.savings.findFirst({
          where: { memberId: data.memberId },
        });

        if (!savings) {
          savings = await tx.savings.create({
            data: {
              memberId: data.memberId,
              totalAmount: 0,
            },
          });
        }

        const newTotal = savings.totalAmount + catchUpAmount;
        await tx.savingsTransaction.create({
          data: {
            savingsId: savings.id,
            date: new Date(data.joiningDate),
            amount: catchUpAmount,
            total: newTotal,
          },
        });

        await tx.savings.update({
          where: { id: savings.id },
          data: { totalAmount: newTotal },
        });
      }

      return { sequence, catchUpAmount, loansAlreadyGiven };
    });

    return NextResponse.json(
      {
        sequence: result.sequence,
        catchUpAmount: result.catchUpAmount,
        loansAlreadyGiven: result.loansAlreadyGiven,
        message: `Member added to cycle successfully. Catch-up payment: ₹${result.catchUpAmount.toFixed(2)} (${result.loansAlreadyGiven} months × ₹${data.monthlyAmount.toFixed(2)}). Loan amount updated to ₹${loanAmount.toFixed(2)} for all pending members.`,
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

    console.error("Error adding member to cycle:", error);
    return NextResponse.json(
      { error: "Failed to add member to cycle" },
      { status: 500 }
    );
  }
}
