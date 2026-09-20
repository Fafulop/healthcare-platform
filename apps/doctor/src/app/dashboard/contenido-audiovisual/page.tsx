"use client";

// Igual que el blog: el contenido vive en el componente porque tambien es una
// pestana de «Perfil Publico», y la ruta se conserva para un member con
// `contenido` pero sin `perfil`.
import ContenidoSection from "@/components/profile/ContenidoSection";

export default function ContenidoAudiovisualPage() {
  return <ContenidoSection />;
}
