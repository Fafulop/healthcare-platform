"use client";

import { useState } from "react";
import {
  Search,
  ShieldCheck,
  BadgeCheck,
  FileText,
  ExternalLink,
  Info,
  ChevronRight,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  MapPin,
  Ban,
  ClipboardCheck,
} from "lucide-react";

/**
 * Guía operativa para verificar a mano si un doctor está titulado y certificado.
 *
 * Todo lo que aquí se describe se hace MANUALMENTE en los portales públicos.
 * No hay API: el buscador del RNP exige un token de reCAPTCHA por petición,
 * es decir, está deliberadamente cerrado a la automatización (ver sección 7).
 */

const RNP_URL = "https://cedulaprofesional.sep.gob.mx/cedula/";
const RNP_CERTIFICACIONES_URL =
  "https://cedulaprofesional.sep.gob.mx/cedula-profesional/certificaciones";
const RNP_CONSTANCIAS_URL =
  "https://cedulaprofesional.sep.gob.mx/cedula-profesional/constancias-emitidas";
const CONACEM_BUSCADOR_URL = "https://conacem.org.mx/buscador";
const CONACEM_CATALOGO_URL = "https://conacem.org.mx/catalogo-consejos";

/** Los 47 consejos avalados por CONACEM (catálogo público, consultado 2026-08-20). */
const CONSEJOS = [
  "Consejo Mexicano de Angiología",
  "Consejo Mexicano de Cardiología",
  "Consejo Mexicano de Certificación en Infectología",
  "Consejo Mexicano de Certificación en Medicina Familiar",
  "Consejo Mexicano de Certificación en Pediatría",
  "Consejo Mexicano de Certificación en Radioterapia",
  "Consejo Mexicano de Cirugía General",
  "Consejo Mexicano de Cirugía Neurológica",
  "Consejo Mexicano de Cirugía Oral y Maxilofacial",
  "Consejo Mexicano de Cirugía Pediátrica",
  "Consejo Mexicano de Cirugía Plástica",
  "Consejo Mexicano de Comunicación",
  "Consejo Mexicano de Dermatología",
  "Consejo Mexicano de Endocrinología",
  "Consejo Mexicano de Especialistas en Coloproctología",
  "Consejo Mexicano de Gastroenterología",
  "Consejo Mexicano de Genética",
  "Consejo Mexicano de Geriatría",
  "Consejo Mexicano de Ginecología y Obstetricia",
  "Consejo Mexicano de Hematología",
  "Consejo Mexicano de Medicina Aeroespacial",
  "Consejo Mexicano de Medicina Crítica",
  "Consejo Mexicano de Medicina de Rehabilitación",
  "Consejo Mexicano de Medicina de Urgencias",
  "Consejo Mexicano de Medicina Interna",
  "Consejo Mexicano de Medicina Legal y Forense",
  "Consejo Mexicano de Medicina Nuclear e Imagen Molecular",
  "Consejo Mexicano de Médicos Anatomopatólogos",
  "Consejo Mexicano de Nefrología",
  "Consejo Mexicano de Neurofisiología Clínica",
  "Consejo Mexicano de Neurología",
  "Consejo Mexicano de Oftalmología",
  "Consejo Mexicano de Oncología",
  "Consejo Mexicano de Ortopedia y Traumatología",
  "Consejo Mexicano de Otorrinolaringología y Cirugía de Cabeza y Cuello",
  "Consejo Mexicano de Patología Clínica y Medicina de Laboratorio",
  "Consejo Mexicano de Psiquiatría",
  "Consejo Mexicano de Radiología e Imagen",
  "Consejo Mexicano de Reumatología",
  "Consejo Nacional de Certificación en Anestesiología",
  "Consejo Nacional de Cirugía del Tórax",
  "Consejo Nacional de Inmunología Clínica y Alergia",
  "Consejo Nacional de Medicina del Deporte",
  "Consejo Nacional de Neumología",
  "Consejo Nacional de Salud Pública",
  "Consejo Nacional Mexicano de Medicina del Trabajo",
  "Consejo Nacional Mexicano de Urología",
];

