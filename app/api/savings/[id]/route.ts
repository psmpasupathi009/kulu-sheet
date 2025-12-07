import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const savings = await prisma.savings.findUnique({
      where: { id },
      include: {
        member: true,
        transactions: {
          orderBy: { date: 'asc' }, // Order by date ascending to calculate correctly
        },
      },
    })

    if (!savings) {
      return NextResponse.json({ error: 'Savings not found' }, { status: 404 })
    }

    // Recalculate total from positive transactions only (contributions)
    // Negative transactions from old loan disbursement logic should be ignored
    const calculatedTotal = savings.transactions.reduce((sum, t) => {
      // Only add positive amounts (contributions)
      return sum + Math.max(0, t.amount || 0);
    }, 0);
    const finalTotal = Math.max(0, calculatedTotal); // Ensure never negative
    
    // Always update to ensure consistency
    if (Math.abs(finalTotal - savings.totalAmount) > 0.001) {
      await prisma.savings.update({
        where: { id },
        data: { totalAmount: finalTotal },
      });
    }

    // Return with recalculated total and transactions ordered by date desc for display
    const savingsWithCorrectTotal = {
      ...savings,
      totalAmount: finalTotal,
      transactions: [...savings.transactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    };

    return NextResponse.json({ savings: savingsWithCorrectTotal }, { status: 200 })
  } catch (error) {
    console.error('Error fetching savings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch savings' },
      { status: 500 }
    )
  }
}

