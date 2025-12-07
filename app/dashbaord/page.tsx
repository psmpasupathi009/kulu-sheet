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
  Users,
  PiggyBank,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Settings,
  Plus,
  RotateCcw,
  Building2,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";

interface DashboardStats {
  totalMembers?: number;
  totalSavings: number;
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  totalLoanAmount: number;
  totalRemainingLoans: number;
  activeCycles?: number;
  totalCollections?: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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

  const isAdmin = user?.role === "ADMIN";

  const adminMenuItems = [
    {
      title: "Member Details",
      icon: Users,
      href: "/dashbaord/members",
      number: "1",
    },
    {
      title: "Savings",
      icon: PiggyBank,
      href: "/dashbaord/savings",
      number: "2",
    },
    {
      title: "Loan Details",
      icon: CreditCard,
      href: "/dashbaord/loans",
      number: "3",
    },
    {
      title: "Loan Cycles",
      icon: RotateCcw,
      href: "/dashbaord/cycles",
      number: "4",
    },
    {
      title: "ROSCA Groups",
      icon: Building2,
      href: "/dashbaord/groups",
      number: "5",
    },
    {
      title: "Miscellaneous",
      icon: FileText,
      href: "/dashbaord/miscellaneous",
      number: "6",
    },
    {
      title: "Monthly Statements",
      icon: FileSpreadsheet,
      href: "/dashbaord/statements",
      number: "7",
    },
    {
      title: "Settings",
      icon: Settings,
      href: "/dashbaord/settings",
      number: "8",
    },
  ];

  const userMenuItems = [
    {
      title: "My Profile",
      icon: Users,
      href: "/dashbaord/profile",
      number: "1",
    },
    {
      title: "My Savings",
      icon: PiggyBank,
      href: "/dashbaord/savings",
      number: "2",
    },
    {
      title: "My Loans",
      icon: CreditCard,
      href: "/dashbaord/loans",
      number: "3",
    },
    {
      title: "Monthly Statements",
      icon: FileSpreadsheet,
      href: "/dashbaord/statements",
      number: "4",
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

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
                    Active Cycles
                  </CardTitle>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.activeCycles || 0}
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

      {/* Menu Items */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {isAdmin ? "Quick Access" : "My Services"}
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {item.number}) {item.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{item.title}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {isAdmin && (
            <Link href="/dashbaord/cycles/new">
              <Card className="hover:bg-accent transition-colors cursor-pointer border-dashed">
                <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium text-center text-muted-foreground">
                    New Cycle
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
