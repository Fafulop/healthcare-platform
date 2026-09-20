"use client";

// La lista vive en `components/profile/BlogSection` porque tambien es una
// pestana de «Perfil Publico». Esta ruta se conserva a proposito: es el unico
// camino de un member con el toggle `blog` pero sin `perfil`.
import BlogSection from "@/components/profile/BlogSection";

export default function BlogPage() {
  return <BlogSection />;
}
