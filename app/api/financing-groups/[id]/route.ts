import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const updateGroupSchema = z.object({
  name: z.string().optional(),
  monthlyAmount: z.number().positive().optional(),
  startDate: z.string().optional(),
});

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
    const group = await prisma.financingGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
          },
        },
        collections: {
          orderBy: { month: "asc" },
          include: {
            payments: {
              select: {
                id: true,
                memberId: true,
                amount: true,
                paymentDate: true,
                status: true,
                member: {
                  select: {
                    name: true,
                    userId: true,
                  },
                },
              },
            },
          },
        },
        loans: {
          select: {
            id: true,
            memberId: true,
            loanMonth: true,
            months: true,
            currentMonth: true,
            principal: true,
            remaining: true,
            status: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ group }, { status: 200 });
  } catch (error) {
    console.error("Error fetching financing group:", error);
    return NextResponse.json(
      { error: "Failed to fetch financing group" },
      { status: 500 }
    );
  }
}

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
    const data = updateGroupSchema.parse(body);

    const group = await prisma.financingGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    // Check if group has collections or loans - if so, restrict editing
    const hasCollections = await prisma.monthlyCollection.count({
      where: { groupId: id },
    });

    const hasLoans = await prisma.loan.count({
      where: { groupId: id },
    });

    if (hasCollections > 0 || hasLoans > 0) {
      // Only allow editing name if group has activity
      if (data.monthlyAmount !== undefined || data.startDate !== undefined) {
        return NextResponse.json(
          { 
            error: "Cannot modify monthly amount or start date for groups with existing collections or loans. Only name can be edited.",
          },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.monthlyAmount !== undefined) {
      updateData.monthlyAmount = data.monthlyAmount;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }

    const updatedGroup = await prisma.financingGroup.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { group: updatedGroup, message: "Financing group updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating financing group:", error);
    return NextResponse.json(
      { error: "Failed to update financing group" },
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

    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    const group = await prisma.financingGroup.findUnique({
      where: { id },
      include: {
        collections: {
          include: {
            payments: true,
          },
        },
        loans: {
          include: {
            transactions: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    // Check if group has collections or loans
    if (group.collections.length > 0 || group.loans.length > 0) {
      const collectionsCount = group.collections.length;
      const loansCount = group.loans.length;
      return NextResponse.json(
        { 
          error: `Cannot delete financing group with existing collections or loans. Please delete all collections and loans first. (Found: ${collectionsCount} collections, ${loansCount} loans)`,
          details: {
            collectionsCount,
            loansCount,
          },
        },
        { status: 400 }
      );
    }

    // Delete group (members will cascade delete)
    await prisma.financingGroup.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Financing group deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting financing group:", error);
    return NextResponse.json(
      { error: "Failed to delete financing group" },
      { status: 500 }
    );
  }
}