/** Estados con padrón propio de cédulas, enlazados desde el propio portal de la SEP. */
const PADRONES_ESTATALES = [
  { estado: "Aguascalientes", url: "https://ieasis.iea.edu.mx/", nota: "IEA" },
  {
    estado: "Chihuahua",
    url: "https://educacion.chihuahua.gob.mx/cedulas/",
    nota: "Secretaría de Educación",
  },
  {
    estado: "Coahuila",
    url: "https://web.seducoahuila.gob.mx/profesiones/pidecedula.php",
    nota: "SEDU",
  },
  {
    estado: "Guanajuato",
    url: "https://padrondeprofesionistascolegiados.seg.guanajuato.gob.mx/colegiados.aspx",
    nota: "Padrón de profesionistas colegiados",
  },
  {
    estado: "Hidalgo",
    url: "http://profesiones.seph.gob.mx/padronregistroestatal.php",
    nota: "SEPH",
  },
  {
    estado: "Michoacán",
    url: "http://www.edumich.gob.mx/cedulas/index.php/PadronPublicoController/",
    nota: "SEE",
  },
  { estado: "Querétaro", url: "https://www.verificadorsedeq.mx/", nota: "SEDEQ" },
  { estado: "Sonora", url: "https://cedulasonora.sec.gob.mx/", nota: "SEC" },
];

