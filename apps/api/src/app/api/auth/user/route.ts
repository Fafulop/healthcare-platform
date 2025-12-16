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
      user = await prisma.user.create({
        data: {
          email,
          name,
          image,
          role: "DOCTOR", // Default role for new users
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

      console.log(`✅ New user created: ${email} (role: DOCTOR)`);
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
