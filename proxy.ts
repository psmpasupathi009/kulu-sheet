import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeToken } from "@/lib/auth-edge";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/auth/login",
    "/api/auth/login",
    "/api/auth/logout",
  ];
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(route);
  });

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    // Redirect to login if not authenticated
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Decode token (Edge-compatible, full verification happens in API routes)
  const user = decodeToken(token);

  if (!user) {
    // Clear invalid token
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/login", request.url));

    response.cookies.delete("auth-token");
    return response;
  }

  // Check admin routes - pages that require admin access
  const adminPageRoutes = [
    "/dashbaord/settings",
    "/dashbaord/members/new",
    "/dashbaord/cycles/new",
    "/dashbaord/savings/new",
    "/dashbaord/groups/new",
  ];
  const isAdminPageRoute = adminPageRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check admin API routes - APIs that require admin access
  const adminApiRoutes = [
    "/api/admin",
    "/api/members", // POST, PUT, DELETE require admin (creates user accounts automatically)
    "/api/cycles", // POST requires admin
    "/api/savings", // POST requires admin
    "/api/loans", // POST, PUT require admin
    "/api/loans/disburse", // POST requires admin
    "/api/funds", // POST requires admin
    "/api/statements", // POST requires admin
    "/api/transactions", // POST requires admin
    "/api/events", // POST requires admin
  ];
  const isAdminApiRoute = adminApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check Super Admin routes
  const superAdminRoutes = ["/super-admin", "/api/super-admin"];
  const isSuperAdminRoute = superAdminRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect authenticated users to their respective dashboards if they try to access login page
  if (pathname.startsWith("/auth/login")) {
    if (user.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/super-admin", request.url));
    } else if (user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    } else if (user.role === "USER") {
      return NextResponse.redirect(new URL("/user", request.url));
    }
  }

  // Block Super Admin routes for non-super-admin users
  if (isSuperAdminRoute && user.role !== "SUPER_ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden - Super Admin access required" },
        { status: 403 }
      );
    }
    // Redirect to appropriate dashboard based on role
    if (user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    } else if (user.role === "USER") {
      return NextResponse.redirect(new URL("/user", request.url));
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Block admin pages for non-admin users (Admin or Super Admin can access)
  if (isAdminPageRoute && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    // Redirect to appropriate dashboard based on role
    if (user.role === "USER") {
      return NextResponse.redirect(new URL("/user", request.url));
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Check access for Admin routes (includes routes for regular users)
  const adminRoutes = ["/admin", "/api/admin"];
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  if (isAdminRoute && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }
    // Redirect to appropriate dashboard based on role
    if (user.role === "USER") {
      return NextResponse.redirect(new URL("/user", request.url));
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Check access for User routes
  const userRoutes = ["/user", "/api/user"];
  const isUserRoute = userRoutes.some((route) => pathname.startsWith(route));
  if (isUserRoute && user.role !== "USER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden - User access required" },
        { status: 403 }
      );
    }
    // Redirect to appropriate dashboard based on role
    if (user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    } else if (user.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/super-admin", request.url));
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Block admin API routes for non-admin users (GET requests are allowed for viewing)
  // Note: Individual API routes will check admin access for POST/PUT/DELETE operations
  if (
    isAdminApiRoute &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    !pathname.match(/\/api\/[^/]+\/\[id\]/)
  ) {
    // Allow GET requests to view data, but block write operations
    // The actual API route handlers will enforce admin access for POST/PUT/DELETE
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
