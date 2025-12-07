"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Edit, Trash2 } from 'lucide-react'
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
import { toast } from 'sonner'

interface Loan {
  id: string
  member: {
    id: string
    name: string
    userId: string
  }
  principal: number
  remaining: number
  currentMonth: number
  months: number
  status: string
  group?: {
    groupNumber: number
    name: string | null
  } | null
}

export default function LoansPage() {
  const { user } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchLoans()
  }, [])

  const fetchLoans = async () => {
    try {
      const response = await fetch(`/api/loans?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        setLoans(data.loans)
      }
    } catch (error) {
      console.error('Error fetching loans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (loanId: string, memberName: string) => {
    setDeletingId(loanId)

    try {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete loan')
      }

      toast.success(`Loan for "${memberName}" deleted successfully`)
      fetchLoans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete loan')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] p-4 sm:p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Loan Details</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">View and manage loans</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Loans</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No loans found
                  </TableCell>
                </TableRow>
              ) : (
                loans.map((loan, index) => (
                  <TableRow key={loan.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{loan.member.name}</TableCell>
                    <TableCell>₹{loan.principal.toFixed(2)}</TableCell>
                    <TableCell>₹{loan.remaining.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                        loan.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        loan.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        loan.status === 'DEFAULTED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {loan.status}
                      </span>
                    </TableCell>
                    <TableCell>{loan.currentMonth}/{loan.months}</TableCell>
                    <TableCell>{loan.group ? `${loan.group.name || `Group ${loan.group.groupNumber}`}` : '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashbaord/loans/${loan.id}`}>View Details</Link>
                        </Button>
                        {user?.role === 'ADMIN' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-8 px-2">
                              <Link href={`/dashbaord/loans/${loan.id}`}>
                                <Edit className="h-3 w-3" />
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 px-2"
                                  disabled={deletingId === loan.id}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Loan?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this loan?
                                    <br />
                                    <strong>Member:</strong> {loan.member.name}
                                    <br />
                                    <strong>Principal:</strong> ₹{loan.principal.toFixed(2)}
                                    <br />
                                    <strong>Remaining:</strong> ₹{loan.remaining.toFixed(2)}
                                    <br />
                                    <br />
                                    This will permanently delete the loan and all associated transactions. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(loan.id, loan.member.name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

