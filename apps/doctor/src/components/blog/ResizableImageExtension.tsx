"use client";

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type ImageAlignment = "left" | "center" | "right" | "full";

export function getDefaultWidth(alignment: ImageAlignment): string {
  return alignment === "left" || alignment === "right" ? "45%" : "80%";
}

/**
 * Apply float/layout styles to the OUTER ProseMirror dom element
 * (parent of NodeViewWrapper) so the editor layout actually floats.
 *
 * Why: TipTap's ReactRenderer wraps the NodeView in its own div before
 * inserting it into the editor. Float applied only to NodeViewWrapper
 * (the inner div) is contained by that outer wrapper and never affects
 * adjacent paragraphs. We must style the outer element directly.
 *
 * We use individual property assignments (NOT cssText) to avoid wiping
 * any styles TipTap itself may have set on the outer dom element.
 */
function applyOuterDomStyle(
  el: HTMLElement,
  alignment: ImageAlignment,
  width: string
): void {
  // Reset all properties we may have previously set
  el.style.float = "";
  el.style.clear = "";
  el.style.display = "";
  el.style.width = "";
  el.style.maxWidth = "";
  el.style.margin = "";

  switch (alignment) {
    case "left":
      el.style.float = "left";
      el.style.margin = "0.25rem 1rem 0.5rem 0";
      el.style.width = width;
      el.style.maxWidth = "100%";
      break;
    case "right":
      el.style.float = "right";
      el.style.margin = "0.25rem 0 0.5rem 1rem";
      el.style.width = width;
      el.style.maxWidth = "100%";
      break;
    case "full":
      el.style.display = "block";
      el.style.clear = "both";
      el.style.width = "100%";
      el.style.margin = "1rem 0";
      break;
    default: // center
      el.style.display = "block";
      el.style.clear = "both";
      el.style.width = width;
      el.style.maxWidth = "100%";
      el.style.margin = "1rem auto";
      break;
  }
}

/** Inline styles written into the stored HTML — work in any renderer without shared CSS. */
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

/** 6-dot grip icon (no external icon dependency) */
function GripIcon() {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="2.5" cy="2.5" r="1.5" />
      <circle cx="7.5" cy="2.5" r="1.5" />
      <circle cx="2.5" cy="7" r="1.5" />
      <circle cx="7.5" cy="7" r="1.5" />
      <circle cx="2.5" cy="11.5" r="1.5" />
      <circle cx="7.5" cy="11.5" r="1.5" />
    </svg>
  );
}

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const alignment = (node.attrs.alignment as ImageAlignment) ?? "center";
  const width = (node.attrs.width as string | null) ?? getDefaultWidth(alignment);
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) ?? "";
  const [hovered, setHovered] = useState(false);

  // NodeViewWrapper ref — its parentElement is the outer ProseMirror dom
  const nodeViewRef = useRef<HTMLDivElement>(null);

  // Push float/layout styles onto the outer ProseMirror dom so adjacent
  // paragraphs correctly wrap around the image inside the editor.
  useEffect(() => {
    const outerDom = nodeViewRef.current?.parentElement as HTMLElement | null;
    if (!outerDom) return;
    applyOuterDomStyle(outerDom, alignment, width);
  }, [alignment, width]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Measure from the outer dom (which carries the actual float width)
      const outerDom = nodeViewRef.current?.parentElement as HTMLElement | null;
      const editor = outerDom?.closest(".ProseMirror") as HTMLElement | null;

      const startX = e.clientX;
      const startWidth = outerDom?.offsetWidth ?? 300;
      const containerWidth = editor?.offsetWidth ?? 700;

      const onMove = (ev: MouseEvent) => {
        const newPx = startWidth + (ev.clientX - startX);
        const pct = Math.round((newPx / containerWidth) * 100);
        updateAttributes({ width: `${Math.min(100, Math.max(15, pct))}%` });
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

  const showHandles = selected || hovered;

  return (
    // NodeViewWrapper: fills the outer dom (which controls float + width).
    // position:relative is needed for absolutely-positioned handles.
    <NodeViewWrapper
      ref={nodeViewRef}
      style={{ width: "100%", position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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

      {/* Drag handle — top-left grip, shown on hover or selection.
          data-drag-handle tells ProseMirror this is the node drag trigger.
          The base Image extension sets draggable:true so ProseMirror
          allows the node to be repositioned by dragging this handle. */}
      {showHandles && (
        <div
          data-drag-handle
          title="Arrastra para mover"
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            cursor: "grab",
            background: "rgba(0,0,0,0.55)",
            borderRadius: 4,
            padding: "3px 4px",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
          }}
        >
          <GripIcon />
        </div>
      )}

      {/* Right-edge resize handle */}
      {showHandles && (
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
          <div style={{ width: 2, height: 16, background: "white", borderRadius: 1 }} />
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
