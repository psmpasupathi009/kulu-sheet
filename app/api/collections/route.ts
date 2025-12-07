import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createCollectionSchema = z.object({
  cycleId: z.string(),
  month: z.number().int().positive(),
  collectionDate: z.string().datetime(),
});

const recordPaymentSchema = z.object({
  collectionId: z.string(),
  memberId: z.string(),
  amount: z.number().positive().default(2000),
  paymentMethod: z.string().optional(),
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

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");

    if (!cycleId) {
      return NextResponse.json(
        { error: "cycleId is required" },
        { status: 400 }
      );
    }

    const collections = await prisma.monthlyCollection.findMany({
      where: { cycleId },
      include: {
        payments: {
          include: {
            member: true,
          },
        },
      },
      orderBy: { month: "asc" },
    });

    return NextResponse.json({ collections }, { status: 200 });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

// Create a new monthly collection
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
    const data = createCollectionSchema.parse(body);

    // Check if collection already exists
    const existing = await prisma.monthlyCollection.findUnique({
      where: {
        cycleId_month: {
          cycleId: data.cycleId,
          month: data.month,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Collection for this month already exists" },
        { status: 400 }
      );
    }

    // Get cycle details
    const cycle = await prisma.loanCycle.findUnique({
      where: { id: data.cycleId },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Get all members who have savings (active members)
    const allMembers = await prisma.member.findMany({
      where: {
        savings: {
          some: {},
        },
      },
    });

    const activeMemberCount = allMembers.length;
    // Calculate expected amount: monthlyAmount * number of active members
    const expectedAmount = cycle.monthlyAmount * activeMemberCount;

    const collection = await prisma.monthlyCollection.create({
      data: {
        cycleId: data.cycleId,
        month: data.month,
        collectionDate: new Date(data.collectionDate),
        totalCollected: 0,
        expectedAmount: expectedAmount,
        activeMemberCount: activeMemberCount,
        isCompleted: false,
      },
      include: {
        payments: true,
      },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}

// Record a payment for a collection
export async function PUT(request: NextRequest) {
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
    const data = recordPaymentSchema.parse(body);

    // Check if payment already exists
    const existingPayment = await prisma.collectionPayment.findUnique({
      where: {
        collectionId_memberId: {
          collectionId: data.collectionId,
          memberId: data.memberId,
        },
      },
    });

    let payment;
    if (existingPayment) {
      // Update existing payment
      const amountDifference = data.amount - existingPayment.amount;
      
      payment = await prisma.collectionPayment.update({
        where: { id: existingPayment.id },
        data: {
          amount: data.amount,
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod,
          status: "PAID",
        },
      });

      // Update member's savings if amount changed
      if (amountDifference !== 0) {
        const member = await prisma.member.findUnique({
          where: { id: data.memberId },
          include: { savings: true },
        });

        if (member) {
          let savings = member.savings[0];
          if (!savings) {
            savings = await prisma.savings.create({
              data: {
                memberId: member.id,
                totalAmount: 0,
              },
            });
          }

          const newTotal = savings.totalAmount + amountDifference;
          await prisma.savingsTransaction.create({
            data: {
              savingsId: savings.id,
              date: new Date(),
              amount: amountDifference,
              total: newTotal,
            },
          });

          await prisma.savings.update({
            where: { id: savings.id },
            data: { totalAmount: newTotal },
          });
        }
      }
    } else {
      // Create new payment
      const paymentAmount = data.amount || 2000;

      payment = await prisma.collectionPayment.create({
        data: {
          collectionId: data.collectionId,
          memberId: data.memberId,
          amount: paymentAmount,
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod,
          status: "PAID",
        },
      });

      // Add payment to member's savings
      const member = await prisma.member.findUnique({
        where: { id: data.memberId },
        include: { savings: true },
      });

      if (member) {
        let savings = member.savings[0];
        if (!savings) {
          savings = await prisma.savings.create({
            data: {
              memberId: member.id,
              totalAmount: 0,
            },
          });
        }

        const newTotal = savings.totalAmount + paymentAmount;
        await prisma.savingsTransaction.create({
          data: {
            savingsId: savings.id,
            date: new Date(),
            amount: paymentAmount,
            total: newTotal,
          },
        });

        await prisma.savings.update({
          where: { id: savings.id },
          data: { totalAmount: newTotal },
        });
      }
    }

    // Update collection total
    const collection = await prisma.monthlyCollection.findUnique({
      where: { id: data.collectionId },
      include: {
        payments: {
          include: {
            member: true,
          },
        },
      },
    });

    if (collection) {
      const totalCollected = collection.payments.reduce(
        (sum, p) => sum + (p.status === "PAID" ? p.amount : 0),
        0
      );

      await prisma.monthlyCollection.update({
        where: { id: data.collectionId },
        data: {
          totalCollected: totalCollected,
          isCompleted: totalCollected >= (collection.expectedAmount || 0),
        },
      });
    }

    return NextResponse.json({ payment }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
