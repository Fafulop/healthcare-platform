"use client";

/**
 * Ayuda H1 — las pestañas del manual. Cada pestaña es un `##` de `manual-del-doctor.md` ya convertido a
 * HTML en el servidor (`lib/ayuda/manual-html.ts`). Los enlaces internos (`?tab=…#…`) cambian de pestaña
 * sin recargar y bajan a la sección.
 */

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TabNav } from "./TabNav";
import type { ManualEnPestanas } from "@/lib/ayuda/manual-html";
import { ALIAS_DE_PESTANA } from "@/lib/ayuda/slug";

export function AyudaPestanas({ manual }: { manual: ManualEnPestanas }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const primera = manual.pestanas[0]?.id ?? "";
  const resolver = useCallback(
    (t: string | null) => {
      const id = t ? ALIAS_DE_PESTANA[t] ?? t : null;
      return id && manual.pestanas.some((p) => p.id === id) ? id : primera;
    },
    [manual.pestanas, primera],
  );
  const [activa, setActiva] = useState(() => resolver(searchParams.get("tab")));

  // Si se llega aquí desde OTRO enlace estando ya en la página (el widget «?»), la URL cambia sin remontar.
  const tabDeLaUrl = searchParams.get("tab");
  useEffect(() => { setActiva(resolver(tabDeLaUrl)); }, [tabDeLaUrl, resolver]);

  // Bajar a la sección del `#…` (al entrar con un enlace, o al cambiar de pestaña por uno).
  const bajarA = (id: string) => {
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (h) bajarA(decodeURIComponent(h));
  }, [activa]);

  const irA = (pestana: string, seccion?: string) => {
    setActiva(pestana);
    router.replace(`${pathname}?tab=${pestana}${seccion ? `#${seccion}` : ""}`, { scroll: false });
    if (seccion) bajarA(seccion);
    else window.scrollTo({ top: 0 });
  };

  // Un enlace del manual a otra sección: se queda en la página (sin recargar).
  const alHacerClic = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href") ?? "";
    const m = /^\?tab=([^#]+)(?:#(.+))?$/.exec(href);
    if (m) { e.preventDefault(); irA(m[1], m[2]); }
  };

  const pestana = manual.pestanas.find((p) => p.id === activa) ?? manual.pestanas[0];
  if (!pestana) return null;

  return (
    <>
      <TabNav
        tabs={manual.pestanas.map((p) => ({ id: p.id, label: p.titulo }))}
        activeTab={pestana.id}
        onChange={(id) => irA(id)}
      />
      <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
        {pestana.secciones.length > 0 && (
          <nav className="hidden lg:block text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">En esta pestaña</p>
            <ul className="space-y-1 sticky top-4">
              {pestana.secciones.map((s) => (
                <li key={s.id}>
                  <a href={`?tab=${pestana.id}#${s.id}`} onClick={(e) => { e.preventDefault(); irA(pestana.id, s.id); }}
                    className="text-gray-600 hover:text-blue-700">{s.titulo}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <article
          onClick={alHacerClic}
          className="prose prose-sm sm:prose-base max-w-none prose-headings:scroll-mt-4 prose-a:text-blue-700"
          dangerouslySetInnerHTML={{ __html: pestana.html }}
        />
      </div>
      {manual.introHtml.trim() && (
        <details className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">Cómo leer esta ayuda</summary>
          <div className="prose prose-sm max-w-none mt-2" dangerouslySetInnerHTML={{ __html: manual.introHtml }} />
        </details>
      )}
    </>
  );
}
