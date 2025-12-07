import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const calculateBenefitSchema = z.object({
  groupId: z.string(),
  memberId: z.string(),
  month: z.number().int().positive(), // Current month in cycle
});

/**
 * Calculate loan amount based on member's joining month and contributions
 * Members who join earlier get more benefit (proportional to their contribution period)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const data = calculateBenefitSchema.parse(body);

    // Get group member details
    const groupMember = await prisma.groupMember.findUnique({
      where: {
        groupId_memberId: {
          groupId: data.groupId,
          memberId: data.memberId,
        },
      },
      include: {
        group: true,
        member: true,
      },
    });

    if (!groupMember) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    // Get all active members in the group
    const allGroupMembers = await prisma.groupMember.findMany({
      where: {
        groupId: data.groupId,
        isActive: true,
      },
      orderBy: { joiningMonth: "asc" },
    });

    // Calculate total contributions from all members up to this month
    // Each member contributes their individual monthlyAmount
    const totalContributions = allGroupMembers.reduce((sum, gm) => {
      // Members contribute from their joining month to current month
      const monthsContributed = Math.max(0, data.month - gm.joiningMonth + 1);
      const memberMonthlyAmount = gm.monthlyAmount || 2000;
      return sum + monthsContributed * memberMonthlyAmount;
    }, 0);

    // Calculate this member's contribution period
    const memberMonthsContributed = Math.max(
      0,
      data.month - groupMember.joiningMonth + 1
    );
    const memberMonthlyAmount = groupMember.monthlyAmount || 2000;
    const memberTotalContributed = memberMonthsContributed * memberMonthlyAmount;

    // Calculate benefit: based on member's total contribution vs total pool
    // Members who contribute more (joined earlier) get proportionally higher benefits
    const activeMembersThisMonth = allGroupMembers.filter(
      (gm) => gm.joiningMonth <= data.month
    ).length;

    // Pool amount for this month (sum of all active members' individual monthly amounts)
    const poolAmount = allGroupMembers
      .filter((gm) => gm.joiningMonth <= data.month)
      .reduce((sum, gm) => sum + (gm.monthlyAmount || 2000), 0);

    // Benefit: member's contribution as percentage of total pool
    // Formula: (member_contribution / total_contributions) * pool_amount
    // This ensures fair distribution - earlier joiners contribute more, get more benefit
    const benefitAmount =
      totalContributions > 0
        ? (memberTotalContributed / totalContributions) * poolAmount
        : poolAmount / Math.max(activeMembersThisMonth, 1);

    // Update group member's benefit amount
    await prisma.groupMember.update({
      where: { id: groupMember.id },
      data: {
        benefitAmount: benefitAmount,
        totalContributed: memberTotalContributed,
      },
    });

    return NextResponse.json(
      {
        memberId: data.memberId,
        memberName: groupMember.member.name,
        joiningMonth: groupMember.joiningMonth,
        monthsContributed: memberMonthsContributed,
        totalContributed: memberTotalContributed,
        benefitAmount: benefitAmount,
        poolAmount: poolAmount,
        activeMembers: activeMembersThisMonth,
        calculation: {
          formula: "(member_contribution / total_contributions) × pool_amount",
          memberContribution: memberTotalContributed,
          totalContributions: totalContributions,
          poolAmount: poolAmount,
          activeMembers: activeMembersThisMonth,
        },
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

    console.error("Error calculating benefit:", error);
    return NextResponse.json(
      { error: "Failed to calculate benefit" },
      { status: 500 }
    );
  }
}
