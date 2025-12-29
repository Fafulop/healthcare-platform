interface ArticleContentProps {
  content: string; // HTML string from Tiptap editor
}

export function ArticleContent({ content }: ArticleContentProps) {
  return (
    <div
      className="prose prose-lg max-w-none
        prose-headings:text-gray-900
        prose-h2:text-3xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4
        prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
        prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
        prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-gray-900 prose-strong:font-semibold
        prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
        prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
        prose-li:text-gray-700 prose-li:my-2
        prose-img:rounded-lg prose-img:my-8
        prose-blockquote:border-l-4 prose-blockquote:border-green-500
        prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
