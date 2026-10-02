"use client";

/**
 * Ayuda H1 — las pestañas del manual. Cada pestaña es un `##` de `manual-del-doctor.md` ya convertido a
 * HTML en el servidor (`lib/ayuda/manual-html.ts`). Los enlaces internos (`?tab=…#…`) cambian de pestaña
 * sin recargar y bajan a la sección.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
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

  // A dónde bajar DESPUÉS de pintar la pestaña. El scroll no puede ir en el mismo clic: la sección de otra
  // pestaña aún no existe en el DOM. Y el que hace scroll es el <main> del dashboard, no la ventana
  // (window.scrollTo no hace nada). `n` hace que el mismo destino dos veces vuelva a bajar.
  const [salto, setSalto] = useState<{ seccion: string | null; n: number }>({ seccion: null, n: 0 });
  const arriba = useRef<HTMLDivElement>(null);
  const saltarA = (seccion: string | null) => setSalto((s) => ({ seccion, n: s.n + 1 }));

  // Al entrar, o al llegar desde OTRO enlace estando ya en la página (el widget «?»): la URL cambia sin
  // remontar, así que la pestaña y la sección se leen de ella.
  const tabDeLaUrl = searchParams.get("tab");
  useEffect(() => {
    setActiva(resolver(tabDeLaUrl));
    const h = window.location.hash.slice(1);
    if (h) saltarA(decodeURIComponent(h));
  }, [tabDeLaUrl, resolver]);

  useEffect(() => {
    if (salto.n === 0) return;
    const id = requestAnimationFrame(() => {
      const destino = salto.seccion ? document.getElementById(salto.seccion) : arriba.current;
      destino?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [salto, activa]);

  const irA = (pestana: string, seccion?: string) => {
    setActiva(pestana);
    saltarA(seccion ?? null);
    router.replace(`${pathname}?tab=${pestana}${seccion ? `#${seccion}` : ""}`, { scroll: false });
  };

  // Un enlace a Ayuda desde FUERA del artículo (la línea «Manual: …» del widget «?») estando YA aquí: la
  // navegación de Next cambia la URL pero el scroll nunca llegaba (probado en Chrome: cero llamadas a
  // scrollIntoView). Se atrapa el clic antes que Next y va por `irA`, el mismo camino que sí baja.
  const irARef = useRef(irA);
  irARef.current = irA;
  useEffect(() => {
    const alClic = (e: globalThis.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      const m = /^\/dashboard\/ayuda\?tab=([^#&]+)(?:#(.+))?$/.exec(a?.getAttribute("href") ?? "");
      if (!m) return;
      e.preventDefault();
      irARef.current(resolver(m[1]), m[2] ? decodeURIComponent(m[2]) : undefined);
    };
    document.addEventListener("click", alClic, true);
    return () => document.removeEventListener("click", alClic, true);
  }, [resolver]);

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
      <div ref={arriba} className="scroll-mt-4" />
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
