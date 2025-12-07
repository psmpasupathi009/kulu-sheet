"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  Users,
  DollarSign,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { CardDescription } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface LoanSequence {
  id: string;
  month: number;
  loanAmount: number;
  status: string;
  disbursedAt?: string | null;
  member: {
    name: string;
    userId: string;
  };
  loan?: {
    id: string;
    status: string;
    remaining: number;
  } | null;
}

interface CollectionPayment {
  id: string;
  memberId: string;
  amount: number;
  paymentDate: string;
  status: string;
  member: {
    name: string;
    userId: string;
  };
}

interface MonthlyCollection {
  id: string;
  month: number;
  collectionDate: string;
  totalCollected: number;
  expectedAmount: number;
  activeMemberCount: number;
  isCompleted: boolean;
  payments: CollectionPayment[];
}

interface LoanCycle {
  id: string;
  cycleNumber: number;
  startDate: string;
  endDate?: string | null;
  totalMembers: number;
  monthlyAmount: number;
  isActive: boolean;
  sequences: LoanSequence[];
  collections?: MonthlyCollection[];
}

export default function CyclesPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<LoanCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [disbursingSequence, setDisbursingSequence] = useState<string | null>(
    null
  );
  const [showDisburseForm, setShowDisburseForm] = useState(false);
  const [members, setMembers] = useState<
    Array<{ id: string; name: string; userId: string }>
  >([]);
  const [disburseForm, setDisburseForm] = useState({
    guarantor1Id: "",
    guarantor2Id: "",
    disbursementMethod: "" as "CASH" | "UPI" | "BANK_TRANSFER" | "",
  });
  const [editingCycle, setEditingCycle] = useState<string | null>(null);
  const [deletingCycle, setDeletingCycle] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    startDate: "",
    endDate: "",
    isActive: true,
    monthlyAmount: 0,
  });
  const [showAddMember, setShowAddMember] = useState<string | null>(null);
  const [addMemberForm, setAddMemberForm] = useState({
    memberId: "",
    monthlyAmount: "",
    joiningDate: new Date().toISOString().split("T")[0],
  });
  const [allMembers, setAllMembers] = useState<
    Array<{ id: string; name: string; userId: string }>
  >([]);
  const [addingMember, setAddingMember] = useState(false);
  const [showCollections, setShowCollections] = useState<string | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState<string | null>(null);
  const [createCollectionForm, setCreateCollectionForm] = useState({
    month: "",
    collectionDate: new Date().toISOString().split("T")[0],
  });
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState<{ collectionId: string; cycleId: string } | null>(null);
  const [recordPaymentForm, setRecordPaymentForm] = useState({
    memberId: "",
    amount: "",
    paymentMethod: "",
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    fetchCycles();
    fetchMembers();
    fetchAllMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch("/api/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const response = await fetch("/api/members");
      if (response.ok) {
        const data = await response.json();
        setAllMembers(data.members);
      }
    } catch (error) {
      console.error("Error fetching all members:", error);
    }
  };

  const handleAddMemberToCycle = async (cycleId: string) => {
    if (!addMemberForm.memberId || !addMemberForm.monthlyAmount) {
      toast.error("Please fill all required fields");
      return;
    }

    setAddingMember(true);

    try {
      const response = await fetch(`/api/cycles/${cycleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: addMemberForm.memberId,
          monthlyAmount: parseFloat(addMemberForm.monthlyAmount),
          joiningDate: new Date(addMemberForm.joiningDate).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      toast.success(
        `Member added successfully! Catch-up payment: ₹${data.catchUpAmount.toFixed(2)} (${data.loansAlreadyGiven || 0} loans already given × ₹${addMemberForm.monthlyAmount})`
      );
      setShowAddMember(null);
      setAddMemberForm({
        memberId: "",
        monthlyAmount: "",
        joiningDate: new Date().toISOString().split("T")[0],
      });
      fetchCycles();
    } catch (err: any) {
      toast.error(err.message || "Failed to add member to cycle");
    } finally {
      setAddingMember(false);
    }
  };

  const fetchCycles = async () => {
    try {
      const response = await fetch("/api/cycles");
      if (response.ok) {
        const data = await response.json();
        setCycles(data.cycles);
      } else {
        toast.error("Failed to fetch cycles");
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
      toast.error("Failed to fetch cycles");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cycle: LoanCycle) => {
    setEditingCycle(cycle.id);
    setEditForm({
      startDate: format(new Date(cycle.startDate), "yyyy-MM-dd"),
      endDate: cycle.endDate
        ? format(new Date(cycle.endDate), "yyyy-MM-dd")
        : "",
      isActive: cycle.isActive,
      monthlyAmount: cycle.monthlyAmount,
    });
  };

  const handleUpdate = async () => {
    if (!editingCycle) return;

    try {
      const response = await fetch(`/api/cycles/${editingCycle}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editForm.startDate,
          endDate: editForm.endDate || null,
          isActive: editForm.isActive,
          monthlyAmount: editForm.monthlyAmount,
        }),
      });

      if (response.ok) {
        toast.success("Cycle updated successfully!");
        setEditingCycle(null);
        await fetchCycles();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update cycle");
      }
    } catch (error) {
      console.error("Error updating cycle:", error);
      toast.error("Failed to update cycle");
    }
  };

  const handleDelete = async () => {
    if (!deletingCycle) return;

    try {
      const response = await fetch(`/api/cycles/${deletingCycle}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Cycle deleted successfully!");
        setDeletingCycle(null);
        await fetchCycles();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete cycle");
        setDeletingCycle(null);
      }
    } catch (error) {
      console.error("Error deleting cycle:", error);
      toast.error("Failed to delete cycle");
      setDeletingCycle(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Loan Cycles</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage monthly investment cycles where members invest monthly and receive loans in rotation
          </p>
        </div>
        {user?.role === "ADMIN" && (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashbaord/cycles/new">
              <Plus className="mr-2 h-4 w-4" />
              New Cycle
            </Link>
          </Button>
        )}
      </div>


      {cycles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No cycles found. Create a new cycle to start the monthly investment rotation.
          </CardContent>
        </Card>
      ) : (
        cycles.map((cycle) => (
          <Card key={cycle.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cycle #{cycle.cycleNumber}</CardTitle>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    cycle.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}>
                  {cycle.isActive ? "Active" : "Completed"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {format(new Date(cycle.startDate), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="font-medium">{cycle.totalMembers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Monthly Amount
                    </p>
                    <p className="font-medium">₹{cycle.monthlyAmount}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Cycle Information:</p>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Pooled Loan Amount</p>
                    <p className="font-medium">
                      ₹{(cycle.monthlyAmount * cycle.totalMembers).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Month</p>
                    <p className="font-medium">
                      {cycle.sequences.length > 0 
                        ? `Month ${Math.max(...cycle.sequences.map(s => s.month))}`
                        : "Not started"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Loans Disbursed</p>
                    <p className="font-medium">
                      {cycle.sequences.filter(s => s.status === "DISBURSED").length} / {cycle.sequences.length}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold">
                    Loan Rotation Schedule
                  </h3>
                  {user?.role === "ADMIN" && cycle.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddMember(cycle.id);
                        setAddMemberForm({
                          memberId: "",
                          monthlyAmount: cycle.monthlyAmount.toString(),
                          joiningDate: new Date().toISOString().split("T")[0],
                        });
                      }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Loan Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycle.sequences.map((sequence) => (
                        <TableRow key={sequence.id}>
                          <TableCell className="font-medium">
                            Month {sequence.month}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {sequence.member.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sequence.member.userId}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            ₹{sequence.loanAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                sequence.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : sequence.status === "DISBURSED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}>
                              {sequence.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {sequence.loan
                              ? `₹${sequence.loan.remaining.toFixed(2)}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {sequence.status === "PENDING" &&
                                user?.role === "ADMIN" && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      setDisbursingSequence(sequence.id);
                                      setShowDisburseForm(true);
                                      setDisburseForm({
                                        guarantor1Id: "",
                                        guarantor2Id: "",
                                        disbursementMethod: "",
                                      });
                                    }}>
                                    Disburse
                                  </Button>
                                )}
                              {sequence.loan && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    href={`/dashbaord/loans/${sequence.loan.id}`}>
                                    View Loan
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Collections Section */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold">
                    Monthly Collections
                  </h3>
                  {user?.role === "ADMIN" && cycle.isActive && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCollections(showCollections === cycle.id ? null : cycle.id);
                        }}>
                        {showCollections === cycle.id ? "Hide" : "View"} Collections
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCreateCollection(cycle.id);
                          const nextMonth = cycle.collections && cycle.collections.length > 0
                            ? Math.max(...cycle.collections.map(c => c.month)) + 1
                            : 1;
                          setCreateCollectionForm({
                            month: nextMonth.toString(),
                            collectionDate: new Date().toISOString().split("T")[0],
                          });
                        }}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Collection
                      </Button>
                    </div>
                  )}
                </div>

                {showCollections === cycle.id && cycle.collections && (
                  <div className="space-y-3">
                    {cycle.collections.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No collections yet. Create a new collection to start collecting monthly payments.
                      </p>
                    ) : (
                      cycle.collections.map((collection) => (
                        <Card key={collection.id} className="border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">
                                  Month {collection.month} Collection
                                </CardTitle>
                                <CardDescription>
                                  {format(new Date(collection.collectionDate), "dd MMM yyyy")} • 
                                  {collection.isCompleted ? (
                                    <span className="text-green-600 ml-1">Completed</span>
                                  ) : (
                                    <span className="text-yellow-600 ml-1">In Progress</span>
                                  )}
                                </CardDescription>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Collected</p>
                                <p className="font-semibold">
                                  ₹{collection.totalCollected.toFixed(2)} / ₹{collection.expectedAmount.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {collection.payments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No payments recorded yet.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {collection.payments.map((payment) => (
                                    <div
                                      key={payment.id}
                                      className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                      <div>
                                        <p className="font-medium">{payment.member.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {payment.member.userId}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">₹{payment.amount.toFixed(2)}</p>
                                        <p
                                          className={`text-xs ${
                                            payment.status === "PAID"
                                              ? "text-green-600"
                                              : "text-yellow-600"
                                          }`}>
                                          {payment.status}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {user?.role === "ADMIN" && !collection.isCompleted && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-2"
                                  onClick={() => {
                                    setShowRecordPayment({
                                      collectionId: collection.id,
                                      cycleId: cycle.id,
                                    });
                                    setRecordPaymentForm({
                                      memberId: "",
                                      amount: cycle.monthlyAmount.toString(),
                                      paymentMethod: "",
                                    });
                                  }}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Record Payment
                                </Button>
                              )}
                              {collection.isCompleted && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-800 dark:text-green-200">
                                  ✓ Collection complete! Loan has been automatically disbursed.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Create Collection Dialog */}
      {showCreateCollection && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create Monthly Collection</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateCollection(null);
                    setCreateCollectionForm({
                      month: "",
                      collectionDate: new Date().toISOString().split("T")[0],
                    });
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Month Number <span className="text-destructive">*</span></FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    value={createCollectionForm.month}
                    onChange={(e) =>
                      setCreateCollectionForm({
                        ...createCollectionForm,
                        month: e.target.value,
                      })
                    }
                    required
                  />
                  <FieldDescription>
                    Month number in the cycle (1, 2, 3, etc.)
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Collection Date <span className="text-destructive">*</span></FieldLabel>
                  <Input
                    type="date"
                    value={createCollectionForm.collectionDate}
                    onChange={(e) =>
                      setCreateCollectionForm({
                        ...createCollectionForm,
                        collectionDate: e.target.value,
                      })
                    }
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      if (!createCollectionForm.month || !createCollectionForm.collectionDate) {
                        toast.error("Please fill all fields");
                        return;
                      }
                      setCreatingCollection(true);
                      try {
                        const cycle = cycles.find((c) => c.id === showCreateCollection);
                        if (!cycle) return;

                        const response = await fetch("/api/collections", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            cycleId: showCreateCollection,
                            month: parseInt(createCollectionForm.month),
                            collectionDate: new Date(createCollectionForm.collectionDate).toISOString(),
                          }),
                        });

                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || "Failed to create collection");
                        }

                        toast.success("Collection created successfully!");
                        setShowCreateCollection(null);
                        setCreateCollectionForm({
                          month: "",
                          collectionDate: new Date().toISOString().split("T")[0],
                        });
                        fetchCycles();
                      } catch (err: any) {
                        toast.error(err.message || "Failed to create collection");
                      } finally {
                        setCreatingCollection(false);
                      }
                    }}
                    disabled={creatingCollection}>
                    {creatingCollection ? "Creating..." : "Create Collection"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateCollection(null);
                      setCreateCollectionForm({
                        month: "",
                        collectionDate: new Date().toISOString().split("T")[0],
                      });
                    }}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Record Payment Dialog */}
      {showRecordPayment && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Record Payment</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowRecordPayment(null);
                    setRecordPaymentForm({
                      memberId: "",
                      amount: "",
                      paymentMethod: "",
                    });
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Member <span className="text-destructive">*</span></FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={recordPaymentForm.memberId}
                    onChange={(e) =>
                      setRecordPaymentForm({
                        ...recordPaymentForm,
                        memberId: e.target.value,
                      })
                    }
                    required>
                    <option value="">Select a member</option>
                    {allMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.userId})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>Amount (₹) <span className="text-destructive">*</span></FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={recordPaymentForm.amount}
                    onChange={(e) =>
                      setRecordPaymentForm({
                        ...recordPaymentForm,
                        amount: e.target.value,
                      })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Payment Method</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={recordPaymentForm.paymentMethod}
                    onChange={(e) =>
                      setRecordPaymentForm({
                        ...recordPaymentForm,
                        paymentMethod: e.target.value,
                      })
                    }>
                    <option value="">Select method</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </Field>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      if (!recordPaymentForm.memberId || !recordPaymentForm.amount) {
                        toast.error("Please fill all required fields");
                        return;
                      }
                      setRecordingPayment(true);
                      try {
                        const response = await fetch("/api/collections", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            collectionId: showRecordPayment.collectionId,
                            memberId: recordPaymentForm.memberId,
                            amount: parseFloat(recordPaymentForm.amount),
                            paymentMethod: recordPaymentForm.paymentMethod || undefined,
                          }),
                        });

                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || "Failed to record payment");
                        }

                        toast.success("Payment recorded successfully! Loan will be automatically disbursed when collection is complete.");
                        setShowRecordPayment(null);
                        setRecordPaymentForm({
                          memberId: "",
                          amount: "",
                          paymentMethod: "",
                        });
                        fetchCycles();
                      } catch (err: any) {
                        toast.error(err.message || "Failed to record payment");
                      } finally {
                        setRecordingPayment(false);
                      }
                    }}
                    disabled={recordingPayment}>
                    {recordingPayment ? "Recording..." : "Record Payment"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRecordPayment(null);
                      setRecordPaymentForm({
                        memberId: "",
                        amount: "",
                        paymentMethod: "",
                      });
                    }}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {showDisburseForm && disbursingSequence && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Disburse Loan</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDisburseForm(false);
                    setDisbursingSequence(null);
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Select guarantors (optional) for this loan. Guarantors will be
                responsible if the borrower defaults.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Guarantor 1 (Optional)</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disburseForm.guarantor1Id}
                    onChange={(e) =>
                      setDisburseForm({
                        ...disburseForm,
                        guarantor1Id: e.target.value,
                      })
                    }>
                    <option value="">None</option>
                    {members
                      .filter((m) => m.id !== disburseForm.guarantor2Id)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId})
                        </option>
                      ))}
                  </select>
                  <FieldDescription>
                    First co-signer for this loan
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Guarantor 2 (Optional)</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disburseForm.guarantor2Id}
                    onChange={(e) =>
                      setDisburseForm({
                        ...disburseForm,
                        guarantor2Id: e.target.value,
                      })
                    }>
                    <option value="">None</option>
                    {members
                      .filter((m) => m.id !== disburseForm.guarantor1Id)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId})
                        </option>
                      ))}
                  </select>
                  <FieldDescription>
                    Second co-signer for this loan
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Disbursement Method (Optional)</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disburseForm.disbursementMethod}
                    onChange={(e) =>
                      setDisburseForm({
                        ...disburseForm,
                        disbursementMethod: e.target.value as "CASH" | "UPI" | "BANK_TRANSFER" | "",
                      })
                    }>
                    <option value="">Select payment method</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                  <FieldDescription>
                    How the loan will be disbursed to the member
                  </FieldDescription>
                </Field>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/loans/disburse", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sequenceId: disbursingSequence,
                            guarantor1Id:
                              disburseForm.guarantor1Id || undefined,
                            guarantor2Id:
                              disburseForm.guarantor2Id || undefined,
                            disbursementMethod:
                              disburseForm.disbursementMethod || undefined,
                          }),
                        });
                        if (response.ok) {
                          toast.success("Loan disbursed successfully!");
                          setShowDisburseForm(false);
                          setDisbursingSequence(null);
                          fetchCycles();
                        } else {
                          const error = await response.json();
                          toast.error(error.error || "Failed to disburse loan");
                        }
                      } catch (error) {
                        toast.error("Failed to disburse loan");
                      }
                    }}>
                    Disburse Loan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDisburseForm(false);
                      setDisbursingSequence(null);
                    }}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Member to Cycle Dialog */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Member to Cycle</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddMember(null);
                    setAddMemberForm({
                      memberId: "",
                      monthlyAmount: "",
                      joiningDate: new Date().toISOString().split("T")[0],
                    });
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Add a new member to this cycle. If joining mid-cycle, catch-up payment will be calculated automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Member <span className="text-destructive">*</span></FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={addMemberForm.memberId}
                    onChange={(e) =>
                      setAddMemberForm({
                        ...addMemberForm,
                        memberId: e.target.value,
                      })
                    }
                    required>
                    <option value="">Select a member</option>
                    {allMembers
                      .filter(
                        (m) =>
                          !cycles
                            .find((c) => c.id === showAddMember)
                            ?.sequences.some((s) => s.member.userId === m.userId)
                      )
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId})
                        </option>
                      ))}
                  </select>
                  <FieldDescription>
                    Select member to add to this cycle
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Monthly Amount (₹) <span className="text-destructive">*</span></FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={addMemberForm.monthlyAmount}
                    onChange={(e) =>
                      setAddMemberForm({
                        ...addMemberForm,
                        monthlyAmount: e.target.value,
                      })
                    }
                    required
                    placeholder="2000"
                  />
                  <FieldDescription>
                    Monthly contribution amount for this member
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Joining Date <span className="text-destructive">*</span></FieldLabel>
                  <Input
                    type="date"
                    value={addMemberForm.joiningDate}
                    onChange={(e) =>
                      setAddMemberForm({
                        ...addMemberForm,
                        joiningDate: e.target.value,
                      })
                    }
                    required
                  />
                  <FieldDescription>
                    Date when member is joining. Catch-up payment will be calculated based on cycle start date.
                  </FieldDescription>
                </Field>
                {addMemberForm.joiningDate && showAddMember && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Catch-up Payment:</p>
                    {(() => {
                      const cycle = cycles.find((c) => c.id === showAddMember);
                      if (!cycle) return null;
                      const monthlyAmount = parseFloat(addMemberForm.monthlyAmount) || 0;
                      // Count how many loans have already been disbursed
                      const loansAlreadyGiven = cycle.sequences.filter(
                        (seq) => seq.status === "DISBURSED" || seq.loan !== null
                      ).length;
                      // New member pays: monthlyAmount * number of loans already given
                      const catchUpAmount = monthlyAmount * loansAlreadyGiven;
                      return (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Loans already given: {loansAlreadyGiven}</p>
                          <p className="font-semibold text-foreground">
                            Catch-up amount: ₹{catchUpAmount.toFixed(2)}
                          </p>
                          <p className="text-xs">
                            New member needs to pay ₹{catchUpAmount.toFixed(2)} ({loansAlreadyGiven} loans × ₹{monthlyAmount.toFixed(2)}) to join the cycle.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAddMemberToCycle(showAddMember)}
                    disabled={addingMember || !addMemberForm.memberId || !addMemberForm.monthlyAmount}>
                    {addingMember ? "Adding..." : "Add Member"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddMember(null);
                      setAddMemberForm({
                        memberId: "",
                        monthlyAmount: "",
                        joiningDate: new Date().toISOString().split("T")[0],
                      });
                    }}
                    disabled={addingMember}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Cycle Dialog */}
      {editingCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto m-4">
            <CardHeader>
              <CardTitle>Edit Cycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                <Input
                  id="startDate"
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, startDate: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End Date (Optional)</FieldLabel>
                <Input
                  id="endDate"
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endDate: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="monthlyAmount">Monthly Amount</FieldLabel>
                <Input
                  id="monthlyAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.monthlyAmount}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      monthlyAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </Field>
              <div className="flex gap-2">
                <Button onClick={handleUpdate} className="flex-1">
                  Update
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingCycle(null)}
                  className="flex-1">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deletingCycle !== null}
        onOpenChange={(open) => !open && setDeletingCycle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cycle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cycle? This action cannot be
              undone. The cycle can only be deleted if it has no active or
              pending loans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
