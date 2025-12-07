import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().optional(),
  startDate: z.string(),
  monthlyAmount: z.number().positive().default(2000),
  memberIds: z.array(z.string()).min(2, "At least 2 members required"),
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

    const groups = await prisma.financingGroup.findMany({
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
        _count: {
          select: {
            members: true,
            collections: true,
            loans: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({ groups }, { status: 200 });
  } catch (error) {
    console.error("Error fetching financing groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch financing groups" },
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
    const data = createGroupSchema.parse(body);

    // Verify all members exist
    const members = await prisma.member.findMany({
      where: { id: { in: data.memberIds } },
    });

    if (members.length !== data.memberIds.length) {
      return NextResponse.json(
        { error: "Some members do not exist" },
        { status: 400 }
      );
    }

    const totalMembers = data.memberIds.length;

    // Get next group number
    const lastGroup = await prisma.financingGroup.findFirst({
      orderBy: { groupNumber: "desc" },
    });

    const nextGroupNumber = lastGroup ? lastGroup.groupNumber + 1 : 1;
    const startDate = new Date(data.startDate);

    // Create group with members (admin will decide who receives loan each month)
    const group = await prisma.financingGroup.create({
      data: {
        groupNumber: nextGroupNumber,
        name: data.name,
        startDate: startDate,
        monthlyAmount: data.monthlyAmount,
        totalMembers: totalMembers,
        currentMonth: 0,
        isActive: true,
        members: {
          create: data.memberIds.map((memberId) => ({
            memberId: memberId,
          })),
        },
      },
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
      },
    });

    return NextResponse.json(
      {
        group,
        message: `Financing group created successfully with ${totalMembers} members. Each member will invest ₹${data.monthlyAmount}/month for ${totalMembers} months.`,
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

    console.error("Error creating financing group:", error);
    return NextResponse.json(
      { error: "Failed to create financing group" },
      { status: 500 }
    );
  }
}

