"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  AlertCircle,
  Zap,
  MousePointer,
  Globe,
  TrendingUp,
  RefreshCw,
  UserPlus,
  Calendar,
  ExternalLink,
  Info,
  ChevronRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const TABS = [{ id: "search-console", label: "Instrucciones Search Console" }];

export default function GuidesPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [activeTab, setActiveTab] = useState("search-console");

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guías y Recursos</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Referencias operativas para administrar tusalud.pro
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "search-console" && <SearchConsoleGuide />}
      </div>
    </div>
  );
}

function SearchConsoleGuide() {
  return (
    <div className="space-y-8">

      {/* ── 1. QUÉ ES ─────────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">¿Qué es Google Search Console?</h2>
        </div>

        <p className="text-gray-600 leading-relaxed">
          Google Search Console (GSC) es una herramienta <strong>gratuita de Google</strong> que
          te muestra cómo Google ve tusalud.pro. No rastrea lo que los usuarios hacen dentro del
          sitio (eso es Google Analytics), sino todo lo que ocurre <em>antes</em> de que lleguen:
          qué buscaron, en qué posición aparece el sitio, cuántas veces se mostró y cuántas veces
          hicieron clic.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {[
            { icon: Search, label: "Qué busca la gente para llegar al sitio" },
            { icon: TrendingUp, label: "En qué posición aparecen las páginas en Google" },
            { icon: MousePointer, label: "Cuántos clics recibe cada página desde Google" },
            { icon: AlertCircle, label: "Errores de indexación y páginas con problemas" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-2.5 text-sm text-gray-700">
              <Icon className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. POR QUÉ IMPORTA ──────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">¿Por qué importa para tusalud.pro?</h2>
        </div>

        <p className="text-gray-600 leading-relaxed">
          tusalud.pro depende del tráfico orgánico de Google para que los pacientes encuentren a
          los doctores. Cada perfil de doctor es una página pública optimizada para SEO. Si esas
          páginas no están indexadas correctamente en Google, los pacientes simplemente no las
          encontrarán — aunque el perfil esté perfecto.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">Ejemplos concretos de lo que GSC resuelve:</p>
          <ul className="space-y-1.5 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Un doctor nuevo se crea hoy — GSC permite pedirle a Google que lo indexe en horas en lugar de semanas.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
              <span>El slug de un doctor cambia — GSC muestra si la URL vieja sigue apareciendo en Google y si el redireccionamiento funciona.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Un perfil tiene error 404 — GSC lo alerta antes de que afecte el posicionamiento del doctor.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Se puede ver qué búsquedas llevan pacientes a cada doctor (ej. "dermatologo en monterrey") para optimizar el contenido.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── 3. CÓMO INICIAR SESIÓN ──────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Cómo iniciar sesión</h2>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            Debes usar la cuenta de Google que tiene acceso como propietario de la propiedad
            <strong> https://tusalud.pro</strong>. Si no tienes acceso, pídele al propietario
            actual que te agregue como usuario en GSC → Configuración → Usuarios y permisos.
          </p>
        </div>

        <ol className="space-y-3">
          {[
            {
              step: 1,
              title: "Abre Google Search Console",
              detail: (
                <span>
                  Ve a{" "}
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    search.google.com/search-console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              ),
            },
            {
              step: 2,
              title: "Inicia sesión con Google",
              detail: "Haz clic en 'Iniciar sesión' y usa la cuenta de Google asociada a tusalud.pro.",
            },
            {
              step: 3,
              title: "Selecciona la propiedad correcta",
              detail: "En la esquina superior izquierda, en el menú desplegable, selecciona 'https://tusalud.pro'. Si ves varias propiedades, asegúrate de elegir exactamente esta.",
            },
            {
              step: 4,
              title: "Ya estás dentro",
              detail: "La pantalla de inicio muestra el rendimiento de búsqueda de los últimos 3 meses. Desde aquí accedes a todos los reportes.",
            },
          ].map(({ step, title, detail }) => (
            <li key={step} className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {step}
              </span>
              <div>
                <p className="font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 4. CÓMO FUNCIONA EN TUSALUD.PRO ──────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Cómo funciona en tusalud.pro</h2>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">
          El sitio genera automáticamente todo lo que Google necesita para indexar cada doctor.
          Aquí está el flujo completo:
        </p>

        {/* Flow diagram */}
        <div className="space-y-2 pt-1">
          {[
            {
              color: "bg-blue-600",
              label: "1. Se crea un doctor en el panel admin",
              sub: "El registro se guarda en la base de datos con un slug único (ej. dra-maria-garcia).",
            },
            {
              color: "bg-indigo-600",
              label: "2. El sitemap se actualiza automáticamente",
              sub: "tusalud.pro/sitemap.xml se regenera cada hora e incluye la nueva URL del doctor.",
            },
            {
              color: "bg-purple-600",
              label: "3. Google descubre la nueva página",
              sub: "Google lee el sitemap periódicamente y descubre las nuevas URLs. Sin solicitud manual, esto puede tardar días o semanas.",
            },
            {
              color: "bg-green-600",
              label: "4. Google indexa la página",
              sub: "Google la rastrea, analiza su contenido (título, descripción, JSON-LD del doctor) y la agrega a su índice de búsqueda.",
            },
            {
              color: "bg-emerald-600",
              label: "5. La página aparece en resultados de Google",
              sub: "Los pacientes pueden encontrar al doctor buscando su nombre, especialidad o ciudad.",
            },
          ].map(({ color, label, sub }, i, arr) => (
            <div key={label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${color} mt-1 shrink-0`} />
                {i < arr.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" />}
              </div>
              <div className="pb-3">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-800 mb-2">Lo que está configurado en el sitio:</p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> Sitemap en <code className="bg-gray-100 px-1 rounded text-xs">tusalud.pro/sitemap.xml</code> — se actualiza cada hora</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> Metadatos SEO por doctor (título, descripción, canonical URL)</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> JSON-LD (datos estructurados del doctor para resultados enriquecidos)</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> robots.txt que permite el rastreo de todas las páginas de doctores</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> Redirección 301 de www.tusalud.pro → tusalud.pro</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> Páginas de utilidad (/cancel-booking, /review) marcadas como noindex</li>
          </ul>
        </div>
      </section>

      {/* ── 5. AUTOMÁTICO vs MANUAL ──────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-teal-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Qué es automático y qué es manual</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Automático */}
          <div className="border border-green-200 rounded-lg overflow-hidden">
            <div className="bg-green-50 px-4 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">Automático — no hay que hacer nada</span>
            </div>
            <ul className="divide-y divide-gray-100 text-sm text-gray-700">
              {[
                "Sitemap actualizado cada hora con nuevos doctores",
                "Metadatos SEO generados desde la base de datos",
                "Datos estructurados (JSON-LD) incluidos en cada perfil",
                "Redirección www → no-www activa",
                "Páginas de utilidad marcadas como noindex",
                "GA4 registra visitas y eventos en cada perfil",
                "Google Ads carga el ID del doctor desde la base de datos",
              ].map((item) => (
                <li key={item} className="px-4 py-2.5 flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Manual */}
          <div className="border border-orange-200 rounded-lg overflow-hidden">
            <div className="bg-orange-50 px-4 py-2 flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">Manual — requiere acción tuya</span>
            </div>
            <ul className="divide-y divide-gray-100 text-sm text-gray-700">
              {[
                "Solicitar indexación de cada doctor nuevo en GSC",
                "Validar que correcciones de errores funcionen en GSC",
                "Revisar errores 404 cuando se elimina o cambia el slug de un doctor",
                "Revisar rendimiento de búsqueda mensualmente",
                "Monitorear Core Web Vitals mensualmente",
                "Verificar que el sitemap siga en estado 'Correcto'",
              ].map((item) => (
                <li key={item} className="px-4 py-2.5 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 6. CUANDO SE CREA UN DOCTOR NUEVO ────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Qué hacer cuando se crea un doctor nuevo</h2>
        </div>

        <p className="text-gray-600 text-sm">
          El sitio publica el perfil inmediatamente pero Google puede tardar días o semanas en
          encontrarlo solo. Este paso reduce ese tiempo a <strong>pocas horas</strong>:
        </p>

        <ol className="space-y-4">
          {[
            {
              step: 1,
              title: "Copia la URL del nuevo perfil",
              detail: "Formato: https://tusalud.pro/doctores/[slug-del-doctor]",
              highlight: false,
            },
            {
              step: 2,
              title: "Abre GSC e ingresa la URL en la barra de inspección",
              detail: "En la parte superior de cualquier pantalla de GSC hay una barra de búsqueda. Pega la URL ahí y presiona Enter.",
              highlight: false,
            },
            {
              step: 3,
              title: "Haz clic en 'Solicitar indexación'",
              detail: "GSC verificará primero si la página es accesible y luego enviará la solicitud a Google. El botón puede tardarse unos segundos en aparecer.",
              highlight: true,
            },
            {
              step: 4,
              title: "Listo — Google la indexará en horas",
              detail: "Recibirás confirmación en pantalla. No necesitas hacer nada más. En pocas horas la página aparecerá en los resultados de Google.",
              highlight: false,
            },
          ].map(({ step, title, detail, highlight }) => (
            <li
              key={step}
              className={`flex items-start gap-4 p-3 rounded-lg ${highlight ? "bg-blue-50 border border-blue-200" : ""}`}
            >
              <span
                className={`w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0 ${highlight ? "bg-blue-600" : "bg-gray-400"}`}
              >
                {step}
              </span>
              <div>
                <p className="font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            GSC tiene un límite de solicitudes de indexación diarias. Si en un mismo día creas
            muchos doctores, da prioridad a los más importantes y deja que el sitemap automático
            se encargue del resto en los días siguientes.
          </p>
        </div>
      </section>

      {/* ── 7. MANTENIMIENTO MENSUAL ─────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Checklist de mantenimiento mensual</h2>
        </div>

        <p className="text-gray-500 text-sm">15 minutos al mes es suficiente para mantener todo en orden.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Qué revisar</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Dónde en GSC</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Qué buscar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                {
                  check: "Rendimiento de búsqueda",
                  where: "Rendimiento → Resultados de búsqueda",
                  look: "¿Crecen impresiones y clics vs el mes anterior? Una caída brusca indica un problema.",
                },
                {
                  check: "Errores de indexación",
                  where: "Indexación → Páginas → pestaña Error",
                  look: "Debe estar vacío. Cualquier URL en error significa que Google no puede indexar esa página.",
                },
                {
                  check: "Páginas no encontradas (404)",
                  where: "Indexación → Páginas → No encontrada (404)",
                  look: "Si aparecen URLs de doctores que ya no existen, agregar redirecciones en el código.",
                },
                {
                  check: "Estado del sitemap",
                  where: "Indexación → Sitemaps",
                  look: "Debe mostrar 'Correcto'. Si dice error, el sitemap no se puede leer y Google no descubrirá nuevas páginas.",
                },
                {
                  check: "Core Web Vitals",
                  where: "Experiencia → Core Web Vitals",
                  look: "Páginas en 'Deficiente' afectan el posicionamiento. Reportar al equipo técnico si aparecen.",
                },
              ].map((row) => (
                <tr key={row.check} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.check}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.where}</td>
                  <td className="px-4 py-3 text-gray-600">{row.look}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 8. ENLACE DIRECTO ─────────────────────────────────── */}
      <div className="flex justify-center pb-4">
        <a
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
        >
          <Search className="w-4 h-4" />
          Abrir Google Search Console
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

    </div>
  );
}
