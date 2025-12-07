import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { format, addMonths } from "date-fns";

const createCollectionSchema = z.object({
  collectionDate: z.string(),
});

const recordPaymentSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
  month: z.number().int().positive().optional(), // Optional month number
  collectionDate: z.string().optional(), // Optional collection date
});

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
    const data = createCollectionSchema.parse(body);

    // Get group
    const group = await prisma.financingGroup.findUnique({
      where: { id },
      include: {
        collections: {
          orderBy: { month: "desc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    if (!group.isActive) {
      return NextResponse.json(
        { error: "Group is not active" },
        { status: 400 }
      );
    }

    // Get next month number
    const lastCollection = group.collections[0];
    const nextMonth = lastCollection ? lastCollection.month + 1 : 1;

    if (nextMonth > group.totalMembers) {
      return NextResponse.json(
        {
          error: `Financing group cycle is complete (${group.totalMembers} months)`,
        },
        { status: 400 }
      );
    }

    const expectedAmount = group.monthlyAmount * group.totalMembers;
    const collectionDate = new Date(data.collectionDate);

    // Create monthly collection
    const collection = await prisma.monthlyCollection.create({
      data: {
        groupId: id,
        month: nextMonth,
        collectionDate: collectionDate,
        expectedAmount: expectedAmount,
        totalCollected: 0,
        isCompleted: false,
        loanDisbursed: false,
      },
    });

    // Update group current month
    await prisma.financingGroup.update({
      where: { id },
      data: { currentMonth: nextMonth },
    });

    return NextResponse.json(
      {
        collection,
        message: `Monthly collection created for month ${nextMonth}. Expected: ₹${expectedAmount.toFixed(
          2
        )} from ${group.totalMembers} members.`,
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

    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const { id: groupId } = await params;
    const body = await request.json();
    const data = recordPaymentSchema.parse(body);

    // Get group and find/create collection for the specified month
    // Fetch ALL collections to check if target month exists
    const group = await prisma.financingGroup.findUnique({
      where: { id: groupId },
      include: {
        collections: {
          orderBy: { month: "asc" }, // Get all collections ordered by month
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    if (!group.isActive) {
      return NextResponse.json(
        { error: "Group is not active" },
        { status: 400 }
      );
    }

    // Determine which month's collection to use
    let targetMonth: number;
    if (data.month) {
      targetMonth = data.month;
      if (targetMonth < 1 || targetMonth > group.totalMembers) {
        return NextResponse.json(
          {
            error: `Invalid month. Must be between 1 and ${group.totalMembers}`,
          },
          { status: 400 }
        );
      }
    } else {
      // Use current incomplete collection or next month
      const incompleteCollection = group.collections.find(
        (c) => !c.isCompleted
      );
      if (incompleteCollection) {
        targetMonth = incompleteCollection.month;
      } else {
        const lastCollection = group.collections[0];
        targetMonth = lastCollection ? lastCollection.month + 1 : 1;
        if (targetMonth > group.totalMembers) {
          return NextResponse.json(
            { error: "All months have been completed" },
            { status: 400 }
          );
        }
      }
    }

    // Find or create collection for this month
    // First check if it exists (to avoid transaction conflicts)
    let collection =
      group.collections.find((c) => c.month === targetMonth) || null;

    if (!collection) {
      const expectedAmount = group.monthlyAmount * group.totalMembers;
      const collectionDate = data.collectionDate
        ? new Date(data.collectionDate)
        : new Date();

      // Try to create collection, handle case where it might be created by another request
      try {
        collection = await prisma.monthlyCollection.create({
          data: {
            groupId: groupId,
            month: targetMonth,
            collectionDate: collectionDate,
            expectedAmount: expectedAmount,
            totalCollected: 0,
            isCompleted: false,
            loanDisbursed: false,
          },
        });

        // Update group's currentMonth if this is a new month
        if (targetMonth > group.currentMonth) {
          await prisma.financingGroup.update({
            where: { id: groupId },
            data: { currentMonth: targetMonth },
          });
        }
      } catch (createError: any) {
        // If collection already exists (unique constraint), fetch it
        if (createError.code === "P2002") {
          collection = await prisma.monthlyCollection.findUnique({
            where: {
              groupId_month: {
                groupId: groupId,
                month: targetMonth,
              },
            },
          });

          if (!collection) {
            throw new Error("Failed to create or find collection");
          }
        } else {
          throw createError;
        }
      }
    }

    if (collection.loanDisbursed) {
      return NextResponse.json(
        {
          error: "Loan has already been disbursed for this month's collection",
        },
        { status: 400 }
      );
    }

    // Check if member is in group
    const groupMember = await prisma.financingGroupMember.findUnique({
      where: {
        groupId_memberId: {
          groupId: groupId,
          memberId: data.memberId,
        },
      },
    });

    if (!groupMember) {
      return NextResponse.json(
        { error: "Member is not part of this group" },
        { status: 400 }
      );
    }

    // Check if member has already received a loan
    // Members who received loans CAN still pay monthly contributions in subsequent months
    // They just won't receive another loan - their payments count towards the collection
    // The only restriction is: they can't receive a loan more than once per group
    // So we allow them to pay, but they won't be eligible for future loans
    const memberLoan = await prisma.loan.findFirst({
      where: {
        groupId: groupId,
        memberId: data.memberId,
      },
    });

    // No restriction on payments - members who received loans can still contribute
    // Their payments will count towards the collection total for that month
    // They just won't be eligible to receive another loan

    // Check if payment already exists for this member and month
    const existingPayment = await prisma.collectionPayment.findUnique({
      where: {
        collectionId_memberId: {
          collectionId: collection.id,
          memberId: data.memberId,
        },
      },
    });

    // If payment already exists and is PAID, don't allow duplicate
    // Check status case-insensitively
    const existingStatus = existingPayment
      ? String(existingPayment.status || "")
          .trim()
          .toUpperCase()
      : "";
    if (existingPayment && existingStatus === "PAID") {
      return NextResponse.json(
        {
          error: `This member has already paid for ${format(
            addMonths(new Date(group.startDate), targetMonth - 1),
            "MMMM yyyy"
          )}. Payment date: ${format(
            new Date(existingPayment.paymentDate),
            "dd MMM yyyy"
          )}. Cannot record duplicate payment.`,
          existingPayment: {
            date: existingPayment.paymentDate,
            amount: existingPayment.amount,
            status: existingPayment.status,
          },
        },
        { status: 400 }
      );
    }

    const paymentDate = data.collectionDate
      ? new Date(data.collectionDate)
      : new Date();

    if (existingPayment) {
      // Update existing payment (if status was PENDING)
      await prisma.collectionPayment.update({
        where: { id: existingPayment.id },
        data: {
          amount: data.amount,
          paymentDate: paymentDate,
          status: "PAID",
          paymentMethod: data.paymentMethod || null,
        },
      });
    } else {
      // Create new payment
      await prisma.collectionPayment.create({
        data: {
          collectionId: collection.id,
          memberId: data.memberId,
          amount: data.amount,
          paymentDate: paymentDate,
          status: "PAID",
          paymentMethod: data.paymentMethod || null,
        },
      });
    }

    // Update collection totals - recalculate from all payments
    // Fetch ALL payments (not filtered) to ensure we have complete data
    const updatedCollection = await prisma.monthlyCollection.findUnique({
      where: { id: collection.id },
      include: {
        payments: true, // Get all payments, we'll filter in code
      },
    });

    if (updatedCollection) {
      // Calculate total from all PAID payments (case-insensitive check)
      const totalCollected = updatedCollection.payments.reduce((sum, p) => {
        // Only count payments with PAID status (case-insensitive check)
        const status = String(p.status || "")
          .trim()
          .toUpperCase();
        if (status === "PAID") {
          return sum + (Number(p.amount) || 0);
        }
        return sum;
      }, 0);

      // Check if collection is completed (total >= expected)
      const isCompleted = totalCollected >= updatedCollection.expectedAmount;

      // Update collection with recalculated totals
      await prisma.monthlyCollection.update({
        where: { id: collection.id },
        data: {
          totalCollected: totalCollected,
          isCompleted: isCompleted,
        },
      });

      console.log(
        `Collection ${collection.id} (Month ${updatedCollection.month}) updated: Total=₹${totalCollected}, Expected=₹${updatedCollection.expectedAmount}, Completed=${isCompleted}, Payments count=${updatedCollection.payments.length}`
      );

      // Add payment to member's savings
      // Check if this payment was already added to savings (in case collection was deleted and recreated)
      const member = await prisma.member.findUnique({
        where: { id: data.memberId },
        include: {
          savings: true,
        },
      });

      if (member) {
        // Get or create savings record
        let savings = member.savings[0];
        if (!savings) {
          savings = await prisma.savings.create({
            data: {
              memberId: member.id,
              totalAmount: 0,
            },
          });
        }

        // Check if a savings transaction already exists for this payment
        // (to avoid double-counting if collection was deleted and recreated)
        // Look for transactions on the same date with the same amount
        const existingSavingsTransaction =
          await prisma.savingsTransaction.findFirst({
            where: {
              savingsId: savings.id,
              date: {
                gte: new Date(new Date(paymentDate).setHours(0, 0, 0, 0)),
                lte: new Date(new Date(paymentDate).setHours(23, 59, 59, 999)),
              },
              amount: data.amount,
            },
          });

        if (!existingSavingsTransaction) {
          // Only add to savings if it wasn't already added
          const newTotal = savings.totalAmount + data.amount;
          await prisma.savings.update({
            where: { id: savings.id },
            data: { totalAmount: newTotal },
          });

          await prisma.savingsTransaction.create({
            data: {
              savingsId: savings.id,
              date: paymentDate,
              amount: data.amount,
              total: newTotal,
            },
          });
        }
      }
    }

    // Return the updated collection with payment details
    const finalCollection = await prisma.monthlyCollection.findUnique({
      where: { id: collection.id },
      include: {
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
        group: {
          select: {
            id: true,
            currentMonth: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Payment recorded successfully",
        collection: finalCollection,
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

    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
