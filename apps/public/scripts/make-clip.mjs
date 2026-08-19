#!/usr/bin/env node
/**
 * Convierte una grabación —o una tanda de capturas— en el trío que consume
 * `CapabilityClip`: `<base>.mp4`, `<base>.webm` y `<base>.webp` (el póster).
 *
 *   node apps/public/scripts/make-clip.mjs <entrada> <base> [--hold 1.2] [--fade 0.35]
 *
 *   <entrada>  una carpeta con PNG/JPG numerados, o un archivo de video.
 *   <base>     el nombre que va en `clip.base` (sin extensión).
 *
 * POR QUÉ ESTO ES UN SCRIPT Y NO UN COMANDO QUE SE COPIA A MANO: los ajustes
 * de abajo son los que hacen que la letra del panel se lea. Tecleados de
 * memoria la próxima vez, salen distintos, y un clip borroso al lado de tres
 * nítidos se nota más que cuatro borrosos.
 *
 * EL ANCHO. La columna de texto mide ~545px en el breakpoint grande, así que
 * se entrega a 1100 — el 2× justo para pantallas retina. Subirlo no se ve y sí
 * pesa. Y OJO: el ancho se respeta, no se INVENTA. Escalar hacia ARRIBA una
 * captura chica no añade detalle, sólo emborrona la letra; por eso se avisa en
 * vez de agrandar en silencio.
 *
 * EL RECORTE. Lo que salva la legibilidad no es el bitrate, es encuadrar la
 * zona que importa al grabar. Una pantalla de 2560px metida en 1100 convierte
 * cada etiqueta en una mancha, y ningún `crf` la rescata.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/* ── ffmpeg ──
   Recién instalado con winget, el binario todavía no está en el PATH de esta
   terminal (winget avisa que hay que reabrirla). Se busca donde lo deja, para
   que el script sirva ANTES de reiniciar nada. */
const FFMPEG =
  process.env.FFMPEG ||
  [
    join(
      process.env.LOCALAPPDATA || '',
      'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    ),
  ].find((p) => p && existsSync(p)) ||
  'ffmpeg';

const WIDTH = 1100;
const OUT_DIR = resolve('apps/public/public/clips');

const [input, base, ...rest] = process.argv.slice(2);
if (!input || !base) {
  console.error('uso: make-clip.mjs <carpeta-o-video> <base> [--hold s] [--fade s]');
  process.exit(1);
}

const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(rest[i + 1]);
};
/** Cuánto se queda quieto cada estado, y cuánto dura el disolvimiento. */
const HOLD = flag('hold', 1.2);
const FADE = flag('fade', 0.35);

/**
 * EL COLOR. Un archivo de video no lleva los colores puestos: lleva números y
 * una ETIQUETA que dice cómo interpretarlos. Sin etiqueta el navegador ADIVINA
 * —Chrome suele asumir BT.709 y rango limitado— y si ffmpeg convirtió con otra
 * matriz, todo sale desviado y sin fuerza. Eso no se arregla subiéndole la
 * saturación: se arregla diciendo la verdad en los dos lados.
 *
 * Así que aquí se fija BT.709 al CONVERTIR (`out_color_matrix`) y se ETIQUETA
 * BT.709 al escribir. Los dos, siempre, en el intermedio y en las dos entregas.
 *
 * OJO CON EL CÓMO: las banderas de salida `-color_primaries` / `-color_trc` NO
 * bastan. Con ffmpeg 9.0 se probaron las dos formas sobre el mismo archivo:
 *
 *   sólo banderas de salida → color_primaries=bt709, transfer=unknown, space=unknown
 *   `setparams` en el filtro → las TRES en bt709
 *
 * Media etiqueta es lo mismo que ninguna: el navegador sigue adivinando lo que
 * falta. Por eso el marcado va en la cadena de filtros, que sella los cuadros
 * y se propaga solo a las dos entregas; las banderas se quedan como cinturón.
 */
