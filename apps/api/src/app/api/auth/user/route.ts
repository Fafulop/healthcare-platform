import { prisma } from "@healthcare/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, image } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        doctorId: true,
      },
    });

    // Create user if doesn't exist
    if (!user) {
      // Get admin emails from environment variable
      const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
      const adminEmails = adminEmailsEnv
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      // Log warning if no admin emails configured
      if (adminEmails.length === 0) {
        console.warn('⚠️ WARNING: No admin emails configured in ADMIN_EMAILS environment variable!');
        console.warn('⚠️ All new users will be created as DOCTOR role by default.');
      }

      // Determine role based on email
      const role = adminEmails.includes(email) ? "ADMIN" : "DOCTOR";

      user = await prisma.user.create({
        data: {
          email,
          name,
          image,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          doctorId: true,
        },
      });

      console.log(`✅ New user created: ${email} (role: ${role})`);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error in /api/auth/user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
