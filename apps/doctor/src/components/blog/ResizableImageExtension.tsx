"use client";

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback } from "react";

export type ImageAlignment = "left" | "center" | "right" | "full";

export function getDefaultWidth(alignment: ImageAlignment): string {
  return alignment === "left" || alignment === "right" ? "45%" : "80%";
}

function buildInlineStyle(alignment: ImageAlignment, width: string): string {
  switch (alignment) {
    case "left":
      return `float:left;margin:0.25rem 1rem 0.5rem 0;width:${width};max-width:100%;border-radius:0.5rem;`;
    case "right":
      return `float:right;margin:0.25rem 0 0.5rem 1rem;width:${width};max-width:100%;border-radius:0.5rem;`;
    case "full":
      return `display:block;clear:both;width:100%;margin:1rem 0;border-radius:0.5rem;`;
    default: // center
      return `display:block;clear:both;margin:1rem auto;width:${width};max-width:100%;border-radius:0.5rem;`;
  }
}

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const alignment = (node.attrs.alignment as ImageAlignment) ?? "center";
  const width = (node.attrs.width as string | null) ?? getDefaultWidth(alignment);
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) ?? "";

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget as HTMLElement;
      // NodeViewWrapper div is the grandparent of the handle (wrapper > img+handles)
      const wrapper = handle.parentElement as HTMLElement;
      const editor = wrapper.closest(".ProseMirror") as HTMLElement | null;

      const startX = e.clientX;
      const startWidth = wrapper.offsetWidth;
      const containerWidth = editor?.offsetWidth ?? 700;

      const onMove = (ev: MouseEvent) => {
        const newPx = startWidth + (ev.clientX - startX);
        const pct = Math.round((newPx / containerWidth) * 100);
        const clamped = Math.min(100, Math.max(15, pct));
        updateAttributes({ width: `${clamped}%` });
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [updateAttributes]
  );

  const wrapperStyle: React.CSSProperties = (() => {
    switch (alignment) {
      case "left":
        return {
          float: "left",
          margin: "0.25rem 1rem 0.5rem 0",
          width,
          maxWidth: "100%",
          position: "relative",
        };
      case "right":
        return {
          float: "right",
          margin: "0.25rem 0 0.5rem 1rem",
          width,
          maxWidth: "100%",
          position: "relative",
        };
      case "full":
        return {
          display: "block",
          clear: "both",
          width: "100%",
          margin: "1rem 0",
          position: "relative",
        };
      default: // center
        return {
          display: "block",
          clear: "both",
          margin: "1rem auto",
          width,
          maxWidth: "100%",
          position: "relative",
        };
    }
  })();

  return (
    <NodeViewWrapper style={wrapperStyle}>
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "0.5rem",
        }}
        draggable={false}
      />

      {/* Selection ring */}
      {selected && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid #3b82f6",
            borderRadius: "0.5rem",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Right-edge resize handle */}
      {selected && (
        <div
          onMouseDown={handleResizeStart}
          title="Arrastra para cambiar tamaño"
          style={{
            position: "absolute",
            right: -6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 32,
            background: "#3b82f6",
            borderRadius: 4,
            cursor: "ew-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 2,
              height: 16,
              background: "white",
              borderRadius: 1,
            }}
          />
        </div>
      )}

      {/* Width badge */}
      {selected && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.65)",
            color: "white",
            fontSize: 11,
            padding: "2px 7px",
            borderRadius: 3,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {width}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const ImageWithAlignment = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: "center" as ImageAlignment,
        parseHTML: (el) =>
          (el.getAttribute("data-alignment") as ImageAlignment) ?? "center",
        renderHTML: (attrs) => ({ "data-alignment": attrs.alignment }),
      },
      width: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-width") ?? null,
        renderHTML: (attrs) => {
          const al = (attrs.alignment as ImageAlignment) ?? "center";
          const w = (attrs.width as string | null) ?? getDefaultWidth(al);
          return {
            "data-width": w,
            style: buildInlineStyle(al, w),
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
