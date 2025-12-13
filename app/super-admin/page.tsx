"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { toast } from "sonner";
import { UserPlus, Users, Shield, LogOut } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Admin {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/auth/login");
    } else if (user && user.role === "SUPER_ADMIN") {
      fetchAdmins();
      fetchUsers();
    }
  }, [user, router]);

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/super-admin/admins");
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/super-admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    toast.loading("Creating admin...", { id: "create-admin" });

    // Validation
    if (!formData.name.trim()) {
      toast.error("Admin name is required");
      setSubmitting(false);
      return;
    }

    if (!formData.email.trim()) {
      toast.error("Admin email is required");
      setSubmitting(false);
      return;
    }

    if (!formData.phone.trim()) {
      toast.error("Mobile number is required");
      setSubmitting(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error("Please enter a valid email address");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create admin");
      }

      toast.success("Admin created successfully! They can login with email & OTP.", { id: "create-admin" });
      setShowCreateForm(false);
      setFormData({ name: "", email: "", phone: "" });
      fetchAdmins();
    } catch (err: any) {
      toast.error(err.message || "Failed to create admin", { id: "create-admin" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== "SUPER_ADMIN") {
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                Super Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-2 ml-12">
                Manage admins and system settings
              </p>
            </div>
            <Button variant="outline" onClick={logout} className="border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Create Admin Section */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Create New Admin
                </CardTitle>
                <CardDescription className="mt-1">
                  Create a new admin account. They will receive OTP via email to login.
                </CardDescription>
              </div>
              {!showCreateForm && (
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Admin
                </Button>
              )}
            </div>
          </CardHeader>
          {showCreateForm && (
            <CardContent>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">
                      Admin Name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                    <FieldDescription>Full name of the admin</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">
                      Admin Email <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                    <FieldDescription>
                      Email address for login. Must be unique.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="phone">
                      Mobile Number <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+919876543210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      required
                    />
                    <FieldDescription>Contact mobile number</FieldDescription>
                  </Field>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={submitting}>
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create Admin
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        setFormData({ name: "", email: "", phone: "" });
                      }}
                      disabled={submitting}>
                      Cancel
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Admins List */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-indigo-600" />
              All Admins
            </CardTitle>
            <CardDescription className="mt-1">
              View and manage all admin accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading admins...</p>
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No admins found. Create your first admin above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell className="font-medium">{admin.name}</TableCell>
                        <TableCell>{admin.email}</TableCell>
                        <TableCell>{admin.phone}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              admin.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                            }`}>
                            {admin.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(admin.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Users List */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-indigo-600" />
              All Users
            </CardTitle>
            <CardDescription className="mt-1">
              View all users created by admins
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No users found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userItem) => (
                      <TableRow key={userItem.id}>
                        <TableCell className="font-medium">{userItem.name}</TableCell>
                        <TableCell>{userItem.email}</TableCell>
                        <TableCell>{userItem.phone}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              userItem.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                            }`}>
                            {userItem.status}
                          </span>
                        </TableCell>
                        <TableCell>{userItem.createdBy}</TableCell>
                        <TableCell>
                          {new Date(userItem.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

