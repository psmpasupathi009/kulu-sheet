import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, requireAdmin, parseBody, handleApiError, resolveParams } from "@/lib/api-utils";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().optional(),
  startDate: z.string(),
  monthlyAmount: z.number().positive().default(2000),
  memberIds: z.array(z.string()).min(2, "At least 2 members required"),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) return authResult;

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
    return handleApiError(error, "fetch financing groups");
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parseResult = parseBody(body, createGroupSchema);
    if (parseResult instanceof NextResponse) return parseResult;
    const { data } = parseResult;

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
            joinMonth: 1, // All initial members join in month 1
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
    return handleApiError(error, "create financing group");
  }
}

