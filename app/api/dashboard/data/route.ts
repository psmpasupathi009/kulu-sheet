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
      const [savings, loans, collections, groups] = await Promise.all([
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
            group: {
              select: {
                groupNumber: true,
                name: true,
                monthlyAmount: true,
              },
            },
          },
          orderBy: { disbursedAt: "desc" },
        }),
        prisma.monthlyCollection.findMany({
          include: {
            group: {
              select: {
                groupNumber: true,
                name: true,
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
        prisma.financingGroup.findMany({
          where: { isActive: true },
          include: {
            members: {
              include: {
                member: {
                  select: {
                    name: true,
                    userId: true,
                  },
                },
              },
            },
            collections: {
              orderBy: { month: "desc" },
              take: 3, // Latest 3 collections per group
            },
          },
          orderBy: { groupNumber: "desc" },
        }),
      ]);

      return NextResponse.json(
        {
          savings,
          loans,
          collections,
          groups,
        },
        { status: 200 }
      );
    } else {
      // Regular user view: Get only their own data
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
            groups: [],
          },
          { status: 200 }
        );
      }

      const [savings, loans, collections, groups] = await Promise.all([
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
            group: {
              select: {
                groupNumber: true,
                name: true,
                monthlyAmount: true,
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
            group: {
              select: {
                groupNumber: true,
                name: true,
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
        prisma.financingGroup.findMany({
          where: {
            isActive: true,
            members: {
              some: {
                memberId: member.id,
              },
            },
          },
          include: {
            members: {
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
            collections: {
              orderBy: { month: "desc" },
              take: 3,
            },
          },
          orderBy: { groupNumber: "desc" },
        }),
      ]);

      return NextResponse.json(
        {
          savings,
          loans,
          collections,
          groups,
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