const COLOR = [
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-colorspace', 'bt709',
  '-color_range', 'tv',
];
const SETPARAMS =
  'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

/**
 * Último recurso, apagado por defecto. Si tras descartar HDR y etiquetado el
 * clip SIGUE viéndose apagado, se puede empujar un poco.
 *
 * ⚠️ Pasado cierto punto esto deja de corregir y empieza a MENTIR: el clip
 * promete un producto de colores que nadie va a ver al entrar. Subir de ~1.15
 * es maquillar, no corregir.
 */
const SAT = flag('saturacion', 1);
const BRILLO = flag('brillo', 0);
const EQ = SAT !== 1 || BRILLO !== 0 ? `,eq=saturation=${SAT}:brightness=${BRILLO}` : '';

/** La cadena de escalado, idéntica en los dos caminos (capturas y grabación). */
const VF =
  `scale=${WIDTH}:-2:flags=lanczos:out_color_matrix=bt709:out_range=tv` +
  `,setsar=1${EQ},format=yuv420p,${SETPARAMS}`;

/**
 * ffmpeg escupe su versión y sus banderas por stderr SIEMPRE, así que se
 * guarda callado y sólo se enseña si algo truena — y entonces se enseña de
 * verdad. Sin este `catch`, Node imprime el buffer como una lista de bytes y
 * el motivo del fallo, que ffmpeg dice clarísimo en la última línea, no
 * aparece por ningún lado.
 */
const run = (args) => {
  try {
    return execFileSync(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const log = (err.stderr?.toString() || '').trimEnd().split('\n');
    console.error(`\n✗ ffmpeg falló:\n${log.slice(-12).join('\n')}\n`);
    process.exit(1);
  }
};
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
const probeWidth = (file) =>
  Number(
    execFileSync(FFPROBE, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width', '-of', 'csv=p=0', file,
    ])
      .toString()
      .trim()
      .split(',')[0],
  );

/**
 * Escalar hacia arriba no añade detalle: sólo emborrona la letra del panel y
 * engorda el archivo. El script sigue adelante —a veces la toma chica es la
 * única que hay— pero lo dice, porque en pantalla se ve como «el clip salió
 * mal» y el culpable estaba en la grabación, no aquí.
 */
