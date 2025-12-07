import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, parseBody, handleApiError, resolveParams } from "@/lib/api-utils";
import { z } from "zod";

const giveLoanSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  disbursementMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: groupId } = await resolveParams(params);
    const body = await request.json();
    const parseResult = parseBody(body, giveLoanSchema);
    if (parseResult instanceof NextResponse) return parseResult;
    const { data } = parseResult;

    const group = await prisma.financingGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            member: true,
          },
        },
        collections: {
          where: {
            isCompleted: true,
            loanDisbursed: false,
          },
          orderBy: { month: "desc" },
          take: 1,
          include: {
            payments: {
              where: {
                status: "PAID",
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Financing group not found" },
        { status: 404 }
      );
    }

    const collection = group.collections[0];
    if (!collection) {
      return NextResponse.json(
        { error: "No completed collection found for loan disbursement" },
        { status: 400 }
      );
    }

    const loanMember = group.members.find(
      (gm) => gm.memberId === data.memberId
    );

    if (!loanMember) {
      return NextResponse.json(
        { error: "Selected member is not part of this group" },
        { status: 400 }
      );
    }

    const existingLoan = await prisma.loan.findFirst({
      where: {
        groupId: groupId,
        memberId: data.memberId,
      },
    });

    if (existingLoan) {
      return NextResponse.json(
        { error: "This member has already received a loan in this group. Each member can receive only one loan per financing group." },
        { status: 400 }
      );
    }

    const loanAmount = collection.totalCollected;
    const disbursedDate = new Date();
    const loanMonth = collection.month;
    const repaymentMonths = group.totalMembers - loanMonth + 1;
    
    const allCollections = await prisma.monthlyCollection.findMany({
      where: {
        groupId: groupId,
        month: { lte: loanMonth },
      },
      include: {
        payments: {
          where: {
            memberId: loanMember.memberId,
            status: "PAID",
          },
        },
      },
    });

    const memberContribution = allCollections.reduce((total, coll) => {
      const memberPayments = coll.payments || [];
      const monthTotal = memberPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return total + monthTotal;
    }, 0);

    const remainingLoanAmount = loanAmount - memberContribution;
    
    const result = await prisma.$transaction(
      async (tx) => {
        const monthsAlreadyPaid = Math.floor(memberContribution / group.monthlyAmount);
        const initialCurrentMonth = Math.min(monthsAlreadyPaid, repaymentMonths);
        const isLoanComplete = remainingLoanAmount <= 0.01 || initialCurrentMonth >= repaymentMonths;
        const initialStatus = isLoanComplete ? "COMPLETED" : "ACTIVE";
        
        const loan = await tx.loan.create({
          data: {
            memberId: loanMember.memberId,
            groupId: groupId,
            principal: loanAmount,
            remaining: Math.max(0, remainingLoanAmount),
            months: repaymentMonths,
            loanMonth: loanMonth,
            currentMonth: initialCurrentMonth,
            status: initialStatus,
            disbursedAt: disbursedDate,
            disbursementMethod: data.disbursementMethod || null,
            totalPrincipalPaid: memberContribution,
            completedAt: isLoanComplete ? disbursedDate : null,
          },
        });

        if (memberContribution > 0 && initialCurrentMonth > 0) {
          let runningRemaining = loanAmount;
          for (let month = 1; month <= initialCurrentMonth; month++) {
            const paymentAmount = group.monthlyAmount;
            runningRemaining = Math.max(0, runningRemaining - paymentAmount);
            
            const monthCollection = allCollections.find(c => c.month === month);
            const monthPayment = monthCollection?.payments?.find(
              p => p.memberId === loanMember.memberId && p.status === "PAID"
            );
            
            await tx.loanTransaction.create({
              data: {
                loanId: loan.id,
                date: monthPayment?.paymentDate || disbursedDate,
                amount: paymentAmount,
                remaining: runningRemaining,
                month: month,
                paymentMethod: monthPayment?.paymentMethod || null,
              },
            });
          }
          
          if (Math.abs(runningRemaining - remainingLoanAmount) > 0.01) {
            if (process.env.NODE_ENV === "development") {
              console.error(`Loan ${loan.id}: Transaction remaining (${runningRemaining}) doesn't match calculated remaining (${remainingLoanAmount}). Updating loan.remaining to match.`);
            }
            await tx.loan.update({
              where: { id: loan.id },
              data: { remaining: runningRemaining },
            });
          }
        }
        
        const finalLoan = await tx.loan.findUnique({
          where: { id: loan.id },
        });
        
        if (finalLoan) {
          const shouldBeComplete = finalLoan.remaining <= 0.01 || finalLoan.currentMonth >= finalLoan.months;
          if (shouldBeComplete && finalLoan.status !== "COMPLETED") {
            await tx.loan.update({
              where: { id: loan.id },
              data: {
                status: "COMPLETED",
                completedAt: finalLoan.completedAt || disbursedDate,
              },
            });
          } else if (!shouldBeComplete && finalLoan.status === "COMPLETED") {
            await tx.loan.update({
              where: { id: loan.id },
              data: {
                status: "ACTIVE",
                completedAt: null,
              },
            });
          }
        }

        await tx.monthlyCollection.update({
          where: { id: collection.id },
          data: {
            loanMemberId: loanMember.memberId,
            loanAmount: loanAmount,
            loanDisbursed: true,
          },
        });

        const loansGiven = await tx.loan.count({
          where: {
            groupId: groupId,
          },
        });

        if (loansGiven >= group.totalMembers) {
          await tx.financingGroup.update({
            where: { id: groupId },
            data: {
              isActive: false,
              endDate: disbursedDate,
            },
          });
        }

        return { loan, member: loanMember.member };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    const monthsPaid = Math.floor(memberContribution / group.monthlyAmount);
    const message = memberContribution > 0
      ? `Loan of ₹${loanAmount.toFixed(2)} disbursed successfully to ${result.member.name}. Their cumulative contribution of ₹${memberContribution.toFixed(2)} (${monthsPaid} months) is already counted. Remaining to repay: ₹${remainingLoanAmount.toFixed(2)} over ${repaymentMonths - monthsPaid} months.`
      : `Loan of ₹${loanAmount.toFixed(2)} disbursed successfully to ${result.member.name}. Remaining to repay: ₹${remainingLoanAmount.toFixed(2)} over ${repaymentMonths} months.`;

    return NextResponse.json(
      {
        loan: result.loan,
        message,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, "give loan");
  }
}

