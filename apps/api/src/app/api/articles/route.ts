// GET /api/articles - Get all articles for authenticated doctor (published + drafts)
// POST /api/articles - Create new article (doctor only)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Authenticate and get doctor profile
    const { doctor } = await getAuthenticatedDoctor(request);

    // Get all articles for this doctor (including drafts)
    const articles = await prisma.article.findMany({
      where: {
        doctorId: doctor.id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        thumbnail: true,
        status: true,
        publishedAt: true,
        views: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc', // Most recently updated first
      },
    });

    return NextResponse.json({
      success: true,
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching articles:', error);

    const message = error instanceof Error ? error.message : 'Failed to fetch articles';
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

export async function POST(request: Request) {
  try {
    // Authenticate and get doctor profile
    const { doctor } = await getAuthenticatedDoctor(request);

    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.slug || !body.content || !body.excerpt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          message: 'title, slug, content, and excerpt are required',
        },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingArticle = await prisma.article.findUnique({
      where: { slug: body.slug },
    });

    if (existingArticle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Slug already exists',
          message: `An article with slug "${body.slug}" already exists`,
        },
        { status: 400 }
      );
    }

    // Create article
    const article = await prisma.article.create({
      data: {
        doctorId: doctor.id,
        slug: body.slug,
        title: body.title,
        excerpt: body.excerpt,
        content: body.content,
        thumbnail: body.thumbnail || null,
        status: body.status || 'DRAFT',
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
        metaDescription: body.metaDescription || null,
        keywords: body.keywords || [],
      },
    });

    console.log(`✅ Article created: ${article.slug} by ${doctor.doctorFullName}`);

    return NextResponse.json({
      success: true,
      data: article,
      message: 'Article created successfully',
    });
  } catch (error) {
    console.error('Error creating article:', error);

    const message = error instanceof Error ? error.message : 'Failed to create article';
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
