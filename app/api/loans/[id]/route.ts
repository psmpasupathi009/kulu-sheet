import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

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
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        group: {
          select: {
            id: true,
            groupNumber: true,
            name: true,
            totalMembers: true,
            monthlyAmount: true,
            startDate: true,
          },
        },
        guarantor1: {
          select: {
            name: true,
            userId: true,
          },
        },
        guarantor2: {
          select: {
            name: true,
            userId: true,
          },
        },
        transactions: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    // Check authorization - users can only see their own loans unless admin
    if (user.role !== "ADMIN") {
      const member = await prisma.member.findUnique({
        where: { userId: user.userId || "" },
      });

      if (!member || loan.memberId !== member.id) {
        return NextResponse.json(
          { error: "Forbidden - You can only view your own loans" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ loan }, { status: 200 });
  } catch (error) {
    console.error("Error fetching loan:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan" },
      { status: 500 }
    );
  }
}

const updateLoanSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "DEFAULTED"]).optional(),
  reason: z.string().optional(),
});

export async function PUT(
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
    const body = await request.json();
    const data = updateLoanSchema.parse(body);

    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "COMPLETED" && !loan.completedAt) {
        updateData.completedAt = new Date();
      }
    }
    if (data.reason !== undefined) {
      updateData.reason = data.reason;
    }

    const updatedLoan = await prisma.loan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { loan: updatedLoan, message: "Loan updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating loan:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
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
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        transactions: true,
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 }
      );
    }

    // Check if loan has transactions - if so, warn but allow deletion
    if (loan.transactions.length > 0) {
      // Delete all transactions first
      await prisma.loanTransaction.deleteMany({
        where: { loanId: id },
      });
    }

    // Delete the loan
    await prisma.loan.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Loan deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting loan:", error);
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500 }
    );
  }
}

