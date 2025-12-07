import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const updateCollectionSchema = z.object({
  collectionDate: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
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

    const { id: groupId, collectionId } = await params;
    const body = await request.json();
    const data = updateCollectionSchema.parse(body);

    // Get collection
    const collection = await prisma.monthlyCollection.findUnique({
      where: { id: collectionId },
      include: {
        group: true,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (collection.groupId !== groupId) {
      return NextResponse.json(
        { error: "Collection does not belong to this group" },
        { status: 400 }
      );
    }

    // Cannot edit if loan is disbursed
    if (collection.loanDisbursed) {
      return NextResponse.json(
        { error: "Cannot edit collection after loan has been disbursed" },
        { status: 400 }
      );
    }

    // Update collection
    const updatedCollection = await prisma.monthlyCollection.update({
      where: { id: collectionId },
      data: {
        collectionDate: data.collectionDate ? new Date(data.collectionDate) : undefined,
      },
    });

    return NextResponse.json(
      {
        collection: updatedCollection,
        message: "Collection updated successfully",
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

    console.error("Error updating collection:", error);
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
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

    const { id: groupId, collectionId } = await params;

    // Get collection with payments and loan info
    const collection = await prisma.monthlyCollection.findUnique({
      where: { id: collectionId },
      include: {
        group: true,
        payments: true,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (collection.groupId !== groupId) {
      return NextResponse.json(
        { error: "Collection does not belong to this group" },
        { status: 400 }
      );
    }

    // Cannot delete if loan is disbursed
    if (collection.loanDisbursed) {
      return NextResponse.json(
        { error: "Cannot delete collection after loan has been disbursed. Please reverse the loan first." },
        { status: 400 }
      );
    }

    // Delete in transaction to handle cascades and reverse savings
    await prisma.$transaction(async (tx) => {
      // Reverse savings for all PAID payments before deleting
      for (const payment of collection.payments) {
        const status = String(payment.status || '').trim().toUpperCase();
        if (status === 'PAID' && payment.amount > 0) {
          // Find member's savings
          const member = await tx.member.findUnique({
            where: { id: payment.memberId },
            include: { savings: true },
          });

          if (member && member.savings.length > 0) {
            const savings = member.savings[0];
            
            // Find and delete the savings transaction for this payment
            // Look for transactions on the same date or around the payment date
            const savingsTransactions = await tx.savingsTransaction.findMany({
              where: {
                savingsId: savings.id,
                amount: payment.amount,
                date: {
                  gte: new Date(new Date(payment.paymentDate).setHours(0, 0, 0, 0)),
                  lte: new Date(new Date(payment.paymentDate).setHours(23, 59, 59, 999)),
                },
              },
              orderBy: { date: 'desc' },
            });

            // Delete matching savings transactions
            if (savingsTransactions.length > 0) {
              await tx.savingsTransaction.deleteMany({
                where: {
                  id: { in: savingsTransactions.map(t => t.id) },
                },
              });

              // Recalculate savings total from remaining transactions
              const remainingTransactions = await tx.savingsTransaction.findMany({
                where: { savingsId: savings.id },
                orderBy: { date: 'asc' },
              });

              // Recalculate running totals from remaining transactions
              // Only count positive amounts (contributions)
              let runningTotal = 0;
              for (const trans of remainingTransactions) {
                runningTotal += Math.max(0, trans.amount || 0); // Only count positive amounts
                await tx.savingsTransaction.update({
                  where: { id: trans.id },
                  data: { total: runningTotal },
                });
              }

              // Update savings total (ensure never negative)
              await tx.savings.update({
                where: { id: savings.id },
                data: { totalAmount: Math.max(0, runningTotal) },
              });
            }
          }
        }
      }

      // Delete all payments (will cascade)
      await tx.collectionPayment.deleteMany({
        where: { collectionId: collectionId },
      });

      // Delete collection
      await tx.monthlyCollection.delete({
        where: { id: collectionId },
      });

      // Update group's currentMonth if this was the latest collection
      const remainingCollections = await tx.monthlyCollection.findMany({
        where: { groupId: groupId },
        orderBy: { month: "desc" },
        take: 1,
      });

      const newCurrentMonth = remainingCollections.length > 0
        ? remainingCollections[0].month
        : 0;

      await tx.financingGroup.update({
        where: { id: groupId },
        data: { currentMonth: newCurrentMonth },
      });
    });

    return NextResponse.json(
      { message: "Collection deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}

