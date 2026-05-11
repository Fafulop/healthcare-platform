"use client";

import { useState } from "react";
import type { LoanParams, LoanProfitResult } from "../../lib/types";
import { formatMXN, formatPct } from "../../lib/loan-math";
import { MARKET } from "../../lib/constants";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface Props {
  result: LoanProfitResult;
  params: LoanParams;
}

export default function CostWaterfall({ result, params }: Props) {
  const [showExplainer, setShowExplainer] = useState(true);
  const data = [
    { name: "Intereses", value: result.totalInterest, color: "#2563eb" },
    { name: "Comision", value: result.originationFee, color: "#3b82f6" },
    { name: "Costo Fondeo", value: -result.cofTotal, color: "#ef4444" },
    { name: "Provisiones", value: -result.provisionAmount, color: "#f97316" },
    { name: "OpEx", value: -result.opExTotal, color: "#eab308" },
    { name: "Utilidad", value: result.netProfit, color: result.netProfit >= 0 ? "#22c55e" : "#ef4444" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Desglose de Costos e Ingresos</h3>
      </div>

      {/* Summary Cards — Row 1: Core */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 pb-2">
        <SummaryCard
          label="Pago Mensual"
          value={formatMXN(result.monthlyPayment)}
          sublabel="Lo que paga el doctor"
          color="text-gray-900"
        />
        <SummaryCard
          label="Ingreso Bruto"
          value={formatMXN(result.grossRevenue)}
          sublabel={`Intereses + comision`}
          color="text-blue-600"
        />
        <SummaryCard
          label="Costos Totales"
          value={formatMXN(result.totalCosts)}
          sublabel={`CoF + prov + OpEx`}
          color="text-red-600"
        />
        <SummaryCard
          label="Utilidad Neta"
          value={formatMXN(result.netProfit)}
          sublabel={`${formatPct(result.profitMargin)} margen`}
          color={result.netProfit >= 0 ? "text-green-600" : "text-red-600"}
        />
        <SummaryCard
          label="TIR (IRR)"
          value={formatPct(result.irr)}
          sublabel="Retorno real anualizado"
          color="text-purple-600"
        />
      </div>
      {/* Summary Cards — Row 2: Advanced */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
        <SummaryCard
          label="MOIC"
          value={`${result.moic.toFixed(2)}x`}
          sublabel="Pesos recibidos / invertidos"
          color="text-indigo-600"
        />
        <SummaryCard
          label="Spread"
          value={formatPct(result.spread)}
          sublabel={`${formatPct(params.annualRate)} tasa - ${formatPct(params.cofRate)} CoF`}
          color="text-teal-600"
        />
        <SummaryCard
          label="NIM"
          value={formatPct(result.nim)}
          sublabel="Margen de interes neto"
          color="text-amber-600"
        />
        <SummaryCard
          label="ROI Simple"
          value={formatPct(result.annualizedROI)}
          sublabel={`${formatMXN(result.monthlyProfit)}/mes`}
          color="text-gray-600"
        />
      </div>

      {/* Waterfall Chart */}
      <div className="px-4 pb-4" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value) => [formatMXN(Math.abs(Number(value))), ""]}
              labelFormatter={(label) => String(label)}
            />
            <ReferenceLine y={0} stroke="#374151" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Explainer Table */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 hover:text-blue-600 transition"
        >
          {showExplainer ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <HelpCircle className="w-4 h-4" />
          Como se calcula cada numero
        </button>

        {showExplainer && (
          <div className="space-y-1">
            {/* ── REVENUE ── */}
            <ExplainerSection title="INGRESOS" color="blue">
              <ExplainerRow
                label="Pago Mensual"
                value={result.monthlyPayment}
                positive
                concept="Cuota fija que paga el doctor cada mes durante todo el plazo. Incluye una parte de capital (devolver lo prestado) y una parte de intereses (el costo por usar el dinero)."
                formula={`Se usa la formula de amortizacion francesa (pagos iguales):\nPMT = Principal x r x (1+r)^n / ((1+r)^n - 1)\n= ${formatMXN(params.principal)} x ${(params.annualRate / 12 * 100).toFixed(2)}% x (1+${(params.annualRate / 12 * 100).toFixed(2)}%)^${params.termMonths} / ((1+${(params.annualRate / 12 * 100).toFixed(2)}%)^${params.termMonths} - 1)`}
              />
              <ExplainerRow
                label="Ingreso por Intereses"
                value={result.totalInterest}
                positive
                concept="Total de intereses que el doctor paga durante toda la vida del prestamo. Al inicio, la mayor parte de cada pago son intereses; al final, casi todo es capital."
                formula={`Suma de la porcion de intereses de los ${params.termMonths} pagos mensuales.\nCada mes: Interes = Saldo pendiente x Tasa mensual (${formatPct(params.annualRate)} anual / 12 = ${(params.annualRate / 12 * 100).toFixed(2)}% mensual)\nMes 1: ${formatMXN(params.principal)} x ${(params.annualRate / 12 * 100).toFixed(2)}% = ${formatMXN(params.principal * params.annualRate / 12)}\nComo el saldo baja cada mes, los intereses tambien bajan.`}
              />
              <ExplainerRow
                label="Comision de Apertura"
                value={result.originationFee}
                positive
                concept="Cobro unico al momento de dar el prestamo. Cubre costos administrativos de evaluacion y desembolso. Se le suma IVA (16%)."
                formula={`Principal x Tasa de comision x (1 + IVA)\n= ${formatMXN(params.principal)} x ${formatPct(params.originationFeeRate)} x 1.${(MARKET.ivaRate * 100).toFixed(0)}\n= ${formatMXN(params.principal * params.originationFeeRate)} + ${formatMXN(params.principal * params.originationFeeRate * MARKET.ivaRate)} IVA = ${formatMXN(result.originationFee)}`}
              />
              <TotalRow label="= Ingreso Bruto" value={result.grossRevenue} color="text-blue-600" />
            </ExplainerSection>

            {/* ── COSTS ── */}
            <ExplainerSection title="COSTOS" color="red">
              <ExplainerRow
                label="Costo de Fondeo (CoF)"
                value={result.cofTotal}
                concept="El dinero que prestamos no es gratis — tiene un costo. Si lo pedimos a un inversionista, le pagamos un rendimiento. Si es capital propio, dejamos de ganar lo que daria en CETES. Este costo se calcula sobre el saldo promedio que teniamos prestado durante cada ano — NO el saldo final, sino el promedio de los 12 saldos mensuales (porque al inicio del ano debiamos mas y al final menos)."
                formula={`El "saldo promedio" es el promedio de los 12 saldos iniciales de cada mes del ano.\nPor ejemplo, Ano 1: (${formatMXN(params.principal)} mes 1 + ... + saldo mes 12) / 12\n\nAno 1: Saldo promedio = ${formatMXN(result.yearSummaries[0]?.avgOutstanding ?? 0)}\n  → ${formatMXN(result.yearSummaries[0]?.avgOutstanding ?? 0)} x ${formatPct(params.cofRate)} = ${formatMXN(result.cofBreakdown.year1)}${result.yearSummaries[1] ? `\nAno 2: Saldo promedio = ${formatMXN(result.yearSummaries[1]?.avgOutstanding ?? 0)}\n  → ${formatMXN(result.yearSummaries[1]?.avgOutstanding ?? 0)} x ${formatPct(params.cofRate)} = ${formatMXN(result.cofBreakdown.year2)}` : ""}${result.cofBreakdown.year3 > 0 && result.yearSummaries[2] ? `\nAno 3: Saldo promedio = ${formatMXN(result.yearSummaries[2]?.avgOutstanding ?? 0)}\n  → ${formatMXN(result.yearSummaries[2]?.avgOutstanding ?? 0)} x ${formatPct(params.cofRate)} = ${formatMXN(result.cofBreakdown.year3)}` : ""}\n\nTotal CoF = ${formatMXN(result.cofTotal)}`}
              />
              <ExplainerRow
                label="Provision por Perdidas"
                value={result.provisionAmount}
                concept={`Reserva de dinero por si el doctor no paga. No es una perdida real todavia — es un "colchon" que apartamos basado en la probabilidad de que no pague (PD = ${formatPct(params.defaultRate)}) y cuanto perderiamos si eso pasa (LGD = ${formatPct(1 - params.recoveryRate)}).`}
                formula={`Principal x Probabilidad de Default x Perdida en Default\n= ${formatMXN(params.principal)} x ${formatPct(params.defaultRate)} PD x ${formatPct(1 - params.recoveryRate)} LGD\n= ${formatMXN(params.principal)} x ${formatPct(params.defaultRate)} x (1 - ${formatPct(params.recoveryRate)} recuperacion)\n= ${formatMXN(result.provisionAmount)}`}
              />
              <ExplainerRow
                label="Gastos Operativos"
                value={result.opExTotal}
                concept="Costos reales de operar el prestamo: evaluar al doctor, procesar documentos, dar seguimiento a pagos, sistemas, personal."
                formula={`Costo de originacion + (Servicio anual x Plazo en anos)\n= ${formatMXN(params.originationCost)} + (${formatMXN(params.annualServicingCost)} x ${(params.termMonths / 12).toFixed(1)} anos)\n= ${formatMXN(params.originationCost)} + ${formatMXN(params.annualServicingCost * params.termMonths / 12)} = ${formatMXN(result.opExTotal)}`}
              />
              <TotalRow label="= Costos Totales" value={result.totalCosts} color="text-red-600" />
            </ExplainerSection>

            {/* ── PROFIT ── */}
            <ExplainerSection title="RESULTADO" color="green">
              <ExplainerRow
                label="Utilidad Neta"
                value={result.netProfit}
                positive={result.netProfit >= 0}
                concept="Lo que realmente nos queda despues de cobrar todo y pagar todo. Es la ganancia (o perdida) por este prestamo individual."
                formula={`Ingreso Bruto - Costos Totales\n= ${formatMXN(result.grossRevenue)} - ${formatMXN(result.totalCosts)} = ${formatMXN(result.netProfit)}`}
              />
              <ExplainerRow
                label="Margen de Utilidad"
                value={null}
                displayValue={formatPct(result.profitMargin)}
                concept="Que porcentaje de cada peso que ingresa es ganancia. Un margen de 40%+ es muy saludable para prestamos."
                formula={`Utilidad Neta / Ingreso Bruto x 100\n= ${formatMXN(result.netProfit)} / ${formatMXN(result.grossRevenue)} = ${formatPct(result.profitMargin)}`}
              />
              <ExplainerRow
                label="TIR (Tasa Interna de Retorno)"
                value={null}
                displayValue={formatPct(result.irr)}
                concept={'LA metrica mas importante para inversionistas. A diferencia del ROI simple, la TIR considera CUANDO recibes el dinero. Si prestas $200K y recibes pagos cada mes, tu dinero se "libera" poco a poco para re-prestarlo. Por eso la TIR es mucho mayor que el ROI simple — refleja que tu capital no esta atrapado los 2 anos completos.'}
                formula={`Se calcula el rendimiento mensual que hace que:\nInversion inicial = Valor presente de todos los pagos futuros\n\nFlujos: Mes 0: -${formatMXN(params.principal)} + ${formatMXN(result.originationFee)} = ${formatMXN(-params.principal + result.originationFee)}\nMeses 1-${params.termMonths}: +${formatMXN(result.monthlyPayment)} pago - ${formatMXN(Math.round(result.totalCosts / params.termMonths))} costos/mes = +${formatMXN(Math.round(result.monthlyPayment - result.totalCosts / params.termMonths))}/mes neto\n\nTIR mensual anualizada = ${formatPct(result.irr)}\n\nComparacion: CETES ~8.5%, Bolsa ~12%, esta TIR = ${formatPct(result.irr)}`}
              />
              <ExplainerRow
                label="MOIC (Multiplo sobre Capital)"
                value={null}
                displayValue={`${result.moic.toFixed(2)}x`}
                concept={'Responde la pregunta mas basica: "por cada peso que invierto, cuantos pesos me regresan en total?" Un MOIC de 1.08x significa que por cada $1 invertido recuperas $1.08. Debajo de 1.0x estas perdiendo dinero.'}
                formula={`Total dinero que entra / Total dinero que sale\n\nDinero que entra:\n  Pagos del doctor: ${formatMXN(result.monthlyPayment)} x ${params.termMonths} = ${formatMXN(result.monthlyPayment * params.termMonths)}\n  Comision apertura: ${formatMXN(result.originationFee)}\n  Total: ${formatMXN(result.monthlyPayment * params.termMonths + result.originationFee)}\n\nDinero que sale:\n  Capital prestado: ${formatMXN(params.principal)}\n  CoF + Provisiones + OpEx: ${formatMXN(result.totalCosts)}\n  Total: ${formatMXN(params.principal + result.totalCosts)}\n\nMOIC = ${formatMXN(result.monthlyPayment * params.termMonths + result.originationFee)} / ${formatMXN(params.principal + result.totalCosts)} = ${result.moic.toFixed(2)}x`}
              />
              <ExplainerRow
                label="Spread (Diferencial de Tasas)"
                value={null}
                displayValue={formatPct(result.spread)}
                concept={'La diferencia entre lo que le cobras al doctor y lo que te cuesta el dinero. Es tu "margen bruto" antes de perdidas y gastos. Un spread de 16%+ es saludable para microfinanzas; menos de 10% deja poco espacio para absorber defaults.'}
                formula={`Tasa del prestamo - Costo de fondeo\n= ${formatPct(params.annualRate)} - ${formatPct(params.cofRate)} = ${formatPct(result.spread)}\n\nEste spread debe cubrir: provisiones, opex y dejar utilidad.\nSi el spread es menor que las perdidas esperadas (${formatPct(params.defaultRate * (1 - params.recoveryRate))}), el negocio no es viable.`}
              />
              <ExplainerRow
                label="NIM (Margen de Interes Neto)"
                value={null}
                displayValue={formatPct(result.nim)}
                concept={'Metrica estandar de la banca: cuanto ganas de intereses netos por cada peso que tienes prestado, al ano. Los bancos grandes tienen NIM de 4-6%. Las fintech de 15-25%. Un NIM alto indica buen pricing del producto.'}
                formula={`(Intereses cobrados - Costo de fondeo) / Saldo promedio prestado / Plazo en anos\n\nIntereses netos = ${formatMXN(result.totalInterest)} - ${formatMXN(result.cofTotal)} = ${formatMXN(result.totalInterest - result.cofTotal)}\nSaldo promedio durante toda la vida = ${formatMXN(result.avgOutstanding)}\n\nNIM = (${formatMXN(result.totalInterest - result.cofTotal)} / ${(params.termMonths / 12).toFixed(1)} anos) / ${formatMXN(result.avgOutstanding)} = ${formatPct(result.nim)}`}
              />
              <ExplainerRow
                label="ROI Simple"
                value={null}
                displayValue={formatPct(result.annualizedROI)}
                concept={'Version simplificada: utilidad / capital / anos. Subestima el rendimiento real porque asume que los $200K estan invertidos todo el tiempo, cuando en realidad cada mes recuperas parte. Usa la TIR para la comparacion real con otras inversiones.'}
                formula={`Utilidad Neta / Capital Prestado / Plazo en anos\n= ${formatMXN(result.netProfit)} / ${formatMXN(params.principal)} / ${(params.termMonths / 12).toFixed(1)} anos = ${formatPct(result.annualizedROI)}\n\nNota: Este numero es MENOR que la TIR (${formatPct(result.irr)}) porque ignora que el capital se recicla.`}
              />
              <ExplainerRow
                label="Utilidad Mensual"
                value={null}
                displayValue={`${formatMXN(result.monthlyProfit)} / mes`}
                concept="Ganancia promedio por mes. Util para pensar en flujo de efectivo mensual del negocio."
                formula={`Utilidad Neta / Plazo en meses\n= ${formatMXN(result.netProfit)} / ${params.termMonths} meses = ${formatMXN(result.monthlyProfit)}/mes`}
              />
            </ExplainerSection>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{sublabel}</div>
    </div>
  );
}

function ExplainerSection({
  title,
  color,
  children,
}: {
  title: string;
  color: "blue" | "red" | "green";
  children: React.ReactNode;
}) {
  const colors = {
    blue: "border-blue-200 bg-blue-50/30",
    red: "border-red-200 bg-red-50/30",
    green: "border-green-200 bg-green-50/30",
  };
  const titleColors = {
    blue: "text-blue-700",
    red: "text-red-700",
    green: "text-green-700",
  };
  return (
    <div className={`rounded-lg border ${colors[color]} p-3 space-y-3`}>
      <div className={`text-xs font-bold uppercase tracking-wider ${titleColors[color]}`}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ExplainerRow({
  label,
  value,
  positive,
  concept,
  formula,
  displayValue,
}: {
  label: string;
  value: number | null;
  positive?: boolean;
  concept: string;
  formula: string;
  displayValue?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <HelpCircle className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition" />
        </div>
        <span className={`text-sm font-bold ${value !== null ? (positive ? "text-green-600" : "text-red-500") : "text-gray-900"}`}>
          {displayValue ?? (value !== null ? `${positive ? "+" : "-"}${formatMXN(Math.abs(value))}` : "")}
        </span>
      </button>
      {open && (
        <div className="mt-2 ml-1 space-y-2">
          <p className="text-xs text-gray-600 leading-relaxed">{concept}</p>
          <pre className="text-xs bg-white/80 border border-gray-200 rounded-md p-2 text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
            {formula}
          </pre>
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border-t border-gray-300 pt-2 mt-1 flex justify-between">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{formatMXN(value)}</span>
    </div>
  );
}
