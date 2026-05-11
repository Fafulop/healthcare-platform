"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import LoansNavTabs from "./components/LoansNavTabs";
import LoanSimulator from "./components/simulator/LoanSimulator";
import PortfolioProjection from "./components/portfolio/PortfolioProjection";
import { Banknote } from "lucide-react";

export default function LoansPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [activeTab, setActiveTab] = useState("simulator");

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

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Banknote className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Prestamos para Doctores</h1>
              <p className="text-sm text-gray-500">
                Simulador de escenarios, analisis de rentabilidad y competencia
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <LoansNavTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === "simulator" && <LoanSimulator />}

        {activeTab === "portfolio" && <PortfolioProjection />}

        {activeTab === "theory" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg font-medium mb-2">Teoria de Prestamos</p>
            <p className="text-sm">Coming in Phase 4 — French amortization, cost of funds, PD/LGD/EL, regulatory paths</p>
          </div>
        )}

        {activeTab === "competitors" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            <p className="text-lg font-medium mb-2">Analisis de Competencia</p>
            <p className="text-sm">Coming in Phase 4 — Inbursa, BBVA, Konfio, market gap analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}
