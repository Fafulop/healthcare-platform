"use client";

/**
 * /dashboard/medical-records/receta — el formato del PDF de la receta.
 *
 * Vivía como una pestaña de «Editar Perfil» (2026-09-20). No es perfil: es
 * cómo sale impresa una receta, así que pertenece al expediente, junto a las
 * plantillas y a los pacientes.
 *
 * 🔴 SÓLO EL DUEÑO, y no por costumbre: aquí viven la FIRMA y la CÉDULA del
 * doctor, que es lo que hace legalmente vinculante una receta (NUEVOS USUARIOS
 * 00-REQUISITOS §3.4/§3.5). Por eso era un OWNER_ONLY_TAB, y por eso la ruta
 * entra al route map como `OWNER_ONLY` — su página madre, `medical-records`,
 * la abre cualquier member con el toggle `expedientes`, así que heredar de ella
 * habría ABIERTO la firma del doctor a sus auxiliares.
 *
 * El candado de verdad es el de la API; esto evita enseñar una pantalla que
 * terminaría en 403 (mismo criterio que el botón «Importar» de la lista).
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, ShieldOff } from "lucide-react";
import { usePermissions } from "@/lib/permissions-client";
import PrescriptionTemplateSection, { type DisenoEnPantalla } from "@/components/profile/PrescriptionTemplateSection";
import { RecetaImpresionSection } from "@/components/profile/RecetaImpresionSection";
import { RecetaVistaPrevia } from "@/components/profile/RecetaVistaPrevia";
import type { PdfSettings } from "@/types/pdf-settings";

export default function RecetaPdfPage() {
  const { isOwner, loading } = usePermissions();
  // Lo que hay EN PANTALLA (guardado o no): de aquí dibuja la vista previa en vivo.
  const [diseno, setDiseno] = useState<DisenoEnPantalla | null>(null);
  const [impresion, setImpresion] = useState<PdfSettings | null>(null);
  const [verEnMovil, setVerEnMovil] = useState(false);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Link
        href="/dashboard/medical-records"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Expedientes Médicos
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Receta PDF</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Cómo se ve la receta que imprimes o envías a tus pacientes.
        </p>
      </div>

      {/* Mientras se leen los permisos no se pinta ninguna de las dos cosas:
          enseñar el formulario y quitarlo, o enseñar «sin acceso» y sustituirlo,
          las dos afirman algo que todavía no se sabe. */}
      {loading ? null : isOwner ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-8">
            <PrescriptionTemplateSection onCambio={setDiseno} />
            <div className="border-t border-gray-200 pt-6">
              <RecetaImpresionSection onCambio={setImpresion} />
            </div>
          </div>
          {/* En pantallas angostas la vista previa va abajo y se abre con un botón. */}
          <div>
            <button
              onClick={() => setVerEnMovil((v) => !v)}
              className="lg:hidden mb-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              {verEnMovil ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {verEnMovil ? "Ocultar receta" : "Ver receta"}
            </button>
            <div className={`${verEnMovil ? "" : "hidden"} lg:block lg:sticky lg:top-4`}>
              <RecetaVistaPrevia diseno={diseno} impresion={impresion} />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3">
          <ShieldOff className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              Esta sección es sólo del titular de la cuenta
            </p>
            <p className="text-gray-500 mt-1">
              La receta lleva la firma y la cédula del doctor, así que sólo él puede
              cambiar su formato.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
