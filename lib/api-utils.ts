import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { z } from "zod";

export interface AuthUser {
  id: string;
  userId: string;
  email: string;
  role: "ADMIN" | "USER";
}

/**
 * Authenticate request and return user
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return { user };
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Authenticate request and require admin role
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  const authResult = await authenticateRequest(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (authResult.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Parse and validate request body with Zod schema
 */
export function parseBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { data: T } | NextResponse {
  try {
    const data = schema.parse(body);
    return { data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * Handle API errors consistently
 */
export function handleApiError(
  error: unknown,
  context: string
): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid input", details: error.errors },
      { status: 400 }
    );
  }

  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] } };
    
    if (prismaError.code === "P2002") {
      const meta = prismaError.meta;
      if (meta?.target?.includes("accountNumber")) {
        return NextResponse.json(
          { error: "Account number already exists" },
          { status: 400 }
        );
      }
      if (meta?.target?.includes("userId")) {
        return NextResponse.json(
          { error: "User ID already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "A record with this information already exists" },
        { status: 400 }
      );
    }

    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }
  }

  // Log error in development
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}] Error:`, error);
  }

  return NextResponse.json(
    { error: `Failed to ${context}` },
    { status: 500 }
  );
}

/**
 * Resolve params from Next.js route handler
 */
export async function resolveParams<T extends Record<string, string>>(
  params: Promise<T>
): Promise<T> {
  return await params;
}

