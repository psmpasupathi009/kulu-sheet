import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { sendOTPEmail, generateToken, verifyToken } from "@/lib/auth";
import { generateOTP } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL as string;

// Temporary in-memory store for Super Admin OTP (use Redis in production)
const superAdminOTPStore = new Map<string, { otp: string; expires: Date }>();

/**
 * Check if email matches Super Admin email from ENV
 */
function isSuperAdminEmail(email: string): boolean {
  if (!SUPER_ADMIN_EMAIL) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase().trim();
}

/**
 * GET /api/auth/login
 * Returns current login status
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ isLoggedIn: false });
    }

    const user = await verifyToken(token);
    if (user) {
      return NextResponse.json({
        isLoggedIn: true,
        user: {
          email: user.email,
          role: user.role,
          name: user.name,
        },
      });
    }

    return NextResponse.json({ isLoggedIn: false });
  } catch (error) {
    return NextResponse.json({ isLoggedIn: false });
  }
}

/**
 * POST /api/auth/login
 * Handles OTP request and validation with new hierarchy:
 * 1. Super Admin (ENV only)
 * 2. Admin (Database)
 * 3. User (Database)
 */
export async function POST(req: NextRequest) {
  try {
    const { type, email, code } = await req.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isSuperAdmin = isSuperAdminEmail(normalizedEmail);

    if (type === "request") {
      return await handleOTPRequest(normalizedEmail, isSuperAdmin);
    }

    if (type === "validate") {
      return await handleOTPValidation(normalizedEmail, code, isSuperAdmin);
    }

    return NextResponse.json(
      { error: "Invalid request type. Use 'request' or 'validate'." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * Handle OTP request - send OTP to email
 */
async function handleOTPRequest(email: string, isSuperAdmin: boolean) {
  // Generate OTP
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    if (isSuperAdmin) {
      // Super Admin: No database entry, store OTP in memory (use Redis in production)
      superAdminOTPStore.set(email, {
        otp,
        expires: otpExpires,
      });
      
      // Clean up expired OTPs
      for (const [key, value] of superAdminOTPStore.entries()) {
        if (new Date() > value.expires) {
          superAdminOTPStore.delete(key);
        }
      }
      
      await sendOTPEmail(email, otp);
      
      return NextResponse.json({
        message: "OTP sent to Super Admin email.",
      });
    }

    // Check if Admin exists and is active
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (admin && admin.isActive && (admin.status === "active" || admin.status === "pending")) {
      // Update Admin OTP
      await prisma.admin.update({
        where: { email },
        data: {
          otp,
          otpExpires,
        },
      });

      await sendOTPEmail(email, otp);
      return NextResponse.json({
        message: "OTP sent to Admin email.",
      });
    }

    // Check if User exists and has valid status
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user && (user.status === "active" || user.status === "pending")) {
      // Update User OTP
      await prisma.user.update({
        where: { email },
        data: {
          otp,
          otpExpires,
        },
      });

      await sendOTPEmail(email, otp);
      return NextResponse.json({
        message: "OTP sent to User email.",
      });
    }

    // Email not found in any collection
    return NextResponse.json(
      {
        error:
          "Email not found. Please contact your administrator to create an account.",
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[LOGIN] Error sending OTP:", error);
    if (error.message?.includes("Email credentials")) {
      return NextResponse.json(
        { error: "Email service not configured. Please contact administrator." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Handle OTP validation - verify code and create session
 */
async function handleOTPValidation(
  email: string,
  code: string,
  isSuperAdmin: boolean
) {
  // Validate code
  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Passcode is required." },
      { status: 400 }
    );
  }

  try {
    let authUser: {
      id: string;
      email: string;
      name?: string;
      role: "SUPER_ADMIN" | "ADMIN" | "USER";
    } | null = null;

    if (isSuperAdmin) {
      // Super Admin: Verify OTP from in-memory store (use Redis in production)
      const storedOTP = superAdminOTPStore.get(email);
      
      if (!storedOTP) {
        return NextResponse.json(
          { error: "No OTP found. Please request a new one." },
          { status: 400 }
        );
      }

      if (storedOTP.otp !== code) {
        return NextResponse.json(
          { error: "Invalid or expired passcode." },
          { status: 401 }
        );
      }

      if (new Date() > storedOTP.expires) {
        superAdminOTPStore.delete(email);
        return NextResponse.json(
          { error: "Invalid or expired passcode." },
          { status: 401 }
        );
      }

      // Clear OTP
      superAdminOTPStore.delete(email);

      authUser = {
        id: "super-admin",
        email,
        role: "SUPER_ADMIN",
        name: "Super Admin",
      };
    } else {
      // Check Admin
      const admin = await prisma.admin.findUnique({
        where: { email },
      });

      if (admin && admin.isActive && (admin.status === "active" || admin.status === "pending")) {
        if (!admin.otp || !admin.otpExpires) {
          return NextResponse.json(
            { error: "No OTP found. Please request a new one." },
            { status: 400 }
          );
        }

        if (admin.otp !== code) {
          return NextResponse.json(
            { error: "Invalid or expired passcode." },
            { status: 401 }
          );
        }

        if (new Date() > admin.otpExpires) {
          return NextResponse.json(
            { error: "Invalid or expired passcode." },
            { status: 401 }
          );
        }

        // Clear OTP and set status to active on first login
        await prisma.admin.update({
          where: { email },
          data: {
            otp: null,
            otpExpires: null,
            status: "active", // Set to active after first successful login
            isActive: true,
          },
        });

        authUser = {
          id: admin.id,
          email: admin.email,
          name: admin.name || undefined,
          role: "ADMIN",
        };
      } else {
        // Check User
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || (user.status !== "active" && user.status !== "pending")) {
          return NextResponse.json(
            {
              error:
                "User not found. Please contact your administrator to create an account.",
            },
            { status: 403 }
          );
        }

        if (!user.otp || !user.otpExpires) {
          return NextResponse.json(
            { error: "No OTP found. Please request a new one." },
            { status: 400 }
          );
        }

        if (user.otp !== code) {
          return NextResponse.json(
            { error: "Invalid or expired passcode." },
            { status: 401 }
          );
        }

        if (new Date() > user.otpExpires) {
          return NextResponse.json(
            { error: "Invalid or expired passcode." },
            { status: 401 }
          );
        }

        // Clear OTP and set status to active on first login
        await prisma.user.update({
          where: { email },
          data: {
            otp: null,
            otpExpires: null,
            status: "active", // Set to active after first successful login
          },
        });

        authUser = {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: "USER",
        };
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Invalid or expired passcode." },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = await generateToken(authUser);
    const cookieStore = await cookies();

    // Set auth cookie
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Determine dashboard route based on role
    let dashboard = "/dashboard";
    if (authUser.role === "SUPER_ADMIN") {
      dashboard = "/super-admin";
    } else if (authUser.role === "ADMIN") {
      dashboard = "/admin";
    } else if (authUser.role === "USER") {
      dashboard = "/user";
    }

    // Return success response
    return NextResponse.json({
      message: "Login successful.",
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
      },
      dashboard,
    });
  } catch (error: any) {
    console.error("[LOGIN] Error validating OTP:", error);
    return NextResponse.json(
      { error: "Failed to validate OTP. Please try again." },
      { status: 500 }
    );
  }
}

