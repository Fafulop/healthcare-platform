/**
 * Ayuda (H1, 2026-10-01): las pestañas de /dashboard/ayuda SON el manual (`manual-del-doctor.md`), el
 * mismo archivo del que contesta el widget «?» — una sola fuente: la guía y el widget no pueden decir
 * cosas distintas. Cada `##` es una pestaña; sus `###` son las secciones dentro.
 *
 * Los enlaces internos del manual (`[…](#facturar-desde-el-expediente)`) se reescriben a
 * `?tab=<pestaña>#<sección>` para que salten a la pestaña correcta. El contenido es NUESTRO (un .md del
 * repo, no algo que escriba un usuario), así que se puede pintar como HTML.
 */
import { Marked, type Tokens } from 'marked';
import { slugAyuda } from './slug';

export { slugAyuda, ALIAS_DE_PESTANA } from './slug';

export interface SeccionDePestana { id: string; titulo: string }
export interface PestanaManual { id: string; titulo: string; html: string; secciones: SeccionDePestana[] }
export interface ManualEnPestanas {
  /** Lo que va ANTES del primer `##` («Marcas que usa este manual»): se enseña arriba de todas. */
  introHtml: string;
  pestanas: PestanaManual[];
  /** id de sección (o de pestaña) → id de su pestaña. */
  pestanaDe: Record<string, string>;
}

export function manualEnPestanas(texto: string): ManualEnPestanas {
  const lineas = texto.split('\n');
  const bloques: { titulo: string; lineas: string[] }[] = [];
  const intro: string[] = [];
  for (const l of lineas) {
    const h2 = /^##\s+(.+?)\s*$/.exec(l);
    if (h2 && !l.startsWith('###')) { bloques.push({ titulo: h2[1], lineas: [] }); continue; }
    (bloques.length ? bloques[bloques.length - 1].lineas : intro).push(l);
  }

  // 1.ª pasada: qué pestaña tiene cada sección (para reescribir los enlaces internos).
  const pestanaDe: Record<string, string> = {};
  const pestanas: PestanaManual[] = bloques.map((b) => {
    const id = slugAyuda(b.titulo);
    pestanaDe[id] = id;
    const secciones: SeccionDePestana[] = [];
    for (const l of b.lineas) {
      const h3 = /^###\s+(.+?)\s*$/.exec(l);
      if (h3) { const sid = slugAyuda(h3[1]); secciones.push({ id: sid, titulo: h3[1] }); pestanaDe[sid] = id; }
    }
    return { id, titulo: b.titulo, html: '', secciones };
  });

  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { tokens, depth, text }: Tokens.Heading) {
        return `<h${depth} id="${slugAyuda(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { href, title, tokens }: Tokens.Link) {
        let destino = href;
        if (href.startsWith('#')) {
          const sid = href.slice(1);
          const pestana = pestanaDe[sid];
          destino = pestana ? `?tab=${pestana}#${sid}` : href;
        }
        const t = title ? ` title="${title}"` : '';
        return `<a href="${destino}"${t}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });

  bloques.forEach((b, i) => { pestanas[i].html = md.parse(b.lineas.join('\n')) as string; });
  return { introHtml: md.parse(intro.join('\n')) as string, pestanas, pestanaDe };
}
