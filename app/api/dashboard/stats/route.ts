import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

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

    // Get user's member record if exists
    const member = await prisma.member.findUnique({
      where: { userId: user.userId },
    });

    if (user.role === "ADMIN") {
      // Admin view: Get all statistics
      const [
        totalMembers,
        totalSavings,
        totalLoans,
        activeLoans,
        completedLoans,
        totalLoanAmount,
        totalRemainingLoans,
        activeCycles,
        totalCollections,
      ] = await Promise.all([
        prisma.member.count(),
        prisma.savings.aggregate({
          _sum: { totalAmount: true },
        }),
        prisma.loan.count(),
        prisma.loan.count({
          where: { status: "ACTIVE" },
        }),
        prisma.loan.count({
          where: { status: "COMPLETED" },
        }),
        prisma.loan.aggregate({
          _sum: { principal: true },
        }),
        prisma.loan.aggregate({
          _sum: { remaining: true },
          where: { status: "ACTIVE" },
        }),
        prisma.loanCycle.count({
          where: { isActive: true },
        }),
        prisma.monthlyCollection.count(),
      ]);

      return NextResponse.json(
        {
          totalMembers: totalMembers,
          totalSavings: totalSavings._sum.totalAmount || 0,
          totalLoans: totalLoans,
          activeLoans: activeLoans,
          completedLoans: completedLoans,
          totalLoanAmount: totalLoanAmount._sum.principal || 0,
          totalRemainingLoans: totalRemainingLoans._sum.remaining || 0,
          activeCycles: activeCycles,
          totalCollections: totalCollections,
        },
        { status: 200 }
      );
    } else {
      // Regular user view: Get only their own statistics
      if (!member) {
        return NextResponse.json(
          {
            totalSavings: 0,
            totalLoans: 0,
            activeLoans: 0,
            completedLoans: 0,
            totalLoanAmount: 0,
            totalRemainingLoans: 0,
          },
          { status: 200 }
        );
      }

      const [
        memberSavings,
        memberLoans,
        activeMemberLoans,
        completedMemberLoans,
      ] = await Promise.all([
        prisma.savings.aggregate({
          _sum: { totalAmount: true },
          where: { memberId: member.id },
        }),
        prisma.loan.findMany({
          where: { memberId: member.id },
        }),
        prisma.loan.count({
          where: { memberId: member.id, status: "ACTIVE" },
        }),
        prisma.loan.count({
          where: { memberId: member.id, status: "COMPLETED" },
        }),
      ]);

      const totalLoanAmount = memberLoans.reduce(
        (sum, loan) => sum + loan.principal,
        0
      );
      const totalRemainingLoans = memberLoans.reduce(
        (sum, loan) => sum + (loan.status === "ACTIVE" ? loan.remaining : 0),
        0
      );

      return NextResponse.json(
        {
          totalSavings: memberSavings._sum.totalAmount || 0,
          totalLoans: memberLoans.length,
          activeLoans: activeMemberLoans,
          completedLoans: completedMemberLoans,
          totalLoanAmount: totalLoanAmount,
          totalRemainingLoans: totalRemainingLoans,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}

