"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Transaction {
  id: string
  date: string
  amount: number
  total: number
}

interface Savings {
  id: string
  member: {
    name: string
    userId: string
  }
  totalAmount: number
  transactions: Transaction[]
}

export default function SavingsDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [savings, setSavings] = useState<Savings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchSavings(params.id as string)
    }
  }, [params.id])

  const fetchSavings = async (id: string) => {
    try {
      const response = await fetch(`/api/savings/${id}`)
      if (response.ok) {
        const data = await response.json()
        setSavings(data.savings)
      }
    } catch (error) {
      console.error('Error fetching savings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!savings) {
    return <div>Savings not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/dashbaord/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Savings Details</h1>
          <p className="text-muted-foreground">{savings.member.name} - {savings.member.userId}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Savings: ₹{savings.totalAmount.toFixed(2)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Total</TableHead>
                {user?.role === 'ADMIN' && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {savings.transactions.filter(t => t.amount > 0).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'ADMIN' ? 5 : 4} className="text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                savings.transactions
                  .filter(t => t.amount > 0) // Only show positive transactions (contributions)
                  .map((transaction, index) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>₹{transaction.amount.toFixed(2)}</TableCell>
                      <TableCell>₹{transaction.total.toFixed(2)}</TableCell>
                      {user?.role === 'ADMIN' && (
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 px-2">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this savings transaction?
                                  <br />
                                  <strong>Date:</strong> {format(new Date(transaction.date), 'dd MMM yyyy')}
                                  <br />
                                  <strong>Amount:</strong> ₹{transaction.amount.toFixed(2)}
                                  <br />
                                  <br />
                                  This will recalculate the total savings. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(
                                        `/api/savings/transactions/${transaction.id}`,
                                        { method: 'DELETE' }
                                      )
                                      if (response.ok) {
                                        toast.success('Transaction deleted successfully')
                                        window.location.reload()
                                      } else {
                                        const data = await response.json()
                                        toast.error(data.error || 'Failed to delete transaction')
                                      }
                                    } catch (error) {
                                      toast.error('Failed to delete transaction')
                                    }
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

