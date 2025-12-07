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

    // Get transaction with loan info
    const transaction = await prisma.loanTransaction.findUnique({
      where: { id: transactionId },
      include: {
        loan: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const loan = transaction.loan;

    // Reverse the transaction in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the transaction
      await tx.loanTransaction.delete({
        where: { id: transactionId },
      });

      // Recalculate loan values
      const remainingTransactions = await tx.loanTransaction.findMany({
        where: { loanId: loan.id },
        orderBy: { month: "asc" },
      });

      // Recalculate remaining balance and current month
      let newRemaining = loan.principal;
      let newCurrentMonth = 0;
      let newTotalPrincipalPaid = 0;

      for (const txn of remainingTransactions) {
        newRemaining -= txn.amount;
        newCurrentMonth = Math.max(newCurrentMonth, txn.month);
        newTotalPrincipalPaid += txn.amount;
      }

      // Update loan status
      const isComplete = newCurrentMonth >= loan.months || newRemaining <= 0.01;
      const newStatus = isComplete ? "COMPLETED" : (newCurrentMonth > 0 ? "ACTIVE" : "PENDING");

      // Update loan
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          remaining: newRemaining,
          currentMonth: newCurrentMonth,
          totalPrincipalPaid: newTotalPrincipalPaid,
          status: newStatus,
          completedAt: isComplete ? loan.completedAt : null,
        },
      });
    });

    return NextResponse.json(
      { message: "Loan transaction deleted successfully. Loan values recalculated." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting loan transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}

