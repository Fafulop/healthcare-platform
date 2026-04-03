"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  FolderOpen,
  User,
  Briefcase,
  BookOpen,
} from "lucide-react";
import { TabNav } from "./_components/TabNav";
import { CitasGuide } from "./_components/CitasGuide";
import { ExpedientesGuide } from "./_components/ExpedientesGuide";

const TABS = [
  {
    id: "citas",
    label: "Citas",
    icon: <CalendarDays className="w-4 h-4" />,
  },
  {
    id: "expedientes",
    label: "Expedientes",
    icon: <FolderOpen className="w-4 h-4" />,
  },
  {
    id: "perfil",
    label: "Perfil & Contenido",
    icon: <User className="w-4 h-4" />,
    disabled: true,
  },
  {
    id: "practica",
    label: "Gestión de Práctica",
    icon: <Briefcase className="w-4 h-4" />,
    disabled: true,
  },
];

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 bg-gray-100 rounded-2xl mb-4">
        <BookOpen className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-base font-semibold text-gray-700">
        Guía de {label}
      </p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        Esta sección de ayuda estará disponible próximamente.
      </p>
    </div>
  );
}

function AyudaContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return TABS.find((t) => t.id === tab && !t.disabled) ? tab! : "citas";
  });

  const activeTabData = TABS.find((t) => t.id === activeTab);

  return (
    <>
      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div className="mt-5">
        {activeTab === "citas" && <CitasGuide />}
        {activeTab === "expedientes" && <ExpedientesGuide />}
        {activeTab !== "citas" && activeTab !== "expedientes" && activeTabData && (
          <ComingSoonTab label={activeTabData.label} />
        )}
      </div>
    </>
  );
}

export default function AyudaPage() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Centro de ayuda
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Guías de flujos de trabajo para cada sección de tu plataforma.
        </p>
      </div>
      <Suspense fallback={null}>
        <AyudaContent />
      </Suspense>
    </div>
  );
}
