// GET /api/doctors/[slug]/articles/[articleSlug] - Get single published article (public)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; articleSlug: string }> }
) {
  try {
    const { slug, articleSlug } = await params;

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

    // Get the article (only if published)
    const article = await prisma.article.findUnique({
      where: { slug: articleSlug },
      include: {
        doctor: {
          select: {
            id: true,
            slug: true,
            doctorFullName: true,
            primarySpecialty: true,
            heroImage: true,
            city: true,
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: `Article with slug "${articleSlug}" not found`,
        },
        { status: 404 }
      );
    }

    // Verify article belongs to this doctor
    if (article.doctorId !== doctor.id) {
      return NextResponse.json(
        {
          success: false,
          error: `Article "${articleSlug}" does not belong to doctor "${slug}"`,
        },
        { status: 404 }
      );
    }

    // Only return published articles to the public
    if (article.status !== 'PUBLISHED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not available',
        },
        { status: 404 }
      );
    }

    // Increment view count (async, don't wait)
    prisma.article
      .update({
        where: { id: article.id },
        data: { views: { increment: 1 } },
      })
      .catch((error) => {
        console.error('Failed to increment view count:', error);
        // Don't fail the request if view count update fails
      });

    return NextResponse.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch article',
      },
      { status: 500 }
    );
  }
}
