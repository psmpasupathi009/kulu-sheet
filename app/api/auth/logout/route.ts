import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * Logs out the current user
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Clear auth cookie
    cookieStore.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error logging out:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}

