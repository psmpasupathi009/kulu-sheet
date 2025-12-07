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

    // Calculate catch-up payment
    const joiningDate = new Date(data.joiningDate);
    const startDate = new Date(cycle.startDate);
    const monthsElapsed = Math.max(
      0,
      Math.floor(
        (joiningDate.getTime() - startDate.getTime()) /
          (30 * 24 * 60 * 60 * 1000)
      )
    );

    const catchUpAmount = monthsElapsed * data.monthlyAmount;
    const nextAvailableMonth =
      cycle.sequences.length > 0
        ? Math.max(...cycle.sequences.map((s) => s.month)) + 1
        : cycle.currentMonth + 1;

    // Create sequence for the member
    const result = await prisma.$transaction(async (tx) => {
      // Create loan sequence
      const sequence = await tx.loanSequence.create({
        data: {
          cycleId: cycleId,
          memberId: data.memberId,
          month: nextAvailableMonth,
          loanAmount: 0, // Will be calculated when disbursed
          status: "PENDING",
        },
      });

      // If catch-up payment is required, create a collection payment record
      if (catchUpAmount > 0 && cycle.collections.length > 0) {
        // Find or create collection for catch-up
        const latestCollection = cycle.collections[cycle.collections.length - 1];
        
        // Create catch-up payment record
        await tx.collectionPayment.create({
          data: {
            collectionId: latestCollection.id,
            memberId: data.memberId,
            amount: catchUpAmount,
            paymentDate: joiningDate,
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

        // Group fund removed - no longer needed
      }

      return { sequence, catchUpAmount, monthsElapsed };
    });

    return NextResponse.json(
      {
        sequence: result.sequence,
        catchUpAmount: result.catchUpAmount,
        monthsElapsed: result.monthsElapsed,
        message: "Member added to cycle successfully",
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

