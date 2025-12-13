import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Mobile number is required"),
  userId: z.string().optional(),
});

/**
 * GET /api/admin/users
 * Get all users (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Admins can see users they created
    const users = await prisma.user.findMany({
      where: {
        createdBy: user.email, // Only users created by this admin
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        userId: true,
        role: true,
        status: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Check if userId is provided and unique
    if (data.userId) {
      const existingUserId = await prisma.user.findUnique({
        where: { userId: data.userId },
      });

      if (existingUserId) {
        return NextResponse.json(
          { error: "User ID already exists" },
          { status: 400 }
        );
      }
    }

    // Create user with status "pending"
    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        userId: data.userId,
        role: "USER",
        status: "pending", // Will be set to "active" after first login
        createdBy: user.email, // Admin email who created this user
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        userId: true,
        role: true,
        status: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

