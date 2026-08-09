/**
 * Copia el worker de pdf.js a `public/pdfjs/`.
 *
 * El visor del informe (`InformeVisor.tsx`) renderiza el PDF EN EL NAVEGADOR y
 * pdf.js necesita su worker como archivo servido. Se copia en vez de dejar que
 * el bundler lo resuelva porque ese import dinámico es justo lo que ya nos
 * tronó una vez en la ruta desplegada (ver `serverExternalPackages` en
 * next.config.ts).
 *
 * Corre en `prebuild` y `predev`, así que la copia SIEMPRE empata con la versión
 * instalada de `pdfjs-dist`. El archivo también está commiteado: si algún día el
 * `prebuild` no corriera en Railway, el visor sigue funcionando en vez de
 * quedarse en blanco en producción.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkgJson = require.resolve('pdfjs-dist/package.json');
const raiz = path.dirname(pkgJson);
const version = JSON.parse(readFileSync(pkgJson, 'utf8')).version;

const origen = path.join(raiz, 'build', 'pdf.worker.min.mjs');
const destinoDir = path.join(process.cwd(), 'public', 'pdfjs');
const destino = path.join(destinoDir, 'pdf.worker.min.mjs');

mkdirSync(destinoDir, { recursive: true });
copyFileSync(origen, destino);
console.log(`[pdf-worker] copiado pdfjs-dist@${version} -> public/pdfjs/pdf.worker.min.mjs`);
