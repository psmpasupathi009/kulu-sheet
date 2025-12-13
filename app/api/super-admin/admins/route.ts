import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Mobile number is required"),
});

/**
 * GET /api/super-admin/admins
 * Get all admins (Super Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Super Admin access required" },
        { status: 403 }
      );
    }

    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdBy: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ admins }, { status: 200 });
  } catch (error) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/admins
 * Create a new admin (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Super Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createAdminSchema.parse(body);

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: data.email },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Admin with this email already exists" },
        { status: 400 }
      );
    }

    // Create admin with status "pending"
    const newAdmin = await prisma.admin.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: "admin",
        status: "pending", // Will be set to "active" after first login
        createdBy: user.email, // Super Admin email
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdBy: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ admin: newAdmin }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: "Failed to create admin" },
      { status: 500 }
    );
  }
}

