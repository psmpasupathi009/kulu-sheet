"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Redirect based on user role
        if (user.role === "SUPER_ADMIN") {
          router.push("/super-admin");
        } else if (user.role === "ADMIN") {
          router.push("/admin");
        } else if (user.role === "USER") {
          router.push("/user");
        } else {
          router.push("/auth/login");
        }
      } else {
        router.push("/auth/login");
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Show loading while checking auth status
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
