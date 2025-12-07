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

    // Get group with current collection
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

    // Find the selected member
    const loanMember = group.members.find(
      (gm) => gm.memberId === data.memberId
    );

    if (!loanMember) {
      return NextResponse.json(
        { error: "Selected member is not part of this group" },
        { status: 400 }
      );
    }

    // Check if this member already received a loan in this group
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

    const loanAmount = collection.totalCollected; // Pooled amount from all members
    const disbursedDate = new Date();

    // Repayment formula: repaymentMonths = totalMembers - loanMonth + 1
    // Example: 4 members, loan in month 1 → repays 4 months (4 - 1 + 1 = 4)
    // Example: 4 members, loan in month 2 → repays 3 months (4 - 2 + 1 = 3)
    // Example: 4 members, loan in month 4 → repays 1 month (4 - 4 + 1 = 1)
    // IMPORTANT: All members pay the SAME monthlyAmount (₹2000) regardless of when they get the loan
    // Monthly payment = group.monthlyAmount (NOT principal/months or remaining/remainingMonths)
    const loanMonth = collection.month; // Month when loan is being disbursed
    const repaymentMonths = group.totalMembers - loanMonth + 1;
    
    // Calculate CUMULATIVE contributions from ALL previous months (1 to loanMonth)
    // Member 1 (month 1): ₹2000 (month 1 only)
    // Member 2 (month 2): ₹4000 (month 1 + month 2)
    // Member 3 (month 3): ₹6000 (month 1 + month 2 + month 3)
    // Member 4 (month 4): ₹8000 (month 1 + month 2 + month 3 + month 4)
    const allCollections = await prisma.monthlyCollection.findMany({
      where: {
        groupId: groupId,
        month: { lte: loanMonth }, // All months up to and including loan month
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

    // Sum all payments made by this member from month 1 to loanMonth
    const memberContribution = allCollections.reduce((total, coll) => {
      const memberPayments = coll.payments || [];
      const monthTotal = memberPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return total + monthTotal;
    }, 0);

    const remainingLoanAmount = loanAmount - memberContribution;
    
    // Create loan from the pooled collection (no deduction from savings)
    // The loan comes from the collection, not from individual savings
    const result = await prisma.$transaction(
      async (tx) => {
        // Create loan
        // Calculate how many months the member has already paid (based on cumulative contributions)
        // Each month = ₹2000, so months paid = memberContribution / monthlyAmount
        const monthsAlreadyPaid = Math.floor(memberContribution / group.monthlyAmount);
        const initialCurrentMonth = Math.min(monthsAlreadyPaid, repaymentMonths);
        
        // Check if loan is already complete (member paid all required months)
        const isLoanComplete = remainingLoanAmount <= 0.01 || initialCurrentMonth >= repaymentMonths;
        const initialStatus = isLoanComplete ? "COMPLETED" : "ACTIVE";
        
        const loan = await tx.loan.create({
          data: {
            memberId: loanMember.memberId,
            groupId: groupId,
            principal: loanAmount, // Full loan amount received
            remaining: Math.max(0, remainingLoanAmount), // Remaining after deducting their contribution (never negative)
            months: repaymentMonths, // Total months member must pay (totalMembers - loanMonth + 1)
            loanMonth: loanMonth, // Record which month loan was disbursed
            currentMonth: initialCurrentMonth, // Number of payments already made (based on cumulative contributions)
            status: initialStatus,
            disbursedAt: disbursedDate,
            disbursementMethod: data.disbursementMethod || null,
            totalPrincipalPaid: memberContribution, // Cumulative contributions from months 1 to loanMonth
            completedAt: isLoanComplete ? disbursedDate : null,
          },
        });

        // Create transaction records for all months the member has already paid
        // If member paid ₹4000 (2 months), create 2 transactions for months 1 and 2
        // Calculate remaining amounts correctly: start from loanAmount and subtract each payment
        if (memberContribution > 0 && initialCurrentMonth > 0) {
          let runningRemaining = loanAmount; // Start from full loan amount
          for (let month = 1; month <= initialCurrentMonth; month++) {
            const paymentAmount = group.monthlyAmount;
            runningRemaining = Math.max(0, runningRemaining - paymentAmount);
            
            // Verify: After all transactions, runningRemaining should equal remainingLoanAmount
            // For Member 2: ₹8000 - ₹2000 (month 1) - ₹2000 (month 2) = ₹4000 ✓
            
            // Find the actual payment date from the collection for this month
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
          
          // Verify the final remaining matches our calculation
          if (Math.abs(runningRemaining - remainingLoanAmount) > 0.01) {
            // Update the loan's remaining amount to match the transaction calculation
            if (process.env.NODE_ENV === "development") {
              console.error(`Loan ${loan.id}: Transaction remaining (${runningRemaining}) doesn't match calculated remaining (${remainingLoanAmount}). Updating loan.remaining to match.`);
            }
            await tx.loan.update({
              where: { id: loan.id },
              data: { remaining: runningRemaining },
            });
          }
        }
        
        // Final verification: Ensure loan status is correct based on remaining and currentMonth
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

        // Update collection
        await tx.monthlyCollection.update({
          where: { id: collection.id },
          data: {
            loanMemberId: loanMember.memberId,
            loanAmount: loanAmount,
            loanDisbursed: true,
          },
        });

        // Check if all members have received loans (financing group cycle complete)
        // Count all loans (ACTIVE, COMPLETED, PENDING) for this group
        const loansGiven = await tx.loan.count({
          where: {
            groupId: groupId,
          },
        });

        // If all members have received loans, mark group as inactive
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

