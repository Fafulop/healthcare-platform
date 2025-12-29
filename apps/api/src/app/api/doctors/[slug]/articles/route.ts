// GET /api/doctors/[slug]/articles - Get all published articles for a doctor (public)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // First, verify doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        doctorFullName: true,
        primarySpecialty: true,
        heroImage: true,
        city: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        {
          success: false,
          error: `Doctor with slug "${slug}" not found`,
        },
        { status: 404 }
      );
    }

    // Get all published articles for this doctor
    const articles = await prisma.article.findMany({
      where: {
        doctorId: doctor.id,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        thumbnail: true,
        publishedAt: true,
        views: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        publishedAt: 'desc', // Newest first
      },
    });

    return NextResponse.json({
      success: true,
      data: articles,
      doctor: {
        slug: doctor.slug,
        doctorFullName: doctor.doctorFullName,
        primarySpecialty: doctor.primarySpecialty,
        heroImage: doctor.heroImage,
        city: doctor.city,
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch articles',
      },
      { status: 500 }
    );
  }
}
