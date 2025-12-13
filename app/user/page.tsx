"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Mail, Shield } from "lucide-react";

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "USER") {
      router.push("/auth/login");
    }
  }, [user, router]);

  if (!user || user.role !== "USER") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                  <User className="h-6 w-6 text-white" />
                </div>
                User Dashboard
              </h1>
              <p className="text-muted-foreground mt-2 ml-12">
                Welcome, {user.name || user.email}
              </p>
            </div>
            <Button variant="outline" onClick={logout} className="border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* User Profile */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
            <CardTitle className="text-xl">My Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold text-lg">{user.name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Mail className="w-12 h-12 text-blue-600 p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold text-lg">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Shield className="w-12 h-12 text-indigo-600 p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-semibold text-lg capitalize">{user.role.toLowerCase().replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

