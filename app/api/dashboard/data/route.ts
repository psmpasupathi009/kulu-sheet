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

    if (user.role === "ADMIN") {
      // Admin view: Get all financial data
      const [savings, loans, collections, cycles] = await Promise.all([
        prisma.savings.findMany({
          include: {
            member: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
            transactions: {
              orderBy: { date: "desc" },
              take: 5, // Latest 5 transactions
            },
          },
          orderBy: { totalAmount: "desc" },
        }),
        prisma.loan.findMany({
          include: {
            member: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
            cycle: {
              select: {
                cycleNumber: true,
                monthlyAmount: true,
              },
            },
            sequence: {
              select: {
                month: true,
                loanAmount: true,
              },
            },
          },
          orderBy: { disbursedAt: "desc" },
        }),
        prisma.monthlyCollection.findMany({
          include: {
            cycle: {
              select: {
                cycleNumber: true,
                monthlyAmount: true,
                totalMembers: true,
              },
            },
            payments: {
              include: {
                member: {
                  select: {
                    name: true,
                    userId: true,
                  },
                },
              },
            },
          },
          orderBy: { collectionDate: "desc" },
          take: 10, // Latest 10 collections
        }),
        prisma.loanCycle.findMany({
          where: { isActive: true },
          include: {
            sequences: {
              include: {
                member: {
                  select: {
                    name: true,
                    userId: true,
                  },
                },
                loan: true,
              },
            },
            collections: {
              orderBy: { month: "desc" },
              take: 3, // Latest 3 collections per cycle
            },
          },
          orderBy: { cycleNumber: "desc" },
        }),
      ]);

      return NextResponse.json(
        {
          savings,
          loans,
          collections,
          cycles,
        },
        { status: 200 }
      );
    } else {
      // Regular user view: Get only their own data
      // Get user's member record if userId exists
      let member = null;
      if (user.userId) {
        member = await prisma.member.findUnique({
          where: { userId: user.userId },
        });
      }

      if (!member) {
        return NextResponse.json(
          {
            savings: [],
            loans: [],
            collections: [],
            cycles: [],
          },
          { status: 200 }
        );
      }

      const [savings, loans, collections, cycles] = await Promise.all([
        prisma.savings.findMany({
          where: { memberId: member.id },
          include: {
            member: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
            transactions: {
              orderBy: { date: "desc" },
              take: 10, // Latest 10 transactions
            },
          },
        }),
        prisma.loan.findMany({
          where: { memberId: member.id },
          include: {
            member: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
            cycle: {
              select: {
                cycleNumber: true,
                monthlyAmount: true,
              },
            },
            sequence: {
              select: {
                month: true,
                loanAmount: true,
              },
            },
          },
          orderBy: { disbursedAt: "desc" },
        }),
        prisma.monthlyCollection.findMany({
          where: {
            payments: {
              some: {
                memberId: member.id,
              },
            },
          },
          include: {
            cycle: {
              select: {
                cycleNumber: true,
                monthlyAmount: true,
                totalMembers: true,
              },
            },
            payments: {
              where: {
                memberId: member.id,
              },
              include: {
                member: {
                  select: {
                    name: true,
                    userId: true,
                  },
                },
              },
            },
          },
          orderBy: { collectionDate: "desc" },
          take: 10,
        }),
        prisma.loanCycle.findMany({
          where: {
            isActive: true,
            sequences: {
              some: {
                memberId: member.id,
              },
            },
          },
          include: {
            sequences: {
              where: {
                memberId: member.id,
              },
              include: {
                member: {
                  select: {
                    name: true,
                    userId: true,
                  },
                },
                loan: true,
              },
            },
            collections: {
              orderBy: { month: "desc" },
              take: 3,
            },
          },
          orderBy: { cycleNumber: "desc" },
        }),
      ]);

      return NextResponse.json(
        {
          savings,
          loans,
          collections,
          cycles,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

