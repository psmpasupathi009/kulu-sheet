import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const updateTransactionSchema = z.object({
  date: z.string().optional(),
  amount: z.number().positive().optional(),
});

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

export async function PUT(
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
    const body = await request.json();
    const data = updateTransactionSchema.parse(body);

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

    // Update transaction and recalculate all subsequent totals
    // Use longer timeout and optimize by doing bulk operations
    await prisma.$transaction(async (tx) => {
      // Update the transaction
      const updateData: any = {};
      if (data.date !== undefined) {
        updateData.date = new Date(data.date);
      }
      if (data.amount !== undefined) {
        updateData.amount = data.amount;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.savingsTransaction.update({
          where: { id: transactionId },
          data: updateData,
        });
      }

      // Recalculate all totals from the beginning (in chronological order)
      const allTransactions = await tx.savingsTransaction.findMany({
        where: { savingsId: transaction.savingsId },
        orderBy: { date: "asc" }, // Order by date to calculate running totals correctly
      });

      // Calculate running totals first (in memory)
      let runningTotal = 0;
      const updates: Array<{ id: string; total: number }> = [];
      
      for (const txn of allTransactions) {
        runningTotal += Math.max(0, txn.amount || 0); // Only count positive amounts
        updates.push({ id: txn.id, total: runningTotal });
      }

      // Update all transactions in parallel (more efficient than sequential)
      // Limit concurrency to avoid overwhelming the database
      const BATCH_SIZE = 10;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((update) =>
            tx.savingsTransaction.update({
              where: { id: update.id },
              data: { total: update.total },
            })
          )
        );
      }

      // Update savings total
      await tx.savings.update({
        where: { id: transaction.savingsId },
        data: { totalAmount: Math.max(0, runningTotal) },
      });
    }, {
      maxWait: 10000, // 10 seconds max wait
      timeout: 20000, // 20 seconds timeout
    });

    return NextResponse.json(
      { message: "Savings transaction updated successfully. All totals recalculated." },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating savings transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

