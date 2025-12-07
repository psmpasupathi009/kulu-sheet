"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  PiggyBank,
  CreditCard,
  RotateCcw,
  TrendingUp,
  DollarSign,
  Activity,
  Calendar,
  Eye,
} from "lucide-react";
import { format } from "date-fns";

interface DashboardStats {
  totalMembers?: number;
  totalSavings: number;
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  totalLoanAmount: number;
  totalRemainingLoans: number;
  activeGroups?: number;
  totalCollections?: number;
}

interface SavingsData {
  id: string;
  member: {
    id: string;
    name: string;
    userId: string;
  };
  totalAmount: number;
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    total: number;
  }>;
}

interface LoanData {
  id: string;
  member: {
    id: string;
    name: string;
    userId: string;
  };
  principal: number;
  remaining: number;
  status: string;
  disbursedAt: string | null;
  group?: {
    groupNumber: number;
    name: string | null;
  } | null;
}

interface CollectionData {
  id: string;
  month: number;
  collectionDate: string;
  totalCollected: number;
  expectedAmount: number;
  isCompleted: boolean;
  group: {
    groupNumber: number;
    name: string | null;
    monthlyAmount: number;
    totalMembers: number;
  };
  payments: Array<{
    id: string;
    member: {
      name: string;
      userId: string;
    };
    amount: number;
    status: string;
  }>;
}

interface CycleData {
  id: string;
  groupNumber: number;
  name?: string | null;
  startDate: string;
  monthlyAmount: number;
  totalMembers: number;
  isActive: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"savings" | "loans" | "collections" | "groups">("savings");
  const [financialData, setFinancialData] = useState<{
    savings: SavingsData[];
    loans: LoanData[];
    collections: CollectionData[];
    groups: CycleData[];
  } | null>(null);

  useEffect(() => {
    fetchStats();
    fetchFinancialData();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialData = async () => {
    try {
      const response = await fetch("/api/dashboard/data");
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">kulu Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          Welcome back, {user?.name || user?.email}
          {isAdmin && (
            <span className="ml-2 px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
              Admin
            </span>
          )}
        </p>
      </div>

      {/* Statistics Cards */}
      {!loading && stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isAdmin ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Members
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalMembers || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Savings
                  </CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{stats.totalSavings.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Loans
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLoans}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.activeLoans} active, {stats.completedLoans} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Loan Amount
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{stats.totalLoanAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ₹{stats.totalRemainingLoans.toFixed(2)} remaining
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Groups
                  </CardTitle>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.activeGroups || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Collections
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalCollections || 0}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    My Savings
                  </CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{stats.totalSavings.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Loans</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLoans}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.activeLoans} active, {stats.completedLoans} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Received
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{stats.totalLoanAmount.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Remaining Balance
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    ₹{stats.totalRemainingLoans.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Financial Data Tables */}
      {!dataLoading && financialData && (
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-2 border-b">
                <button
                  onClick={() => setActiveTab("savings")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "savings"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <PiggyBank className="inline h-4 w-4 mr-2" />
                  Savings ({financialData?.savings?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("loans")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "loans"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <CreditCard className="inline h-4 w-4 mr-2" />
                  Loans ({financialData?.loans?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("collections")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "collections"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <Calendar className="inline h-4 w-4 mr-2" />
                  Collections ({financialData?.collections?.length || 0})
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab("groups")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "groups"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    <RotateCcw className="inline h-4 w-4 mr-2" />
                    Groups ({financialData.groups?.length || 0})
                  </button>
                )}
          </div>

          {/* Data Tables */}
          <div className="rounded-md border">
            {/* Savings Table */}
            {activeTab === "savings" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Member</TableHead>}
                    <TableHead>Total Savings</TableHead>
                    <TableHead>Latest Transaction</TableHead>
                    <TableHead>Last Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!financialData?.savings || financialData.savings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center text-muted-foreground">
                        No savings records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    financialData.savings.map((saving) => (
                      <TableRow key={saving.id}>
                        {isAdmin && (
                          <TableCell className="font-medium">
                            <div>
                              <div>{saving.member.name}</div>
                              <div className="text-xs text-muted-foreground">{saving.member.userId}</div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-semibold">
                          ₹{saving.totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {saving.transactions.length > 0
                            ? format(new Date(saving.transactions[0].date), "dd MMM yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {saving.transactions.length > 0
                            ? `₹${saving.transactions[0].amount.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashbaord/savings/${saving.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {/* Loans Table */}
            {activeTab === "loans" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Member</TableHead>}
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Disbursed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!financialData?.loans || financialData.loans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center text-muted-foreground">
                        No loans found
                      </TableCell>
                    </TableRow>
                  ) : (
                    financialData.loans.map((loan) => (
                      <TableRow key={loan.id}>
                        {isAdmin && (
                          <TableCell className="font-medium">
                            <div>
                              <div>{loan.member.name}</div>
                              <div className="text-xs text-muted-foreground">{loan.member.userId}</div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-semibold">
                          ₹{loan.principal.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <span className={loan.remaining > 0 ? "text-orange-600 font-semibold" : "text-green-600"}>
                            ₹{loan.remaining.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              loan.status === "COMPLETED"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : loan.status === "ACTIVE"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                : loan.status === "DEFAULTED"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                            }`}>
                            {loan.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {loan.group ? (
                            <span className="text-muted-foreground">
                              {loan.group.name || `Group ${loan.group.groupNumber}`}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {loan.disbursedAt
                            ? format(new Date(loan.disbursedAt), "dd MMM yyyy")
                            : "Not disbursed"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashbaord/loans/${loan.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {/* Collections Table */}
            {activeTab === "collections" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Collection Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Collected</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Members Paid</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!financialData?.collections || financialData.collections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center text-muted-foreground">
                        No collections found
                      </TableCell>
                    </TableRow>
                  ) : (
                    financialData.collections.map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell className="font-medium">
                          {collection.group.name || `Group ${collection.group.groupNumber}`}
                        </TableCell>
                        <TableCell>Month {collection.month}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(collection.collectionDate), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>₹{collection.expectedAmount.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">
                          ₹{collection.totalCollected.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              collection.isCompleted
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                            }`}>
                            {collection.isCompleted ? "Completed" : "Pending"}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-muted-foreground">
                            {collection.payments.filter((p) => p.status === "PAID").length} / {collection.group.totalMembers}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {/* Cycles Table (Admin Only) */}
            {activeTab === "groups" && isAdmin && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Monthly Amount</TableHead>
                    <TableHead>Pooled Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!financialData.groups || financialData.groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No active groups found
                      </TableCell>
                    </TableRow>
                  ) : (
                    financialData.groups.map((group) => {
                      const pooledAmount = group.monthlyAmount * group.totalMembers;
                      return (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">
                            {group.name || `Group ${group.groupNumber}`}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(group.startDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>{group.totalMembers}</TableCell>
                          <TableCell>₹{group.monthlyAmount.toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">
                            ₹{pooledAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                group.isActive
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                              }`}>
                              {group.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashbaord/cycles`}>
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
