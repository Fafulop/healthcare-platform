import { Suspense } from "react";
import { cargarManual } from "@/lib/ayuda/manual";
import { manualEnPestanas } from "@/lib/ayuda/manual-html";
import { cargarGuias, pestanaDeFlujos } from "@/lib/ayuda/guias";
import { AyudaPestanas } from "./_components/AyudaPestanas";

// Ayuda H1 (2026-10-01): la página ES el manual del doctor (`lib/ayuda/manual-del-doctor.md`), el mismo
// que lee el widget «?». Una pestaña por menú; lo que el manual aún no cubre no tiene pestaña.
// H3 (2026-10-05): primero la pestaña «Flujos» — las guías paso a paso de `lib/ayuda/guias/`.
export default function AyudaPage() {
  const manual = manualEnPestanas(cargarManual().texto);
  const flujos = pestanaDeFlujos(cargarGuias());
  if (flujos) {
    manual.pestanas.unshift(flujos);
    for (const s of flujos.secciones) manual.pestanaDe[s.id] = flujos.id;
  }
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Centro de ayuda</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Cómo se usa cada sección de tu plataforma. También puedes preguntarle al botón «?» de abajo a la derecha.
        </p>
      </div>
      <Suspense fallback={null}>
        <AyudaPestanas manual={manual} />
      </Suspense>
    </div>
  );
}
