import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createCycleSchema = z.object({
  memberIds: z.array(z.string()).min(1, "At least one member is required"), // All members participating in the cycle
  monthlyAmount: z.number().positive("Monthly amount must be positive"), // Monthly contribution per member
  startDate: z.string().optional(), // Cycle start date
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
        collections: {
          include: {
            payments: {
              include: { member: true },
            },
          },
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

    // Verify all members exist
    const members = await prisma.member.findMany({
      where: {
        id: { in: data.memberIds },
      },
    });

    if (members.length !== data.memberIds.length) {
      return NextResponse.json(
        { error: "One or more members not found" },
        { status: 404 }
      );
    }

    // Get the next cycle number
    const lastCycle = await prisma.loanCycle.findFirst({
      orderBy: { cycleNumber: "desc" },
    });

    const cycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    // Calculate start date
    const startDate = data.startDate ? new Date(data.startDate) : new Date();

    // Calculate loan amount: monthlyAmount * number of members (pooled amount)
    const loanAmount = data.monthlyAmount * data.memberIds.length;

    // Create cycle with loan sequences for each member
    const result = await prisma.$transaction(
      async (tx) => {
        // Create cycle
        const cycle = await tx.loanCycle.create({
          data: {
            cycleNumber: cycleNumber,
            startDate: startDate,
            monthlyAmount: data.monthlyAmount,
            totalMembers: data.memberIds.length,
            isActive: true,
            currentMonth: 0,
          },
        });

        // Create loan sequences for each member (one per month, rotating)
        // Each member gets the pooled amount (monthlyAmount * totalMembers) in their assigned month
        const sequences = await Promise.all(
          data.memberIds.map((memberId, index) => {
            return tx.loanSequence.create({
              data: {
                cycleId: cycle.id,
                memberId: memberId,
                month: index + 1, // Month 1, 2, 3, etc.
                loanAmount: loanAmount, // Pooled amount = monthlyAmount * totalMembers
                status: "PENDING",
              },
            });
          })
        );

        return { cycle, sequences };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    return NextResponse.json(
      {
        cycle: result.cycle,
        sequences: result.sequences,
        message: `Cycle created successfully with ${data.memberIds.length} members. Each member will receive ₹${loanAmount.toFixed(2)} (pooled from ${data.memberIds.length} members × ₹${data.monthlyAmount.toFixed(2)}) in their assigned month.`,
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
