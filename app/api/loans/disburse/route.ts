import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const disburseLoanSchema = z.object({
  sequenceId: z.string(),
  disbursedAt: z.string().optional(),
  guarantor1Id: z.string().optional(),
  guarantor2Id: z.string().optional(),
  disbursementMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
});

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
    const data = disburseLoanSchema.parse(body);

    // Get sequence with cycle and member
    const sequence = await prisma.loanSequence.findUnique({
      where: { id: data.sequenceId },
      include: {
        cycle: {
        },
        member: true,
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Loan sequence not found" },
        { status: 404 }
      );
    }

    if (sequence.status === "DISBURSED") {
      return NextResponse.json(
        { error: "Loan already disbursed" },
        { status: 400 }
      );
    }

    // No group fund - loans are disbursed from savings pool
    // Default to 10 months repayment
    const loanMonths = 10;

    // Create loan
    const loan = await prisma.loan.create({
      data: {
        memberId: sequence.memberId,
        cycleId: sequence.cycleId,
        sequenceId: sequence.id,
        principal: sequence.loanAmount,
        remaining: sequence.loanAmount,
        months: loanMonths, // 10 months for ROSCA
        currentMonth: 0,
        status: "ACTIVE",
        disbursedAt: new Date(data.disbursedAt || new Date()),
        guarantor1Id: data.guarantor1Id || null,
        guarantor2Id: data.guarantor2Id || null,
        disbursementMethod: data.disbursementMethod || null,
      },
      include: {
        member: true,
        cycle: true,
        sequence: true,
      },
    });

    // Update sequence
    await prisma.loanSequence.update({
      where: { id: sequence.id },
      data: {
        status: "DISBURSED",
        disbursedAt: new Date(data.disbursedAt || new Date()),
      },
    });

    // Group fund removed - no longer needed

    return NextResponse.json(
      {
        loan,
        message: "Loan disbursed successfully",
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

    console.error("Error disbursing loan:", error);
    return NextResponse.json(
      { error: "Failed to disburse loan" },
      { status: 500 }
    );
  }
}
