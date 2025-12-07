import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(
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

    // Get collection with loan info
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

    if (!collection.loanDisbursed || !collection.loanMemberId) {
      return NextResponse.json(
        { error: "No loan has been disbursed for this collection" },
        { status: 400 }
      );
    }

    // Find and delete the loan
    const loan = await prisma.loan.findFirst({
      where: {
        groupId: groupId,
        memberId: collection.loanMemberId,
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    // Reverse loan and collection in transaction
    await prisma.$transaction(async (tx) => {
      // Delete loan transactions
      await tx.loanTransaction.deleteMany({
        where: { loanId: loan.id },
      });

      // Delete loan
      await tx.loan.delete({
        where: { id: loan.id },
      });

      // Update collection to remove loan info
      await tx.monthlyCollection.update({
        where: { id: collectionId },
        data: {
          loanDisbursed: false,
          loanMemberId: null,
          loanAmount: null,
        },
      });

      // Check if group should be reactivated
      const loansCount = await tx.loan.count({
        where: { groupId: groupId },
      });

      if (loansCount < collection.group.totalMembers) {
        await tx.financingGroup.update({
          where: { id: groupId },
          data: {
            isActive: true,
            endDate: null,
          },
        });
      }
    });

    return NextResponse.json(
      { message: "Loan reversed successfully. Collection is now available for loan disbursement." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error reversing loan:", error);
    return NextResponse.json(
      { error: "Failed to reverse loan" },
      { status: 500 }
    );
  }
}

