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

    // Get loans based on user role
    let loans;
    if (user.role === "ADMIN") {
      // Admin sees all loans
      loans = await prisma.loan.findMany({
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Regular users see only their loans
      const member = await prisma.member.findUnique({
        where: { userId: user.userId || "" },
      });

      if (!member) {
        return NextResponse.json({ loans: [] }, { status: 200 });
      }

      loans = await prisma.loan.findMany({
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ loans }, { status: 200 });
  } catch (error) {
    console.error("Error fetching loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}

