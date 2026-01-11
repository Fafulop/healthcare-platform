"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Send, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import RichTextEditor from "@/components/blog/RichTextEditor";
import { isValidSlug } from "@/lib/slug-generator";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  thumbnail: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  metaDescription: string | null;
  keywords: string[];
}

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [article, setArticle] = useState<Article | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    thumbnail: '',
    metaDescription: '',
    keywords: '',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugChanged, setSlugChanged] = useState(false);

  // Unwrap params
  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  // Fetch doctor profile
  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
  }, [session]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const getAuthHeaders = async () => {
    if (!session?.user?.email) {
      throw new Error('No active session');
    }

    const authPayload = {
      email: session.user.email,
      role: session.user.role,
      timestamp: Date.now(),
    };

    const token = btoa(JSON.stringify(authPayload));

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  // Fetch article data
  useEffect(() => {
    if (session && id) {
      fetchArticle();
    }
  }, [session, id]);

  const fetchArticle = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_URL}/api/articles/${id}`, {
        headers,
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        setArticle(result.data);
        setFormData({
          title: result.data.title,
          slug: result.data.slug,
          content: result.data.content,
          excerpt: result.data.excerpt,
          thumbnail: result.data.thumbnail || '',
          metaDescription: result.data.metaDescription || '',
          keywords: result.data.keywords ? result.data.keywords.join(', ') : '',
          status: result.data.status,
        });
      } else {
        setError(result.error || 'Failed to load article');
      }
    } catch (err) {
      console.error('Error fetching article:', err);
      setError('Error loading article');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (newStatus?: 'DRAFT' | 'PUBLISHED') => {
    if (!id) return;

    // Validation
    if (!formData.title?.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.slug?.trim()) {
      setError('Slug is required');
      return;
    }

    if (!isValidSlug(formData.slug)) {
      setError('Invalid slug format. Use only lowercase letters, numbers, and hyphens.');
      return;
    }

    if (!formData.content?.trim()) {
      setError('Content is required');
      return;
    }

    if (!formData.excerpt?.trim()) {
      setError('Excerpt is required');
      return;
    }

    if (formData.excerpt.length > 200) {
      setError('Excerpt must be 200 characters or less');
      return;
    }

    // Check slug change protection for published articles
    if (article?.status === 'PUBLISHED' && formData.slug !== article.slug) {
      setError('Cannot change slug of published article (SEO protection)');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_URL}/api/articles/${id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          slug: formData.slug,
          content: formData.content,
          excerpt: formData.excerpt,
          thumbnail: formData.thumbnail || null,
          metaDescription: formData.metaDescription || null,
          keywords: formData.keywords
            ? formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
            : [],
          status: newStatus || formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to blog management page
        router.push('/dashboard/blog');
      } else {
        setError(result.error || 'Failed to update article');
      }
    } catch (err) {
      console.error('Error updating article:', err);
      setError('Error updating article');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (article && formData.slug !== article.slug) {
      setSlugChanged(true);
    } else {
      setSlugChanged(false);
    }
  }, [formData.slug, article]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar doctorProfile={doctorProfile} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <p className="text-xl text-gray-900 mb-2">Error Loading Article</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard/blog')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Back to Blog
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/blog')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Article</h1>
          {article?.status === 'PUBLISHED' && (
            <p className="text-sm text-green-600 mt-1">This article is currently published</p>
          )}
        </div>

        {/* SEO Warning for Slug Changes */}
        {slugChanged && article?.status === 'PUBLISHED' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900">SEO Protection Warning</p>
              <p className="text-yellow-700 text-sm">
                You cannot change the slug of a published article. This protects your SEO rankings and prevents broken links.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slug <span className="text-red-600">*</span>
              {article?.status === 'PUBLISHED' && (
                <span className="text-xs text-red-600 ml-2">(Cannot be changed - SEO protection)</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">/blog/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                disabled={article?.status === 'PUBLISHED'}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thumbnail Image URL
            </label>
            <input
              type="url"
              value={formData.thumbnail}
              onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {formData.thumbnail && (
              <img
                src={formData.thumbnail}
                alt="Thumbnail preview"
                className="mt-2 w-full max-w-xs h-48 object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Content Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content <span className="text-red-600">*</span>
            </label>
            <RichTextEditor
              content={formData.content}
              onChange={(html) => setFormData({ ...formData, content: html })}
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excerpt <span className="text-red-600">*</span>
              <span className="text-xs text-gray-500 ml-2">(Short summary, max 200 chars)</span>
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              maxLength={200}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.excerpt.length}/200 characters
            </p>
          </div>

          {/* SEO Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">SEO (Optional)</h3>

            {/* Meta Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Description
                <span className="text-xs text-gray-500 ml-2">(Max 160 chars)</span>
              </label>
              <textarea
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                maxLength={160}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.metaDescription.length}/160 characters
              </p>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keywords
                <span className="text-xs text-gray-500 ml-2">(Comma-separated)</span>
              </label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div>
              {article?.status === 'PUBLISHED' && (
                <button
                  type="button"
                  onClick={() => handleSubmit('DRAFT')}
                  disabled={saving}
                  className="px-4 py-2 text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  Unpublish
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard/blog')}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {article?.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => handleSubmit('DRAFT')}
                  disabled={saving}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Draft
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSubmit(article?.status === 'PUBLISHED' ? 'PUBLISHED' : 'PUBLISHED')}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {article?.status === 'PUBLISHED' ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
