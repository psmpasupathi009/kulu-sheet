import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const updateMemberSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email("Invalid email address").optional(),
  fatherName: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  accountNumber: z.string().optional(),
  phone: z.string().optional(),
  photo: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        savings: {
          include: {
            transactions: {
              orderBy: { date: "desc" },
            },
          },
        },
        loans: {
          include: {
            transactions: {
              orderBy: { date: "desc" },
            },
          },
        },
        transactions: {
          orderBy: { date: "desc" },
        },
      },
    });

    // Get associated user email
    let userEmail = null;
    if (member?.userId) {
      const user = await prisma.user.findUnique({
        where: { userId: member.userId },
        select: { email: true },
      });
      userEmail = user?.email || null;
    }

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(
      { member: { ...member, email: userEmail } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Failed to fetch member" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const data = updateMemberSchema.parse(body);

    // Check if accountNumber is being updated and already exists
    if (data.accountNumber !== undefined && data.accountNumber !== null && data.accountNumber.trim() !== "") {
      const existingMember = await prisma.member.findUnique({
        where: { accountNumber: data.accountNumber.trim() },
      });

      if (existingMember && existingMember.id !== id) {
        return NextResponse.json(
          { error: "Account number already exists" },
          { status: 400 }
        );
      }
    }

    // Get the member first to find the associated user
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prepare update data - handle accountNumber specially
    const updateData: any = {};
    if (data.userId !== undefined) updateData.userId = data.userId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.fatherName !== undefined) updateData.fatherName = data.fatherName;
    if (data.address1 !== undefined) updateData.address1 = data.address1;
    if (data.address2 !== undefined) updateData.address2 = data.address2;
    if (data.accountNumber !== undefined) {
      updateData.accountNumber = data.accountNumber && data.accountNumber.trim() !== ""
        ? data.accountNumber.trim()
        : null;
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.ifscCode !== undefined) updateData.ifscCode = data.ifscCode;
    if (data.upiId !== undefined) updateData.upiId = data.upiId;

    // Update member and sync user data in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the member
      const updatedMember = await tx.member.update({
        where: { id },
        data: updateData,
      });

      // Update the associated user if userId matches
      if (member.userId) {
        const userUpdateData: {
          name?: string;
          phone?: string;
          userId?: string;
          email?: string;
        } = {};
        if (data.name !== undefined) userUpdateData.name = data.name;
        if (data.phone !== undefined) userUpdateData.phone = data.phone;
        if (data.userId !== undefined) userUpdateData.userId = data.userId;
        if (data.email !== undefined) {
          // Check if email is already taken by another user
          const existingUser = await tx.user.findUnique({
            where: { email: data.email },
          });
          if (existingUser && existingUser.userId !== member.userId) {
            throw new Error("Email is already in use by another user");
          }
          userUpdateData.email = data.email;
        }

        // Only update user if there's data to update
        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.updateMany({
            where: { userId: member.userId },
            data: userUpdateData,
          });
        }
      }

      return updatedMember;
    });

    return NextResponse.json({ member: result }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    // Handle Prisma unique constraint errors
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        const prismaError = error as { meta?: { target?: string[] } };
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
    }

    // Handle Prisma unique constraint errors
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        const prismaError = error as { meta?: { target?: string[] } };
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
    }

    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get the member first to find the associated user
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Delete member and associated user in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the member (cascade will handle related records)
      await tx.member.delete({
        where: { id },
      });

      // Delete the associated user account if userId exists
      if (member.userId) {
        await tx.user.deleteMany({
          where: { userId: member.userId },
        });
      }
    });

    return NextResponse.json(
      { message: "Member and user account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
