import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const addMemberSchema = z.object({
  memberId: z.string(),
  joiningDate: z.string().datetime(),
  joiningMonth: z.number().int().positive(),
  monthlyAmount: z.number().positive().optional(), // Optional: member's monthly contribution amount
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
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: id,
        isActive: true, // Only return active members
      },
      include: {
        member: {
          select: {
            id: true,
            userId: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { joiningMonth: "asc" },
    });

    return NextResponse.json({ members }, { status: 200 });
  } catch (error) {
    console.error("Error fetching group members:", error);
    return NextResponse.json(
      { error: "Failed to fetch group members" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const data = addMemberSchema.parse(body);

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if member is already in group
    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_memberId: {
          groupId: id,
          memberId: data.memberId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Member is already in this group" },
        { status: 400 }
      );
    }

    // Use provided monthlyAmount or default from group or 2000
    const memberMonthlyAmount = data.monthlyAmount || group.monthlyAmount || 2000;

    // Get the current month number in the active cycle (if any)
    // For new members joining mid-cycle, calculate how many months they need to pay back
    const activeCycle = await prisma.loanCycle.findFirst({
      where: {
        groupId: id,
        isActive: true,
      },
      include: {
        collections: {
          orderBy: { month: "desc" },
          take: 1,
        },
        groupFund: true,
      },
    });

    const currentMonth = activeCycle?.currentMonth || 0;
    const monthsToPayBack = Math.max(0, currentMonth - data.joiningMonth + 1);

    // Calculate benefit amount based on joining month
    // Members who join earlier get more benefit (proportional to their contribution period)
    // Benefit will be recalculated dynamically when loans are disbursed
    // Initial benefit is set to 0, will be calculated based on actual contributions
    const benefitAmount = 0;

    const groupMember = await prisma.groupMember.create({
      data: {
        groupId: id,
        memberId: data.memberId,
        joiningMonth: data.joiningMonth,
        joiningDate: new Date(data.joiningDate),
        monthlyAmount: memberMonthlyAmount,
        benefitAmount: benefitAmount,
      },
      include: {
        member: true,
      },
    });

    // If member is joining after the cycle has started, create back-payment records
    // for all previous months they need to pay
    if (activeCycle && monthsToPayBack > 0) {
      const backPaymentAmount = memberMonthlyAmount * monthsToPayBack;
      
      // Create collection payments for back months
      for (let month = 1; month <= currentMonth; month++) {
        // Check if collection exists for this month
        let collection = await prisma.monthlyCollection.findUnique({
          where: {
            cycleId_month: {
              cycleId: activeCycle.id,
              month: month,
            },
          },
        });

        // If collection doesn't exist, create it
        if (!collection) {
          const groupWithMembers = await prisma.group.findUnique({
            where: { id },
            include: {
              members: {
                where: { isActive: true },
              },
            },
          });

          const activeMembersAtMonth = groupWithMembers?.members.filter(
            (gm) => gm.joiningMonth <= month
          ) || [];
          const expectedAmount = activeMembersAtMonth.reduce(
            (sum, gm) => sum + (gm.monthlyAmount || 2000),
            0
          );

          collection = await prisma.monthlyCollection.create({
            data: {
              cycleId: activeCycle.id,
              groupId: id,
              month: month,
              collectionDate: new Date(),
              totalCollected: 0,
              expectedAmount: expectedAmount,
              activeMemberCount: activeMembersAtMonth.length,
              isCompleted: false,
            },
          });
        }

        // Create back-payment record for this month
        await prisma.collectionPayment.create({
          data: {
            collectionId: collection.id,
            memberId: data.memberId,
            groupMemberId: groupMember.id,
            amount: memberMonthlyAmount,
            paymentDate: new Date(data.joiningDate),
            paymentMethod: "BACK_PAYMENT",
            status: "PAID",
          },
        });

        // Update group member's total contributed
        await prisma.groupMember.update({
          where: { id: groupMember.id },
          data: {
            totalContributed: {
              increment: memberMonthlyAmount,
            },
          },
        });

        // Update collection total
        const collectionWithPayments = await prisma.monthlyCollection.findUnique({
          where: { id: collection.id },
          include: { payments: true },
        });

        if (collectionWithPayments) {
          const totalCollected = collectionWithPayments.payments.reduce(
            (sum, p) => sum + (p.status === "PAID" ? p.amount : 0),
            0
          );

          await prisma.monthlyCollection.update({
            where: { id: collection.id },
            data: {
              totalCollected: totalCollected,
              isCompleted: totalCollected >= (collectionWithPayments.expectedAmount || 0),
            },
          });

          // Update group fund
          if (activeCycle.groupFund) {
            await prisma.groupFund.update({
              where: { id: activeCycle.groupFund.id },
              data: {
                investmentPool: {
                  increment: memberMonthlyAmount,
                },
                totalFunds: {
                  increment: memberMonthlyAmount,
                },
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ groupMember }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error adding member to group:", error);
    return NextResponse.json(
      { error: "Failed to add member to group" },
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
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // Deactivate instead of delete to preserve history
    const groupMember = await prisma.groupMember.updateMany({
      where: {
        groupId: id,
        memberId: memberId,
      },
      data: {
        isActive: false,
      },
    });

    if (groupMember.count === 0) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Member removed from group" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing member from group:", error);
    return NextResponse.json(
      { error: "Failed to remove member from group" },
      { status: 500 }
    );
  }
}
