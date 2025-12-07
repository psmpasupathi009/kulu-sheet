import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const savings = await prisma.savings.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        transactions: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!savings) {
      return NextResponse.json({ error: "Savings not found" }, { status: 404 });
    }

    // Check authorization: non-admin users can only view their own savings
    if (user.role !== "ADMIN") {
      const member = await prisma.member.findUnique({
        where: { userId: user.userId || "" },
      });

      if (!member || savings.memberId !== member.id) {
        return NextResponse.json(
          { error: "Forbidden - You can only view your own savings" },
          { status: 403 }
        );
      }
    }

    // Recalculate total from positive transactions only (contributions)
    // Negative transactions from old loan disbursement logic should be ignored
    const calculatedTotal = savings.transactions.reduce((sum, t) => {
      // Only add positive amounts (contributions)
      return sum + Math.max(0, t.amount || 0);
    }, 0);
    const finalTotal = Math.max(0, calculatedTotal); // Ensure never negative

    // Always update to ensure consistency
    if (Math.abs(finalTotal - savings.totalAmount) > 0.001) {
      await prisma.savings.update({
        where: { id },
        data: { totalAmount: finalTotal },
      });
    }

    // Filter out negative transactions (from old loan disbursement logic)
    // Only show positive transactions (contributions)
    const positiveTransactions = savings.transactions.filter(t => t.amount > 0);

    // Return with recalculated total and only positive transactions ordered by date desc for display
    const savingsWithCorrectTotal = {
      ...savings,
      totalAmount: finalTotal,
      transactions: positiveTransactions.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    };

    return NextResponse.json({ savings: savingsWithCorrectTotal }, { status: 200 });
  } catch (error) {
    console.error("Error fetching savings:", error);
    return NextResponse.json(
      { error: "Failed to fetch savings" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { id } = await params;

    const savings = await prisma.savings.findUnique({
      where: { id },
      include: {
        member: true,
        transactions: true,
      },
    });

    if (!savings) {
      return NextResponse.json({ error: "Savings not found" }, { status: 404 });
    }

    // Delete all transactions and the savings record
    await prisma.$transaction(async (tx) => {
      // Delete all transactions
      await tx.savingsTransaction.deleteMany({
        where: { savingsId: id },
      });

      // Delete the savings record
      await tx.savings.delete({
        where: { id },
      });
    });

    return NextResponse.json(
      { message: "Savings record and all transactions deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting savings:", error);
    return NextResponse.json(
      { error: "Failed to delete savings" },
      { status: 500 }
    );
  }
}