function warnIfSmaller(file) {
  const w = probeWidth(file);
  if (w < WIDTH) {
    console.warn(
      `  ⚠ la fuente mide ${w}px de ancho y la entrega son ${WIDTH}px: se va a AGRANDAR.\n` +
        `    La letra va a salir blanda. Regrábala a ${WIDTH}px o más, recortando a la zona que importa.`,
    );
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const src = resolve(input);
const isDir = statSync(src).isDirectory();

/* ── 1. Un video intermedio sin pérdida ──
   Se pasa por un archivo intermedio en vez de encadenar todo en un comando: el
   mp4 y el webm salen del MISMO material, así que no pueden acabar desfasados,
   y el póster se saca de ahí en vez de de una de las dos codificaciones.

   El intermedio vive FUERA de `public/`: Next sirve tal cual todo lo que hay
   en esa carpeta, incluidos los archivos que empiezan por punto, así que
   dejarlo ahí publicaría un master sin comprimir —más pesado que las dos
   entregas juntas— en una URL adivinable. */
const work = join(tmpdir(), `${base}.work.mp4`);

if (isDir) {
  const frames = readdirSync(src)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => join(src, f));

  if (frames.length === 0) throw new Error(`sin capturas en ${src}`);
  console.log(`· ${frames.length} capturas · ${HOLD}s cada una · fundido ${FADE}s`);
  warnIfSmaller(frames[0]);

  /* Cada captura entra como un video de HOLD segundos y se encadenan con
     `xfade`. El desplazamiento es acumulativo MENOS el fundido: si no se
     descuenta, cada transición empuja a la siguiente y la última se queda
     fuera del clip. */
  const inputs = frames.flatMap((f) => ['-loop', '1', '-t', String(HOLD), '-i', f]);
  let filter = frames.map((_, i) => `[${i}:v]${VF}[v${i}]`).join(';');
  let last = 'v0';
  let offset = HOLD - FADE;
  for (let i = 1; i < frames.length; i++) {
    const out = `x${i}`;
    filter += `;[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${out}]`;
    last = out;
    offset += HOLD - FADE;
  }

  run([
    '-y',
    ...inputs,
    '-filter_complex', filter,
    '-map', `[${last}]`,
    '-r', '30',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-an',
    ...COLOR,
    work,
  ]);
} else {
  console.log('· grabación · se escala y se le quita el audio');
  warnIfSmaller(src);
  run([
    '-y', '-i', src,
    '-vf', VF,
    '-r', '30',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-an',
    ...COLOR,
    work,
  ]);
}

/* ── 2. Las dos entregas ──
   `-an` en las dos: el elemento va `muted`, así que una pista de audio serían
   bytes que nadie va a oír jamás. `+faststart` mueve el índice al principio del
   mp4 — sin él el navegador se descarga el archivo entero antes del primer
   cuadro, que es justo lo que `preload="none"` intenta evitar. */
console.log('· mp4 (H.264)');
run([
  '-y', '-i', work,
  '-c:v', 'libx264', '-crf', '23', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
  ...COLOR,
  join(OUT_DIR, `${base}.mp4`),
]);

console.log('· webm (VP9)');
run([
  '-y', '-i', work,
  /* `-pix_fmt yuv420p` NO es redundante aquí. Sin él, VP9 se queda con el
     4:4:4 del intermedio y sale un perfil 1 que varios navegadores no
     decodifican: el `<source>` webm iría primero, fallaría, y el mp4 no
     siempre lo rescata. */
  '-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0', '-row-mt', '1',
  '-pix_fmt', 'yuv420p', '-an',
  ...COLOR,
  join(OUT_DIR, `${base}.webm`),
]);

/* ── 3. El póster ──
   Del intermedio, no del mp4 ya comprimido. Sale de la MITAD del clip a
   propósito: el primer cuadro de una grabación suele ser una pantalla a medio
   pintar, y el póster es lo que ve todo el que no llega a reproducir. */
console.log('· póster (webp)');
/* `duration` no existe como constante dentro de `select`, así que el punto
   medio se calcula aquí y se le pasa a `-ss`. De paso el salto es directo, sin
   decodificar el clip entero para tirar todos los cuadros menos uno. */
const seconds = Number(
  execFileSync(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', work,
  ])
    .toString()
    .trim(),
);
run([
  '-y', '-ss', (seconds / 2).toFixed(2), '-i', work,
  '-frames:v', '1', '-q:v', '80',
  join(OUT_DIR, `${base}.webp`),
]);

rmSync(work, { force: true });

const probe = execFileSync(FFPROBE, [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
  join(OUT_DIR, `${base}.mp4`),
])
  .toString()
  .trim();

/* Lo que se imprime al final es lo que hay que copiar a `product-content.ts`.
   Las medidas salen del archivo REAL, no de lo que este script pretendía
   producir: son las que evitan que la banda salte al cargar, y a mano acaban
   siendo las de otra toma. */
const [w, h] = probe.split(',');
const sizes = ['mp4', 'webm', 'webp']
  .map((ext) => `${ext} ${(statSync(join(OUT_DIR, `${base}.${ext}`)).size / 1024).toFixed(0)} KB`)
  .join(' · ');

console.log(`\n  ${sizes}\n`);
/* La fecha, en HORA LOCAL. `toISOString()` da UTC, y grabando de tarde en
   México eso adelanta el día: el clip diría que se grabó mañana. */
const today = new Date();
const recordedAt = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');

console.log(`  clip: { base: '${base}', width: ${w}, height: ${h}, recordedAt: '${recordedAt}', alt: '…' },\n`);
