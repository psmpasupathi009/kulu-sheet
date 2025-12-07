"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Plus, Edit, Trash2 } from 'lucide-react'
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

interface Savings {
  id: string
  member: {
    id: string
    name: string
    userId: string
  }
  totalAmount: number
}

export default function SavingsPage() {
  const [savings, setSavings] = useState<Savings[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    fetchSavings()
  }, [])

  const fetchSavings = async () => {
    try {
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/savings?t=${Date.now()}`)
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

  const handleDelete = async (savingId: string, memberName: string) => {
    try {
      const response = await fetch(`/api/savings/${savingId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success(`Savings record for ${memberName} deleted successfully`)
        fetchSavings() // Refresh the list
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete savings record')
      }
    } catch (error) {
      toast.error('Failed to delete savings record')
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Savings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">View member savings</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashbaord/savings/new">
              <Plus className="mr-2 h-4 w-4" />
              Record Contribution
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Savings</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead className="text-right">Total Savings</TableHead>
                <TableHead>Actions</TableHead>
                {user?.role === 'ADMIN' && <TableHead>Admin</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {savings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'ADMIN' ? 6 : 5} className="text-center text-muted-foreground">
                    No savings records found
                  </TableCell>
                </TableRow>
              ) : (
                savings.map((saving, index) => (
                  <TableRow key={saving.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{saving.member.name}</TableCell>
                    <TableCell>{saving.member.userId}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{Math.max(0, saving.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashbaord/savings/${saving.id}`}>View Details</Link>
                      </Button>
                    </TableCell>
                    {user?.role === 'ADMIN' && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-8 px-2">
                            <Link href={`/dashbaord/savings/${saving.id}`}>
                              <Edit className="h-3 w-3" />
                            </Link>
                          </Button>
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
                                <AlertDialogTitle>Delete Savings Record?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the savings record for <strong>{saving.member.name}</strong>?
                                  <br />
                                  <strong>Total Savings:</strong> ₹{Math.max(0, saving.totalAmount).toFixed(2)}
                                  <br />
                                  <br />
                                  This will delete all savings transactions for this member. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(saving.id, saving.member.name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
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

