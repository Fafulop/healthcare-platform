"use client";

import { useState } from "react";
import type { LoanParams, LoanProfitResult, FundEconomics } from "../../lib/types";
import { formatMXN, formatPct } from "../../lib/loan-math";
import { ChevronDown, ChevronRight, HelpCircle, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  fund: FundEconomics;
  result: LoanProfitResult;
  params: LoanParams;
}

export default function FundEconomicsPanel({ fund, result, params }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const effectiveTermMonths = result.schedule.length;
  const spreadHealthy = fund.effectiveSpread >= 0.10;
  const profitable = fund.fundNetProfit > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
        <h3 className="text-sm font-semibold text-gray-800">
          Economia del Negocio — Vista del Operador
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Como se ve tu negocio con capital de inversionistas al {formatPct(params.cofRate)},
          incluyendo {params.redeploymentMonths} {params.redeploymentMonths === 1 ? "mes" : "meses"} de capital parado entre prestamos
        </p>
      </div>

      {/* The Big Picture — always visible */}
      <div className="p-4 space-y-4">

        {/* Cycle timeline visual */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Ciclo de Capital ({fund.cycleLengthMonths} meses)
          </div>
          <div className="flex rounded-lg overflow-hidden h-8 border border-gray-200">
            <div
              className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold"
              style={{ width: `${fund.capitalUtilization * 100}%` }}
            >
              {effectiveTermMonths}m prestado
            </div>
            {params.redeploymentMonths > 0 && (
              <div
                className="bg-red-100 flex items-center justify-center text-red-700 text-xs font-bold border-l-2 border-red-300"
                style={{ width: `${(1 - fund.capitalUtilization) * 100}%` }}
              >
                {params.redeploymentMonths}m parado
              </div>
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Utilizacion: {formatPct(fund.capitalUtilization, 0)}</span>
            <span>{fund.cyclesPerYear.toFixed(1)} ciclos/ano</span>
          </div>
        </div>

        {/* Core Business Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Tu Ganancia / Ciclo"
            value={formatMXN(fund.youKeep)}
            color={profitable ? "text-green-600" : "text-red-600"}
            icon={profitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          />
          <MetricCard
            label="Tu Ganancia / Ano"
            value={formatMXN(fund.annualProfitPerUnit)}
            sublabel={`x ${formatMXN(params.principal)} de capital`}
            color={fund.annualProfitPerUnit > 0 ? "text-green-600" : "text-red-600"}
          />
          <MetricCard
            label="TIR del Fondo"
            value={formatPct(fund.fundIRR)}
            sublabel={`vs ${formatPct(result.irr)} por prestamo`}
            color={fund.fundIRR >= params.hurdleRate ? "text-purple-600" : "text-red-600"}
          />
          <MetricCard
            label="Spread Real"
            value={formatPct(fund.effectiveSpread)}
            sublabel={`vs ${formatPct(result.spread)} teorico`}
            color={spreadHealthy ? "text-teal-600" : "text-red-600"}
          />
        </div>

        {/* Investor vs You Split */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Distribucion por Ciclo de {fund.cycleLengthMonths} meses
          </div>
          <div className="space-y-2">
            {/* Revenue bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Ingreso Bruto del Prestamo</span>
                <span className="font-semibold text-blue-600">{formatMXN(fund.fundGrossRevenue)}</span>
              </div>
              <div className="h-4 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Cost breakdown bar */}
            {fund.fundGrossRevenue > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Costos (incluye capital parado)</span>
                  <span className="font-semibold text-red-600">{formatMXN(fund.fundTotalCosts)}</span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  {/* Investor portion */}
                  <div
                    className="h-full bg-orange-400"
                    style={{ width: `${Math.min(100, (fund.investorEarns / fund.fundGrossRevenue) * 100)}%` }}
                    title={`Inversionista: ${formatMXN(fund.investorEarns)}`}
                  />
                  {/* OpEx + provisions */}
                  <div
                    className="h-full bg-yellow-400"
                    style={{ width: `${Math.min(100 - (fund.investorEarns / fund.fundGrossRevenue) * 100, ((result.opExTotal + result.provisionAmount) / fund.fundGrossRevenue) * 100)}%` }}
                    title={`OpEx + Provisiones: ${formatMXN(result.opExTotal + result.provisionAmount)}`}
                  />
                  {/* Idle cost */}
                  {fund.idleCapitalCost > 0 && (
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${Math.min(20, (fund.idleCapitalCost / fund.fundGrossRevenue) * 100)}%` }}
                      title={`Capital parado: ${formatMXN(fund.idleCapitalCost)}`}
                    />
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400" /> CoF inversionista</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-400" /> OpEx + provisiones</span>
                  {fund.idleCapitalCost > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" /> Capital parado</span>
                  )}
                </div>
              </div>
            )}

            {/* Your profit bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Lo Que Te Queda</span>
                <span className={`font-bold ${profitable ? "text-green-600" : "text-red-600"}`}>
                  {formatMXN(fund.youKeep)}
                </span>
              </div>
              {fund.fundGrossRevenue > 0 && (
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${profitable ? "bg-green-500" : "bg-red-400"}`}
                    style={{ width: `${Math.max(0, Math.min(100, (fund.youKeep / fund.fundGrossRevenue) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key insight callout */}
        <div className={`rounded-lg p-3 border text-sm ${
          profitable && fund.fundIRR >= params.hurdleRate
            ? "bg-green-50 border-green-200 text-green-800"
            : profitable
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {profitable && fund.fundIRR >= params.hurdleRate ? (
            <p>
              <strong>Negocio viable.</strong> Por cada {formatMXN(params.principal)} de capital de inversionistas,
              ganas {formatMXN(fund.annualProfitPerUnit)}/ano despues de pagarles.
              {params.redeploymentMonths > 0 && (
                <span> El capital parado te cuesta {formatMXN(fund.idleCapitalCost)} por ciclo
                — {formatPct(fund.idleCapitalCost / result.netProfit > 0 ? fund.idleCapitalCost / result.netProfit : 0)} de tu utilidad por prestamo.</span>
              )}
            </p>
          ) : profitable ? (
            <p>
              <strong>Rentable pero bajo hurdle.</strong> Ganas {formatMXN(fund.youKeep)}/ciclo
              pero tu TIR real ({formatPct(fund.fundIRR)}) no alcanza el {formatPct(params.hurdleRate)} minimo.
              {params.redeploymentMonths > 0 && ` Reducir el tiempo de re-colocacion ayudaria — cada mes parado te cuesta ${formatMXN(params.principal * params.cofRate / 12)}.`}
            </p>
          ) : (
            <p>
              <strong>Negocio no viable con estos parametros.</strong> Pierdes {formatMXN(Math.abs(fund.youKeep))}/ciclo.
              El costo del capital ({formatPct(params.cofRate)}) mas {params.redeploymentMonths} meses de capital parado
              excede lo que generas prestando al {formatPct(params.annualRate)}.
            </p>
          )}
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition"
        >
          {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <HelpCircle className="w-4 h-4" />
          Como funciona la economia del negocio
        </button>

        {showDetails && (
          <div className="space-y-3 text-xs">
            <DetailRow
              label="El problema del capital parado"
              explanation={`Tu inversionista te presta ${formatMXN(params.principal)} al ${formatPct(params.cofRate)} anual. Eso significa que le debes ${formatMXN(Math.round(params.principal * params.cofRate / 12))}/mes SIN IMPORTAR si el dinero esta prestado o no.\n\nSi el prestamo dura ${effectiveTermMonths} meses y luego tardas ${params.redeploymentMonths} meses en encontrar otro doctor, durante esos ${params.redeploymentMonths} meses pagas ${formatMXN(Math.round(params.principal * params.cofRate / 12))}/mes sin ganar nada.\n\nCosto del capital parado: ${formatMXN(fund.idleCapitalCost)}\nEso se come ${result.netProfit > 0 ? formatPct(fund.idleCapitalCost / result.netProfit) : "toda"} de tu utilidad por prestamo.`}
            />
            <DetailRow
              label="Spread teorico vs real"
              explanation={`Spread teorico: ${formatPct(params.annualRate)} - ${formatPct(params.cofRate)} = ${formatPct(result.spread)}\nPero tu dinero solo gana ${formatPct(params.annualRate)} durante ${effectiveTermMonths} de ${fund.cycleLengthMonths} meses.\n\nTasa efectiva de ganancia: ${formatPct(params.annualRate)} x ${formatPct(fund.capitalUtilization, 0)} utilizacion = ${formatPct(fund.effectiveSpread + params.cofRate)}\nSpread real: ${formatPct(fund.effectiveSpread + params.cofRate)} - ${formatPct(params.cofRate)} = ${formatPct(fund.effectiveSpread)}\n\n${fund.effectiveSpread < 0.10 ? "ALERTA: spread real menor a 10% — poco margen para absorber defaults inesperados." : "Spread saludable para cubrir riesgos."}`}
            />
            <DetailRow
              label="Cuantas veces rota tu capital al ano"
              explanation={`Cada ciclo completo: ${effectiveTermMonths} meses prestado + ${params.redeploymentMonths} meses buscando = ${fund.cycleLengthMonths} meses\n\nCiclos por ano: 12 / ${fund.cycleLengthMonths} = ${fund.cyclesPerYear.toFixed(2)} ciclos\n\nUtilidad por ciclo: ${formatMXN(fund.youKeep)}\nUtilidad anual: ${formatMXN(fund.youKeep)} x ${fund.cyclesPerYear.toFixed(2)} = ${formatMXN(fund.annualProfitPerUnit)}\n\nSi tu capital rota mas rapido (prestamos cortos + rapida re-colocacion), ganas mas al ano aunque la utilidad por prestamo sea menor.`}
            />
            <DetailRow
              label="Que le pagas al inversionista vs que te quedas"
              explanation={`El inversionista te presto ${formatMXN(params.principal)} al ${formatPct(params.cofRate)} anual.\nDurante el ciclo de ${fund.cycleLengthMonths} meses (${fund.cycleYears} anos), le debes:\n${formatMXN(params.principal)} x ${formatPct(params.cofRate)} x ${fund.cycleYears} anos = ${formatMXN(fund.investorEarns)}\n\nTu ingreso bruto: ${formatMXN(fund.fundGrossRevenue)}\n- Pago al inversionista (CoF): ${formatMXN(fund.investorEarns)}\n- OpEx + provisiones: ${formatMXN(result.opExTotal + result.provisionAmount)}\n- Capital parado: ${formatMXN(fund.idleCapitalCost)}\n= Te queda: ${formatMXN(fund.youKeep)}\n\nEl inversionista gana ${formatPct(fund.investorAnnualReturn)} anual (garantizado).\nTu ganas ${formatPct(fund.yourAnnualReturn)} anual (variable, con riesgo).${fund.yourAnnualReturn < fund.investorAnnualReturn ? "\n\nALERTA: El inversionista gana MAS que tu. Reconsidera los terminos." : ""}`}
            />
            <DetailRow
              label="TIR del fondo vs TIR del prestamo"
              explanation={`TIR por prestamo: ${formatPct(result.irr)} — asume que al segundo que te devuelven el dinero, lo vuelves a prestar.\n\nTIR del fondo: ${formatPct(fund.fundIRR)} — incluye los ${params.redeploymentMonths} meses donde el dinero no genera nada pero sigues pagando al inversionista.\n\nDiferencia: ${formatPct(result.irr - fund.fundIRR)} de rendimiento perdido por capital parado.\n\n${params.redeploymentMonths === 0 ? "Con re-colocacion inmediata ambas TIR son iguales." : `Si pudieras re-colocar en ${Math.max(0, params.redeploymentMonths - 1)} meses en vez de ${params.redeploymentMonths}, recuperarias ~${formatMXN(Math.round(params.principal * params.cofRate / 12))} por ciclo.`}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  color,
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sublabel && <div className="text-xs text-gray-400">{sublabel}</div>}
    </div>
  );
}

function DetailRow({
  label,
  explanation,
}: {
  label: string;
  explanation: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left group text-sm font-medium text-gray-700"
      >
        <HelpCircle className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition shrink-0" />
        {label}
      </button>
      {open && (
        <pre className="mt-2 ml-6 text-xs bg-white/80 border border-gray-200 rounded-md p-2 text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
          {explanation}
        </pre>
      )}
    </div>
  );
}
