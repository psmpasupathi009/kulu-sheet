"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PiggyBank,
  CreditCard,
  Building2,
  DollarSign,
  TrendingUp,
  Calendar,
  User,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
// Using native select for now

interface MemberProfile {
  member: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    photo: string | null;
  };
  summary: {
    totalSavings: number;
    totalContributions: number;
    totalLoansReceived: number;
    totalLoansRemaining: number;
    totalInterestReceived: number;
    activeLoansCount: number;
    completedLoansCount: number;
  };
  savings: Array<{
    id: string;
    totalAmount: number;
    transactions: Array<{
      id: string;
      date: string;
      amount: number;
      total: number;
    }>;
  }>;
  loans: Array<{
    id: string;
    principal: number;
    remaining: number;
    status: string;
    interestRate: number;
    weeks: number;
    currentWeek: number;
    totalInterest: number;
    disbursedAt: string | null;
    completedAt: string | null;
    cycle: {
      cycleNumber: number;
    } | null;
    interestDistributions: Array<{
      id: string;
      amount: number;
      distributionDate: string;
    }>;
  }>;
    joiningDate: string;
    interestDistributions: Array<{
      id: string;
      amount: number;
      distributionDate: string;
      loan: {
        id: string;
        principal: number;
        cycle: {
          cycleNumber: number;
        } | null;
      };
    }>;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/members/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error && !profile) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!profile) {
    return <div className="p-6">Profile not found</div>;
  }

  const filteredLoans = profile.loans;
  const filteredInterest = profile.interestDistributions;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            View your savings, loans, and interest details
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{profile.summary.totalSavings.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Contributions
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{profile.summary.totalContributions.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Interest Received
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{profile.summary.totalInterestReceived.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profile.summary.activeLoansCount}
            </div>
            <p className="text-xs text-muted-foreground">
              ₹{profile.summary.totalLoansRemaining.toFixed(2)} remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Member Information */}
      <Card>
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{profile.member.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-medium font-mono">{profile.member.userId}</p>
            </div>
            {profile.member.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile.member.email}</p>
              </div>
            )}
            {profile.member.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{profile.member.phone}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loans */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>My Loans</CardTitle>
              <CardDescription>
                View your loans
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLoans.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No loans found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">
                        ₹{loan.principal.toFixed(2)}
                      </TableCell>
                      <TableCell>Cycle {loan.cycle?.cycleNumber || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            loan.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : loan.status === "ACTIVE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                          {loan.status}
                        </span>
                      </TableCell>
                      <TableCell>₹{loan.remaining.toFixed(2)}</TableCell>
                      <TableCell>
                        {loan.currentWeek}/{loan.weeks} weeks
                      </TableCell>
                      <TableCell>₹{loan.totalInterest.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full sm:w-auto">
                          <a href={`/dashbaord/loans/${loan.id}`}>View</a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interest Distributions */}
      {filteredInterest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Interest Received</CardTitle>
            <CardDescription>
              Interest distributions from completed loans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Interest Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInterest.map((dist) => (
                    <TableRow key={dist.id}>
                      <TableCell>
                        {format(new Date(dist.distributionDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>₹{dist.loan.principal.toFixed(2)}</TableCell>
                      <TableCell>
                        {dist.loan.cycle ? `Cycle ${dist.loan.cycle.cycleNumber}` : "-"}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ₹{dist.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Interest Received:</span>
                <span className="text-lg font-bold text-green-600">
                  ₹
                  {filteredInterest
                    .reduce((sum, d) => sum + d.amount, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Savings */}
      {profile.savings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profile.savings.map((saving) => (
                <div key={saving.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Total Savings</span>
                    <span className="text-lg font-bold">
                      ₹{saving.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  {saving.transactions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">
                        Recent Transactions
                      </p>
                      <div className="space-y-1">
                        {saving.transactions.slice(0, 5).map((tx) => (
                          <div
                            key={tx.id}
                            className="flex justify-between text-sm">
                            <span>
                              {format(new Date(tx.date), "dd/MM/yyyy")}
                            </span>
                            <span className="font-medium">
                              +₹{tx.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
