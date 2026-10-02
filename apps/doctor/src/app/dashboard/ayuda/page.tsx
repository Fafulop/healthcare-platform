import { Suspense } from "react";
import { cargarManual } from "@/lib/ayuda/manual";
import { manualEnPestanas } from "@/lib/ayuda/manual-html";
import { AyudaPestanas } from "./_components/AyudaPestanas";

// Ayuda H1 (2026-10-01): la página ES el manual del doctor (`lib/ayuda/manual-del-doctor.md`), el mismo
// que lee el widget «?». Una pestaña por menú; lo que el manual aún no cubre no tiene pestaña.
export default function AyudaPage() {
  const manual = manualEnPestanas(cargarManual().texto);
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
