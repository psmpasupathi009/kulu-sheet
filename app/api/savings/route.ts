import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const createSavingsSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  date: z.string(),
})

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get savings based on user role
    let savings;
    if (user.role === "ADMIN") {
      // Admin sees all savings
      savings = await prisma.savings.findMany({
        include: {
          member: {
            select: {
              id: true,
              name: true,
              userId: true,
            },
          },
          transactions: {
            orderBy: { date: 'asc' }, // Order by date ascending to calculate running total correctly
          },
        },
      })
    } else {
      // Regular users see only their own savings
      const member = await prisma.member.findUnique({
        where: { userId: user.userId || "" },
      })

      if (!member) {
        return NextResponse.json({ savings: [] }, { status: 200 })
      }

      savings = await prisma.savings.findMany({
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
            orderBy: { date: 'asc' }, // Order by date ascending to calculate running total correctly
          },
        },
      })
    }

    // Recalculate totals from transactions to ensure accuracy
    // Only count positive transactions (contributions) - loans don't deduct from savings
    const savingsWithRecalculatedTotals = await Promise.all(
      savings.map(async (saving) => {
        // Calculate total from positive transactions only (contributions)
        // Negative transactions from old loan disbursement logic should be ignored
        const calculatedTotal = saving.transactions.reduce((sum, t) => {
          // Only add positive amounts (contributions)
          // Negative amounts are from old loan disbursement logic and should be ignored
          return sum + Math.max(0, t.amount || 0);
        }, 0);
        
        // Ensure total is never negative (savings can't be negative)
        const finalTotal = Math.max(0, calculatedTotal);
        
        // Always update to ensure consistency
        if (Math.abs(finalTotal - saving.totalAmount) > 0.001) {
          await prisma.savings.update({
            where: { id: saving.id },
            data: { totalAmount: finalTotal },
          });
        }
        
        // Filter out negative transactions (from old loan disbursement logic)
        const positiveTransactions = saving.transactions.filter(t => t.amount > 0);
        
        return { 
          ...saving, 
          totalAmount: finalTotal,
          transactions: positiveTransactions, // Only return positive transactions
          member: saving.member,
        };
      })
    );

    return NextResponse.json({ savings: savingsWithRecalculatedTotals }, { status: 200 })
  } catch (error) {
    console.error('Error fetching savings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch savings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyToken(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createSavingsSchema.parse(body)

    // Find or create savings record
    let savings = await prisma.savings.findFirst({
      where: { memberId: data.memberId },
    })

    if (!savings) {
      savings = await prisma.savings.create({
        data: {
          memberId: data.memberId,
          totalAmount: 0,
        },
      })
    }

    // Recalculate current total from all existing transactions first
    const allTransactions = await prisma.savingsTransaction.findMany({
      where: { savingsId: savings.id },
      orderBy: { date: 'asc' },
    });

    // Calculate current total from all transactions (only positive amounts)
    const currentTotal = allTransactions.reduce(
      (sum, t) => sum + Math.max(0, t.amount || 0),
      0
    );

    // New total after adding this transaction
    const newTotal = currentTotal + data.amount;

    // Create transaction with correct running total
    const transaction = await prisma.savingsTransaction.create({
      data: {
        savingsId: savings.id,
        date: new Date(data.date),
        amount: data.amount,
        total: newTotal,
      },
    })

    // Update total
    const updatedSavings = await prisma.savings.update({
      where: { id: savings.id },
      data: { totalAmount: newTotal },
    })

    // Weekly contributions are now added directly to member's savings (handled above)

    return NextResponse.json(
      { transaction, savings: updatedSavings },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating savings transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create savings transaction' },
      { status: 500 }
    )
  }
}

