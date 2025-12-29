// GET /api/articles/[id] - Get single article with full details (doctor only, own articles)
// PUT /api/articles/[id] - Update article (doctor only, own articles)
// DELETE /api/articles/[id] - Delete article (doctor only, own articles)
// PATCH /api/articles/[id]/publish - Publish/unpublish article

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate and get doctor profile
    const { doctor } = await getAuthenticatedDoctor(request);

    // Get article with ALL fields
    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
        },
        { status: 404 }
      );
    }

    // Check ownership
    if (article.doctorId !== doctor.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only view your own articles',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error fetching article:', error);

    const message = error instanceof Error ? error.message : 'Failed to fetch article';
    const status = message.includes('access required') || message.includes('not found') ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate and get doctor profile
    const { doctor } = await getAuthenticatedDoctor(request);

    // Check if article exists and belongs to this doctor
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
        },
        { status: 404 }
      );
    }

    if (existingArticle.doctorId !== doctor.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only edit your own articles',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Prevent slug changes after publishing (SEO protection)
    if (body.slug && body.slug !== existingArticle.slug && existingArticle.status === 'PUBLISHED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot change slug',
          message: 'Cannot change slug of published article (SEO protection)',
        },
        { status: 400 }
      );
    }

    // If changing status to PUBLISHED, set publishedAt
    const statusChanged = body.status && body.status !== existingArticle.status;
    const isPublishing = statusChanged && body.status === 'PUBLISHED';
    const isUnpublishing = statusChanged && body.status === 'DRAFT';

    // Update article
    const article = await prisma.article.update({
      where: { id },
      data: {
        title: body.title ?? existingArticle.title,
        slug: body.slug ?? existingArticle.slug,
        excerpt: body.excerpt ?? existingArticle.excerpt,
        content: body.content ?? existingArticle.content,
        thumbnail: body.thumbnail !== undefined ? body.thumbnail : existingArticle.thumbnail,
        status: body.status ?? existingArticle.status,
        publishedAt: isPublishing
          ? new Date()
          : isUnpublishing
            ? null
            : existingArticle.publishedAt,
        metaDescription: body.metaDescription !== undefined ? body.metaDescription : existingArticle.metaDescription,
        keywords: body.keywords ?? existingArticle.keywords,
      },
    });

    console.log(`✅ Article updated: ${article.slug} by ${doctor.doctorFullName}`);

    return NextResponse.json({
      success: true,
      data: article,
      message: 'Article updated successfully',
    });
  } catch (error) {
    console.error('Error updating article:', error);

    const message = error instanceof Error ? error.message : 'Failed to update article';
    const status = message.includes('access required') || message.includes('not found') ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate and get doctor profile
    const { doctor } = await getAuthenticatedDoctor(request);

    // Check if article exists and belongs to this doctor
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
        },
        { status: 404 }
      );
    }

    if (existingArticle.doctorId !== doctor.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only delete your own articles',
        },
        { status: 403 }
      );
    }

    // Delete article
    await prisma.article.delete({
      where: { id },
    });

    console.log(`✅ Article deleted: ${existingArticle.slug} by ${doctor.doctorFullName}`);

    return NextResponse.json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting article:', error);

    const message = error instanceof Error ? error.message : 'Failed to delete article';
    const status = message.includes('access required') || message.includes('not found') ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
