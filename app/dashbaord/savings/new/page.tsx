"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, Users, IndianRupee } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { format, addMonths } from 'date-fns'

interface Member {
  id: string
  name: string
  userId: string
}

interface FinancingGroup {
  id: string
  groupNumber: number
  name: string | null
  monthlyAmount: number
  totalMembers: number
  isActive: boolean
  currentMonth: number
  startDate: string
  collections: Array<{
    id: string
    month: number
    collectionDate: string
    isCompleted: boolean
    loanDisbursed: boolean
    payments: Array<{
      id: string
      memberId: string
      amount: number
      paymentDate: string
      status: string
      member?: {
        name: string
        userId: string
      }
    }>
  }>
  members: Array<{
    memberId: string
    joinMonth: number
    member: {
      id: string
      name: string
      userId: string
    }
  }>
  loans?: Array<{
    id: string
    memberId: string
    loanMonth: number | null
    months: number
    currentMonth: number
    principal: number
    remaining: number
    status: string
  }>
}

export default function NewSavingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [isMonthlyContribution, setIsMonthlyContribution] = useState(false)
  const [financingGroups, setFinancingGroups] = useState<FinancingGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState<number>(0)
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMembers()
    if (isMonthlyContribution) {
      fetchFinancingGroups()
    }
  }, [isMonthlyContribution])

  // Refresh financing groups when month or group changes to get latest payment data
  useEffect(() => {
    if (isMonthlyContribution && selectedGroupId && selectedMonth) {
      // Refresh data when month changes to get latest payment status
      fetchFinancingGroups()
      // Clear selected members when month/group changes to avoid stale selections
      setSelectedMemberIds([])
    }
  }, [selectedMonth, selectedGroupId, isMonthlyContribution])

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/members')
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFinancingGroups = async () => {
    try {
      // Add cache-busting timestamp to ensure fresh data
      const response = await fetch(`/api/financing-groups?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        const activeGroups = data.groups.filter((g: FinancingGroup) => g.isActive)
        setFinancingGroups(activeGroups)
      }
    } catch (error) {
      console.error('Error fetching financing groups:', error)
    }
  }

  const selectedGroup = financingGroups.find(g => g.id === selectedGroupId)
  // Show only months that need payment (not completed or not all members paid, and loan not disbursed)
  const availableMonths = selectedGroup 
    ? Array.from({ length: selectedGroup.totalMembers }, (_, i) => i + 1)
        .filter(month => {
          const collection = selectedGroup.collections.find(c => c.month === month)
          // Don't show months where loan is already disbursed (month is fully done)
          if (collection?.loanDisbursed) return false
          // Show months that:
          // 1. Don't have a collection yet, OR
          // 2. Have a collection but it's not completed (not all members paid), OR
          // 3. Have a collection that's completed but loan not disbursed (can still record if needed)
          return true
        })
    : []
  
  // Get month name based on group start date
  const getMonthName = (monthNumber: number) => {
    if (!selectedGroup) return `Month ${monthNumber}`
    const startDate = new Date(selectedGroup.startDate)
    const monthDate = addMonths(startDate, monthNumber - 1)
    return format(monthDate, 'MMMM yyyy')
  }
  
  // Get unpaid members for selected month
  const getUnpaidMembers = () => {
    if (!selectedGroup || !selectedMonth) return members
    
    const collection = selectedGroup.collections.find(c => c.month === selectedMonth)
    
    // Get members who have already paid for this month
    const paidMemberIds = (collection?.payments || [])
      .filter(p => {
        const status = String(p.status || '').trim().toUpperCase()
        return status === 'PAID' || (p.amount && p.amount > 0)
      })
      .map(p => p.memberId)
    
    // Get members who have received loans and should stop paying after their loan month
    const membersWithLoans = (selectedGroup.loans || []).filter(loan => 
      loan.loanMonth && loan.loanMonth < selectedMonth
    )
    const membersWhoStoppedPaying = membersWithLoans.map(loan => loan.memberId)
    
    // Return only group members who:
    // 1. Are part of the group
    // 2. Haven't paid for this month
    // 3. Haven't received a loan before this month (they stop paying after loan)
    return members.filter(m => {
      const isGroupMember = selectedGroup.members.some(gm => gm.memberId === m.id)
      const hasPaid = paidMemberIds.includes(m.id)
      const hasStoppedPaying = membersWhoStoppedPaying.includes(m.id)
      return isGroupMember && !hasPaid && !hasStoppedPaying
    })
  }
  
  // Filter members to show only unpaid ones when monthly contribution is selected
  const availableMembers = isMonthlyContribution && selectedGroup && selectedMonth
    ? getUnpaidMembers()
    : members
  
  // Auto-select date when month is selected
  useEffect(() => {
    if (selectedGroup && selectedMonth && isMonthlyContribution) {
      const collection = selectedGroup.collections.find(c => c.month === selectedMonth)
      if (collection) {
        // Use collection date if it exists
        setFormData(prev => ({
          ...prev,
          date: new Date(collection.collectionDate).toISOString().split('T')[0]
        }))
      } else {
        // Calculate date from group start date + month offset
        const startDate = new Date(selectedGroup.startDate)
        const monthDate = addMonths(startDate, selectedMonth - 1)
        setFormData(prev => ({
          ...prev,
          date: format(monthDate, 'yyyy-MM-dd')
        }))
      }
    }
  }, [selectedMonth, selectedGroup, isMonthlyContribution])

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
  }

  const toggleSelectAll = () => {
    const membersToUse = isMonthlyContribution && selectedGroup && selectedMonth
      ? getUnpaidMembers()
      : members
    
    if (selectedMemberIds.length === membersToUse.length && membersToUse.length > 0) {
      setSelectedMemberIds([])
    } else {
      setSelectedMemberIds(membersToUse.map((m) => m.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    if (selectedMemberIds.length === 0) {
      toast.error('Please select at least one member')
      setSubmitting(false)
      return
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      setSubmitting(false)
      return
    }

    if (isMonthlyContribution) {
      if (!selectedGroupId) {
        toast.error('Please select a financing group')
        setSubmitting(false)
        return
      }
      if (!selectedMonth) {
        toast.error('Please select a month')
        setSubmitting(false)
        return
      }
    }

    try {
      if (isMonthlyContribution && selectedGroupId && selectedMonth) {
        // Record as collection payment (which also adds to savings)
        const promises = selectedMemberIds.map((memberId) =>
          fetch(`/api/financing-groups/${selectedGroupId}/collections`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: memberId,
              amount: parseFloat(formData.amount),
              paymentMethod: 'CASH',
              month: selectedMonth,
              collectionDate: formData.date,
            }),
          })
        )

        const responses = await Promise.all(promises)
        const results = await Promise.all(responses.map((r) => r.json()))

        const failed = results.filter((r, i) => !responses[i].ok)
        if (failed.length > 0) {
          throw new Error(failed[0].error || 'Failed to record some contributions')
        }

        toast.success(
          `₹${parseFloat(formData.amount).toFixed(2)} monthly contribution recorded for ${selectedMemberIds.length} member(s) in month ${selectedMonth}!`
        )
        
        // Refresh financing groups to update unpaid members list
        await fetchFinancingGroups()
        
        // Clear selected members after successful payment
        setSelectedMemberIds([])
        
        // Redirect to financing groups page to see the updated collection
        setTimeout(() => {
          router.push('/dashbaord/cycles')
        }, 1500)
        return
      } else {
        // Record as regular savings contribution
        const promises = selectedMemberIds.map((memberId) =>
          fetch('/api/savings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: memberId,
              amount: parseFloat(formData.amount),
              date: formData.date,
            }),
          })
        )

        const responses = await Promise.all(promises)
        const results = await Promise.all(responses.map((r) => r.json()))

        const failed = results.filter((r, i) => !responses[i].ok)
        if (failed.length > 0) {
          throw new Error(failed[0].error || 'Failed to record some contributions')
        }

        toast.success(
          `₹${parseFloat(formData.amount).toFixed(2)} contribution recorded for ${selectedMemberIds.length} member(s) successfully!`
        )
      }

      setTimeout(() => {
        router.push('/dashbaord/savings')
      }, 1500)
    } catch (err: any) {
      toast.error(err.message || 'Failed to record contribution')
    } finally {
      setSubmitting(false)
    }
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <div className="p-4 border border-destructive rounded-md bg-destructive/10">
          <p className="text-destructive">Access denied. Admin privileges required.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashbaord/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Savings
          </Link>
        </Button>
      </div>
    )
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Record Contribution</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {isMonthlyContribution 
              ? 'Record monthly contribution for selected members'
              : 'Record contribution for selected members'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contribution Details</CardTitle>
          <CardDescription>
            {isMonthlyContribution 
              ? 'Record monthly contribution for selected members. The amount will be added to each member\'s savings.'
              : 'Record contribution for selected members. The amount will be added to each member\'s savings.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
              <Field>
                <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card">
                  <Checkbox
                    id="isMonthlyContribution"
                    checked={isMonthlyContribution}
                    onCheckedChange={(checked) => {
                      setIsMonthlyContribution(checked === true)
                      if (!checked) {
                        setSelectedGroupId("")
                        setSelectedMonth(0)
                      }
                    }}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="isMonthlyContribution"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                      Monthly Contribution
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isMonthlyContribution 
                        ? 'This is a monthly contribution for a financing group'
                        : 'Check this box if this is a monthly contribution for a financing group'}
                    </p>
                  </div>
                </div>
              </Field>

              {isMonthlyContribution && (
                <>
                  <Field>
                    <FieldLabel>
                      <Users className="mr-2 h-4 w-4 inline" />
                      Select Financing Group <span className="text-destructive">*</span>
                    </FieldLabel>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => {
                        setSelectedGroupId(e.target.value)
                        setSelectedMonth(0)
                      }}
                      required={isMonthlyContribution}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select financing group</option>
                      {financingGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          Group {group.groupNumber} {group.name ? `- ${group.name}` : ''} (₹{group.monthlyAmount.toFixed(2)}/month, {group.totalMembers} members)
                        </option>
                      ))}
                    </select>
                    <FieldDescription>
                      Select the financing group for this monthly contribution
                    </FieldDescription>
                  </Field>

                  {selectedGroup && (
                    <Field>
                      <FieldLabel>
                        <Calendar className="mr-2 h-4 w-4 inline" />
                        Select Month <span className="text-destructive">*</span>
                      </FieldLabel>
                      <select
                        value={selectedMonth || 0}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        required={isMonthlyContribution}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value={0}>Select month</option>
                        {availableMonths.map((month) => {
                          const collection = selectedGroup?.collections.find(c => c.month === month)
                          const isCompleted = collection?.isCompleted
                          const isDisbursed = collection?.loanDisbursed
                          return (
                            <option key={month} value={month}>
                              {getMonthName(month)}
                              {isCompleted && !isDisbursed ? " (Completed, loan pending)" : ""}
                              {isDisbursed ? " (Loan disbursed - not available)" : ""}
                            </option>
                          )
                        })}
                      </select>
                      <FieldDescription>
                        {availableMonths.length === 0
                          ? "All months are completed and loans disbursed. No months available for contribution."
                          : `Select the month for this contribution. ${availableMonths.length} month(s) available for payment.`}
                      </FieldDescription>
                    </Field>
                  )}
                </>
              )}

              <Field>
                <FieldLabel>
                  <Users className="mr-2 h-4 w-4 inline" />
                  Select Members <span className="text-destructive">*</span>
                  {isMonthlyContribution && selectedGroup && selectedMonth && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                      (Showing only unpaid members)
                    </span>
                  )}
                </FieldLabel>
                <div className="border rounded-lg bg-card overflow-hidden">
                  {/* Select All Header - Fixed */}
                  <div className="flex items-center space-x-3 p-4 border-b bg-muted/30 sticky top-0 z-10">
                    <Checkbox
                      id="selectAll"
                      checked={selectedMemberIds.length === availableMembers.length && availableMembers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <Label
                      htmlFor="selectAll"
                      className="text-sm font-semibold leading-none cursor-pointer flex-1">
                      {selectedMemberIds.length === availableMembers.length && availableMembers.length > 0
                        ? "Deselect All" 
                        : "Select All"}
                    </Label>
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedMemberIds.length} / {availableMembers.length}
                      {isMonthlyContribution && selectedGroup && selectedMonth && (
                        <span className="ml-1 text-blue-600 dark:text-blue-400">
                          (unpaid)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Scrollable Member List */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {availableMembers.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          {isMonthlyContribution && selectedGroup && selectedMonth
                            ? "All members have already paid for this month."
                            : "No members found. Please create members first."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {availableMembers.map((member) => (
                          <div
                            key={member.id}
                            className={`flex items-center space-x-3 p-3 rounded-md transition-colors mb-1 ${
                              selectedMemberIds.includes(member.id)
                                ? "bg-primary/10"
                                : "hover:bg-accent/50"
                            }`}>
                            <Checkbox
                              id={`member-${member.id}`}
                              checked={selectedMemberIds.includes(member.id)}
                              onCheckedChange={() => toggleMemberSelection(member.id)}
                            />
                            <Label
                              htmlFor={`member-${member.id}`}
                              className="text-sm font-medium leading-none cursor-pointer flex-1">
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {member.userId}
                                </p>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <FieldDescription>
                  Select members to record contributions. Use "Select All" to quickly select all members.
                </FieldDescription>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="amount">
                    <IndianRupee className="mr-2 h-4 w-4 inline" />
                    Amount <span className="text-destructive">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">₹</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Enter amount"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      required
                      className="w-full pl-8"
                    />
                  </div>
                  <FieldDescription>
                    {isMonthlyContribution 
                      ? 'Monthly contribution amount per member'
                      : 'Contribution amount per member'}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="date">
                    <Calendar className="mr-2 h-4 w-4 inline" />
                    Date <span className="text-destructive">*</span>
                    {isMonthlyContribution && selectedGroup && selectedMonth && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                        (Auto-selected based on month)
                      </span>
                    )}
                  </FieldLabel>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                    className="w-full"
                  />
                  <FieldDescription>
                    {isMonthlyContribution && selectedGroup && selectedMonth
                      ? `Date for ${getMonthName(selectedMonth)} contribution (auto-selected from group start date: ${format(new Date(selectedGroup.startDate), 'dd MMM yyyy')})`
                      : "Date of the contribution"}
                  </FieldDescription>
                </Field>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button 
                  type="submit" 
                  className="flex-1 sm:flex-none sm:min-w-[200px]" 
                  disabled={submitting || selectedMemberIds.length === 0}>
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Recording...
                    </>
                  ) : (
                    <>
                      <IndianRupee className="mr-2 h-4 w-4" />
                      Record Contribution
                      {selectedMemberIds.length > 0 && (
                        <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">
                          {selectedMemberIds.length}
                        </span>
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashbaord/savings')}
                  disabled={submitting}
                  className="sm:w-auto">
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

