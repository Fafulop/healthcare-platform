'use client';

import { useEffect } from 'react';
import { trackBlogView } from '@/lib/analytics';

interface BlogViewTrackerProps {
  doctorSlug: string;
  articleSlug: string;
  articleTitle: string;
}

export default function BlogViewTracker({ doctorSlug, articleSlug, articleTitle }: BlogViewTrackerProps) {
  useEffect(() => {
    trackBlogView(doctorSlug, articleSlug, articleTitle);
  }, [doctorSlug, articleSlug, articleTitle]);

  return null;
}
