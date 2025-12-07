import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
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

    const { transactionId } = await params;

    // Get transaction with savings info
    const transaction = await prisma.savingsTransaction.findUnique({
      where: { id: transactionId },
      include: {
        savings: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Delete transaction and recalculate savings total
    await prisma.$transaction(async (tx) => {
      // Delete the transaction
      await tx.savingsTransaction.delete({
        where: { id: transactionId },
      });

      // Recalculate total from remaining transactions
      const remainingTransactions = await tx.savingsTransaction.findMany({
        where: { savingsId: transaction.savingsId },
      });

      const newTotal = remainingTransactions.reduce(
        (sum, t) => sum + Math.max(0, t.amount || 0), // Only count positive amounts
        0
      );

      // Update savings total
      await tx.savings.update({
        where: { id: transaction.savingsId },
        data: { totalAmount: Math.max(0, newTotal) },
      });
    });

    return NextResponse.json(
      { message: "Savings transaction deleted successfully. Savings total recalculated." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting savings transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}

