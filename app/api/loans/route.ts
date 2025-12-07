import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, handleApiError } from "@/lib/api-utils";

const loanInclude = {
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
} as const;

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Get loans based on user role
    const loans =
      user.role === "ADMIN"
        ? await prisma.loan.findMany({
            include: loanInclude,
            orderBy: { createdAt: "desc" },
          })
        : await (async () => {
            const member = await prisma.member.findUnique({
              where: { userId: user.userId || "" },
            });
            if (!member) return [];
            return prisma.loan.findMany({
              where: { memberId: member.id },
              include: loanInclude,
              orderBy: { createdAt: "desc" },
            });
          })();

    return NextResponse.json({ loans }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "fetch loans");
  }
}

