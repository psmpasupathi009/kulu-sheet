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

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/auth/login");
    } else if (user && user.role === "ADMIN") {
      fetchUsers();
    }
  }, [user, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    toast.loading("Creating user...", { id: "create-user" });

    // Validation
    if (!formData.name.trim()) {
      toast.error("User name is required");
      setSubmitting(false);
      return;
    }

    if (!formData.email.trim()) {
      toast.error("User email is required");
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
      const response = await fetch("/api/admin/users", {
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
        throw new Error(data.error || "Failed to create user");
      }

      toast.success("User created successfully! They can login with email & OTP.", { id: "create-user" });
      setShowCreateForm(false);
      setFormData({ name: "", email: "", phone: "" });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user", { id: "create-user" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== "ADMIN") {
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
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-2 ml-12">
                Manage users created by you
              </p>
            </div>
            <Button variant="outline" onClick={logout} className="border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Create User Section */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Create New User
                </CardTitle>
                <CardDescription className="mt-1">
                  Create a new user account. They will receive OTP via email to login.
                </CardDescription>
              </div>
              {!showCreateForm && (
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              )}
            </div>
          </CardHeader>
          {showCreateForm && (
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">
                      User Name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Jane Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                    <FieldDescription>Full name of the user</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">
                      User Email <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@company.com"
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
                      placeholder="+918765432109"
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
                          Create User
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

        {/* Users List */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-indigo-600" />
              My Users
            </CardTitle>
            <CardDescription className="mt-1">
              View and manage users created by you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No users found. Create your first user above.</p>
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

