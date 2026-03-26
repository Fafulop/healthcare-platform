"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { useUploadThing } from '@/lib/uploadthing';
import { ImageWithAlignment, type ImageAlignment } from './ImageAlignmentExtension';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  AlignLeft as TextAlignLeft,
  AlignCenter as TextAlignCenter,
  AlignRight as TextAlignRight,
  AlignJustify,
  LinkIcon,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Highlighter,
  Baseline,
  Loader2,
  Undo,
  Redo,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing your article...',
}: RichTextEditorProps) {
  const isInitialLoad = useRef(true);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing('blogImages');

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        ImageWithAlignment.configure({
          inline: false,
          allowBase64: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-green-600 underline hover:text-green-700',
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph', 'bulletList', 'orderedList', 'blockquote'],
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: false }),
      ],
      content,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'prose max-w-none focus:outline-none min-h-[300px] px-4 py-3',
        },
      },
    },
    [] // Only create editor once
  );

  // Update editor content ONLY when content prop changes from external source (e.g., loading saved article)
  useEffect(() => {
    if (!editor || !content) return;

    // On initial load, if content is provided and different from current, update it
    if (isInitialLoad.current && content.trim() !== '') {
      if (editor.getHTML() !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
      isInitialLoad.current = false;
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    // Reset so the same file can be picked again later
    e.target.value = '';
    setUploadError(null);

    try {
      const result = await startUpload([file]);
      if (!result || result.length === 0) throw new Error('Error al subir imagen');
      const url = result[0]?.url;
      if (!url) throw new Error('Error al subir imagen');
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      setUploadError('No se pudo subir la imagen. Intenta de nuevo.');
    }
  };

  const setAlignment = (alignment: ImageAlignment) => {
    editor.chain().focus().updateAttributes('image', { alignment }).run();
  };

  const activeAlignment: ImageAlignment =
    (editor.getAttributes('image').alignment as ImageAlignment) ?? 'center';

  const imageIsSelected = editor.isActive('image');

  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? 'bg-green-100 text-green-700'
          : 'hover:bg-gray-100 text-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-300 bg-gray-50 p-2 flex flex-wrap gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => colorInputRef.current?.click()}
          isActive={!!editor.getAttributes('textStyle').color}
          title="Text color"
        >
          <Baseline className="w-4 h-4" />
        </ToolbarButton>

        {editor.getAttributes('textStyle').color && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetColor().run()}
            title="Remove color"
          >
            <span className="text-xs font-bold leading-none">✕</span>
          </ToolbarButton>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align left"
        >
          <TextAlignLeft className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align center"
        >
          <TextAlignCenter className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align right"
        >
          <TextAlignRight className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={addLink}
          isActive={editor.isActive('link')}
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton onClick={addImage} disabled={isUploading} title="Upload Image">
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Image upload error */}
      {uploadError && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {uploadError}
        </div>
      )}

      {/* Image alignment toolbar — visible only when an image is selected */}
      {imageIsSelected && (
        <div className="border-b border-gray-300 bg-blue-50 px-2 py-1 flex items-center gap-1 text-xs text-blue-700">
          <span className="mr-1 font-medium">Alinear imagen:</span>
          <ToolbarButton
            onClick={() => setAlignment('left')}
            isActive={activeAlignment === 'left'}
            title="Flotar a la izquierda (texto rodea)"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setAlignment('center')}
            isActive={activeAlignment === 'center'}
            title="Centrar"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setAlignment('right')}
            isActive={activeAlignment === 'right'}
            title="Flotar a la derecha (texto rodea)"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setAlignment('full')}
            isActive={activeAlignment === 'full'}
            title="Ancho completo"
          >
            <Maximize2 className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Character count */}
      <div className="border-t border-gray-300 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        {editor.getText().length} characters
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* Hidden color picker for text color — onBlur fires once when picker closes, avoiding undo stack pollution */}
      <input
        ref={colorInputRef}
        type="color"
        className="hidden"
        onBlur={(e) => editor.chain().focus().setColor(e.target.value).run()}
      />
    </div>
  );
}