export default function CertificacionMedicaGuide() {
  return (
    <div className="space-y-8">

      {/* ── 0. PARA QUÉ SIRVE ─────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Para qué sirve esta guía</h2>
        </div>

        <p className="text-gray-600 leading-relaxed">
          Antes de dar de alta a un doctor —o cuando alguien reporta a uno— hay que poder
          responder dos preguntas distintas: <strong>¿tiene permiso legal de ejercer?</strong> y{" "}
          <strong>¿su especialidad está respaldada y sigue vigente?</strong> Las dos se contestan
          gratis, en portales públicos, sin cuenta y sin trámite. Esta guía es el procedimiento
          exacto: qué abrir, en qué orden, qué copiar y cómo interpretar lo que sale.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            Todo esto es <strong>manual</strong>. La plataforma no verifica nada de forma
            automática y no debe presentarse ningún doctor como &laquo;verificado&raquo; sin que
            una persona haya seguido estos pasos.
          </p>
        </div>
      </section>

      {/* ── 1. CÉDULA ≠ CERTIFICACIÓN ─────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <BadgeCheck className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Cédula ≠ certificación (la distinción que sostiene todo lo demás)
          </h2>
        </div>

        <p className="text-gray-600 leading-relaxed">
          En México se confunden todo el tiempo, pero son cosas separadas, las emiten
          instituciones distintas y responden preguntas distintas. Un doctor puede tener cédula y
          no estar certificado; eso no es ilegal, pero sí es información relevante.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-blue-900">Cédula profesional</p>
            <p className="text-sm text-blue-800">
              El permiso <strong>legal</strong> para ejercer. La emite la Dirección General de
              Profesiones (SEP).
            </p>
            <ul className="text-sm text-blue-700 space-y-1 pt-1">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>No vence nunca.</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Cada estudio tiene la suya: la licenciatura una,{" "}
                  <strong>cada especialidad otra</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Si no la tiene, está ejerciendo sin acreditación legal.</span>
              </li>
            </ul>
          </div>

          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-emerald-900">Certificación del consejo</p>
            <p className="text-sm text-emerald-800">
              El sello de <strong>calidad y actualización</strong>. La emite el consejo de la
              especialidad, avalado por CONACEM.
            </p>
            <ul className="text-sm text-emerald-700 space-y-1 pt-1">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>Vence a los 5 años</strong> y hay que recertificarse.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Por eso aquí lo que importa no es que exista, sino que esté{" "}
                  <strong>vigente</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>No tenerla no es ilegal; sí es una señal para preguntar.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
          <Clock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600">
            <strong>Consecuencia práctica:</strong> una verificación no caduca igual en los dos
            lados. La cédula se comprueba una vez y ya. La certificación hay que volver a
            revisarla, porque el certificado que hoy está vigente puede no estarlo en dos años.
          </p>
        </div>
      </section>

      {/* ── 2. LOS TRES REQUISITOS ────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Los tres requisitos de un especialista
          </h2>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">
          Es la propia Dirección General de Profesiones la que enumera qué debe tener un
          especialista. Son <strong>tres documentos, no uno</strong>, y es justo el segundo el que
          casi nadie pide:
        </p>

        <ol className="space-y-3">
          {[
            {
              n: 1,
              title: "Cédula profesional de médico general",
              detail:
                "La de la licenciatura (Médico Cirujano o equivalente), emitida por la DGP.",
            },
            {
              n: 2,
              title: "Cédula profesional de la especialidad",
              detail:
                "Un registro SEPARADO, con su propio número, también emitido por la DGP. Es el documento que distingue a un especialista real de alguien que sólo dice serlo.",
            },
            {
              n: 3,
              title: "Certificado VIGENTE del consejo de la especialidad",
              detail:
                "Emitido por el consejo correspondiente y reconocido por CONACEM. La palabra que importa es «vigente»: vence a los 5 años.",
            },
          ].map(({ n, title, detail }) => (
            <li key={n} className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {n}
              </span>
              <div>
                <p className="font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 3. PROCEDIMIENTO ──────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Procedimiento paso a paso</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              n: 1,
              title: "Pídele al doctor su CURP",
              body: (
                <span>
                  Suena de más, pero es el paso que ahorra todo el trabajo: la consulta de
                  certificaciones del RNP está indexada <strong>por CURP</strong>, no por nombre.
                  Con CURP la verificación son dos minutos; sin CURP hay que buscar por nombre y
                  desambiguar homónimos a mano.
                </span>
              ),
            },
            {
              n: 2,
              title: "Busca sus cédulas en el Registro Nacional de Profesionistas",
              body: (
                <span>
                  Abre{" "}
                  <a
                    href={RNP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    cedulaprofesional.sep.gob.mx
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  . Tiene dos modos: por <strong>número de cédula</strong> (7 u 8 dígitos) o
                  búsqueda avanzada por <strong>nombre y apellidos</strong> o{" "}
                  <strong>CURP</strong>. Buscar por CURP es lo mejor: devuelve de golpe todas las
                  cédulas de esa persona. Los resultados se pueden exportar a CSV desde la misma
                  página.
                </span>
              ),
            },
            {
              n: 3,
              title: "Cuenta las filas — aquí está el truco",
              body: (
                <span>
                  El RNP devuelve <strong>una fila por cédula</strong>, no una por persona. Un
                  cardiólogo de verdad tiene <strong>al menos dos</strong>: «Médico Cirujano»
                  (licenciatura) y «Cardiología» (especialidad), con números distintos. Si sólo
                  aparece la licenciatura, <em>la especialidad no está registrada ante la SEP</em>.
                  Las subespecialidades registradas también aparecen como su propia fila.
                </span>
              ),
            },
            {
              n: 4,
              title: "Revisa la vigencia de la certificación",
              body: (
                <span>
                  En el mismo portal, la sección{" "}
                  <a
                    href={RNP_CERTIFICACIONES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    Certificaciones
                    <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  se alimenta de los datos de CONACEM y <strong>requiere la CURP</strong>. Es la
                  consulta que dice si el certificado del consejo sigue vigente.
                </span>
              ),
            },
            {
              n: 5,
              title: "Si no tienes CURP, usa el buscador de CONACEM",
              body: (
                <span>
                  El{" "}
                  <a
                    href={CONACEM_BUSCADOR_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    buscador de médicos de CONACEM
                    <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  busca por <strong>nombre + especialidad + consejo</strong>. Es la alternativa
                  cuando sólo tienes el nombre. Ojo: cubre la certificación, no las cédulas — no
                  sustituye al paso 2.
                </span>
              ),
            },
            {
              n: 6,
              title: "Cierra con la Constancia de Situación Profesional",
              body: (
                <span>
                  Es el mejor documento de todos y <strong>es gratis</strong>. El propio doctor la
                  genera desde el RNP con su CURP y sale un PDF oficial con todas sus cédulas.
                  Nosotros validamos el <strong>folio</strong> en{" "}
                  <a
                    href={RNP_CONSTANCIAS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    Constancias emitidas
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  . Así no dependemos de haber buscado bien: el doctor entrega algo comprobable.
                  <br />
                  <span className="text-amber-700">
                    Advertencia: si el doctor no ha hecho la «vinculación de CURP» ante la SEP, la
                    constancia sale <strong>incompleta</strong> — puede faltarle justo la
                    especialidad. Si se ve incompleta, pídele que haga la vinculación y la vuelva
                    a generar.
                  </span>
                </span>
              ),
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {n}
              </span>
              <div>
                <p className="font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. CONSEJOS ───────────────────────────────────────── */}
      <ConsejosSection />

      {/* ── 5. TRAMPAS ────────────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Trampas y casos borde</h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">
            <strong>
              La regla más importante: «no aparece» no significa «es falso».
            </strong>{" "}
            Hay razones legítimas para no salir en el registro (ver abajo). Un resultado vacío se
            documenta como <strong>«no verificable»</strong> y se le pregunta al doctor — nunca se
            registra ni se comunica como fraude.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              icon: MapPin,
              title: "Cédulas estatales",
              body: "Varios estados emiten su propia cédula, invisible en el registro federal. Un doctor con cédula sólo estatal se ve «no registrado» en el RNP y sí está acreditado. Los padrones estatales están abajo.",
            },
            {
              icon: Ban,
              title: "Médicos generales: no hay directorio público",
              body: "A los generales los certifica CONAMEGE / el Consejo Nacional de Certificación en Medicina General, pero no publican un buscador. De un médico general sólo se puede verificar la cédula de licenciatura; su certificación hay que pedírsela en documento.",
            },
            {
              icon: AlertTriangle,
              title: "Cirugía plástica y estética: revisión reforzada",
              body: "Es la especialidad con más suplantación y la SEP le hizo un validador propio. Aquí se exigen los tres requisitos completos y el certificado del Consejo Mexicano de Cirugía Plástica, Estética y Reconstructiva. No se da por buena con la cédula de médico general.",
            },
            {
              icon: Info,
              title: "Especialidad cursada en el extranjero",
              body: "Puede ser real y no estar en el RNP si no revalidó ante la SEP. Se pide el documento y, si aplica, la revalidación. Se marca como no verificable en línea.",
            },
            {
              icon: Info,
              title: "La DGP no registra títulos, sólo cédulas",
              body: "El registro del título lo hace la institución educativa que lo expide. Si el problema es el título, el interlocutor es la universidad, no la SEP.",
            },
            {
              icon: Info,
              title: "Homónimos",
              body: "Buscando por nombre salen varias personas distintas con el mismo nombre. Sin CURP no hay forma segura de desambiguar: hay que cruzar institución y año de egreso con lo que declaró el doctor, o pedirle la CURP.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-3 border border-gray-200 rounded-lg p-3"
            >
              <Icon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Padrones estatales */}
        <div className="pt-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Padrones estatales de cédulas (enlazados desde el propio portal de la SEP)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PADRONES_ESTATALES.map(({ estado, url, nota }) => (
              <a
                key={estado}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
              >
                <span className="text-sm">
                  <span className="font-medium text-gray-900">{estado}</span>{" "}
                  <span className="text-gray-400 text-xs">· {nota}</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            No es la lista de todos los estados: son los que la SEP enlaza desde su portal. Si un
            doctor dice tener cédula estatal de otro estado, hay que buscar la secretaría de
            educación correspondiente.
          </p>
        </div>
      </section>

      {/* ── 6. QUÉ ANOTAR ─────────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Qué anotar al terminar</h2>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">
          La verificación sirve de poco si no queda registrado <em>qué</em> se comprobó y{" "}
          <em>cuándo</em>. Deja constancia de estos datos:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Dato</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
                  De dónde sale
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["Cédula de licenciatura (número)", "RNP · fila de la licenciatura"],
                [
                  "Cédula de especialidad (número)",
                  "RNP · fila de la especialidad — si no hay, se anota «sin registro»",
                ],
                ["Institución y año de egreso", "RNP · sirve para desambiguar homónimos"],
                ["Consejo que lo certifica", "Catálogo de consejos (sección de arriba)"],
                ["Estado de la certificación", "Vigente / vencida / no encontrada"],
                ["Folio de la constancia", "Constancia de Situación Profesional, si la entregó"],
                ["Fecha de la verificación y quién la hizo", "Tú, el día que la hiciste"],
              ].map(([dato, fuente]) => (
                <tr key={dato} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{dato}</td>
                  <td className="px-4 py-3 text-gray-600">{fuente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            «No verificado todavía» y «verificado y no se encontró» son estados{" "}
            <strong>distintos</strong>. Si se anotan igual, después nadie sabe si el hueco es
            trabajo pendiente o un hallazgo.
          </p>
        </div>
      </section>

      {/* ── 7. NO HAY API ─────────────────────────────────────── */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
            <Ban className="w-5 h-5 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Por qué esto es manual y no automático
          </h2>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">
          No existe una API pública. El buscador del RNP exige, además de autenticación, un{" "}
          <strong>token de reCAPTCHA en cada consulta</strong>: está diseñado a propósito para que
          no se pueda consultar en masa. Lo único abierto son descargas de datos abiertos de
          títulos electrónicos por año, que <em>no</em> contienen el padrón de cédulas.
        </p>

        <p className="text-gray-600 text-sm leading-relaxed">
          Por eso el camino sostenible es el del paso 6:{" "}
          <strong>que el doctor entregue su Constancia</strong> y nosotros validemos el folio. No
          se debe intentar automatizar el buscador.
        </p>
      </section>

      {/* ── 8. ENLACES DIRECTOS ───────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-3 pb-4">
        <a
          href={RNP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
        >
          <Search className="w-4 h-4" />
          Buscar cédula en el RNP
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={CONACEM_BUSCADOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
        >
          <BadgeCheck className="w-4 h-4" />
          Buscador CONACEM
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

/** Catálogo filtrable de los 47 consejos avalados por CONACEM. */
function ConsejosSection() {
  const [filtro, setFiltro] = useState("");

  const termino = filtro.trim().toLowerCase();
  const visibles = termino
    ? CONSEJOS.filter((c) => c.toLowerCase().includes(termino))
    : CONSEJOS;

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
          <BadgeCheck className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          Los {CONSEJOS.length} consejos avalados por CONACEM
        </h2>
      </div>

      <p className="text-gray-600 text-sm leading-relaxed">
        Sirve para saber <strong>qué consejo</strong> debería certificar la especialidad que
        declara el doctor. Si dice ser especialista en algo que no corresponde a ninguno de estos,
        o nombra un «consejo» que no está en la lista, es una señal de alerta que hay que
        preguntar.
      </p>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por especialidad — ej. cardio, gineco, urol…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {visibles.length === 0 ? (
        <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4 text-center">
          Ningún consejo coincide con «{filtro}». Ojo: que no aparezca aquí no quiere decir que la
          especialidad no exista — puede ser una subespecialidad, que cuelga de uno de los
          consejos troncales. Consulta el{" "}
          <a
            href={CONACEM_CATALOGO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            catálogo completo de CONACEM
          </a>
          .
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {visibles.map((consejo) => (
            <li key={consejo} className="flex items-start gap-2 text-sm text-gray-700">
              <ChevronRight className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              <span>{consejo}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400">
        Además de estas especialidades troncales, CONACEM reconoce subespecialidades que se
        certifican a través del mismo consejo troncal. Catálogo consultado el 20 de agosto de 2026
        en{" "}
        <a
          href={CONACEM_CATALOGO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          conacem.org.mx/catalogo-consejos
        </a>
        .
      </p>
    </section>
  );
}
