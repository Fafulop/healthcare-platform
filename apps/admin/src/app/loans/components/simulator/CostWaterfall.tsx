"use client";

import { useState } from "react";
import type { LoanParams, LoanProfitResult } from "../../lib/types";
import { formatMXN, formatPct } from "../../lib/loan-math";
import { MARKET } from "../../lib/constants";
import { HelpCircle, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  const [showExplainer, setShowExplainer] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const data = [
    { name: "Intereses", value: result.totalInterest, color: "#2563eb" },
    { name: "Comision", value: result.originationFee, color: "#3b82f6" },
    { name: "Costo Fondeo", value: -result.cofTotal, color: "#ef4444" },
    { name: "Provisiones", value: -result.provisionAmount, color: "#f97316" },
    { name: "OpEx", value: -result.opExTotal, color: "#eab308" },
    { name: "Utilidad", value: result.netProfit, color: result.netProfit >= 0 ? "#22c55e" : "#ef4444" },
  ];

  const effectiveTermMonths = result.schedule.length;
  const termYears = effectiveTermMonths / 12;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Desglose de Costos e Ingresos</h3>
        {params.prepaymentMonth > 0 && (
          <p className="text-xs text-amber-600 mt-0.5">
            Prepago en mes {params.prepaymentMonth} — plazo efectivo: {effectiveTermMonths} meses
          </p>
        )}
      </div>

      {/* Summary Cards — Row 1: Core (always visible) */}
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
          sublabel={
            result.hurdleCleared
              ? `Supera hurdle ${formatPct(params.hurdleRate)}`
              : `Bajo hurdle ${formatPct(params.hurdleRate)}`
          }
          color="text-purple-600"
          badge={result.hurdleCleared ? "pass" : "fail"}
        />
      </div>

      {/* Borrower Affordability (always visible — critical for underwriting) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-2">
        <SummaryCard
          label="DTI"
          value={formatPct(result.dti)}
          sublabel={result.dti <= 0.35 ? "Saludable (<35%)" : result.dti <= 0.50 ? "Alerta (35-50%)" : "Riesgo (>50%)"}
          color={result.dti <= 0.35 ? "text-green-600" : result.dti <= 0.50 ? "text-amber-600" : "text-red-600"}
        />
        <SummaryCard
          label="DSCR"
          value={`${result.dscr.toFixed(2)}x`}
          sublabel={result.dscr >= 1.5 ? "Comodo" : result.dscr >= 1.2 ? "Aceptable" : "Insuficiente"}
          color={result.dscr >= 1.5 ? "text-green-600" : result.dscr >= 1.2 ? "text-amber-600" : "text-red-600"}
        />
        <SummaryCard
          label="CAT"
          value={formatPct(result.cat)}
          sublabel="Costo total al doctor"
          color={result.cat <= 0.50 ? "text-gray-700" : result.cat <= 1.0 ? "text-amber-600" : "text-red-700"}
          badge={result.cat > 1.0 ? "warning" : undefined}
        />
        <SummaryCard
          label="Payback"
          value={result.paybackMonth > 0 ? `Mes ${result.paybackMonth}` : "N/A"}
          sublabel="Recuperacion de capital"
          color="text-indigo-600"
        />
      </div>

      {/* Toggle Advanced Metrics */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition"
        >
          {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Metricas avanzadas
        </button>
      </div>

      {showAdvanced && (
        <>
          {/* Row 2: Returns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-2">
            <SummaryCard
              label="MOIC"
              value={`${result.moic.toFixed(2)}x`}
              sublabel="Pesos recibidos / invertidos"
              color="text-indigo-600"
            />
            <SummaryCard
              label="ROE"
              value={formatPct(result.roe)}
              sublabel="Retorno sobre capital propio"
              color="text-emerald-600"
            />
            <SummaryCard
              label="ROA"
              value={formatPct(result.roa)}
              sublabel="Retorno sobre activos"
              color="text-cyan-600"
            />
            <SummaryCard
              label="Spread"
              value={formatPct(result.spread)}
              sublabel={`${formatPct(params.annualRate)} - ${formatPct(params.cofRate)}`}
              color="text-teal-600"
            />
          </div>
          {/* Row 3: Efficiency & Risk */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-4 pb-2">
            <SummaryCard
              label="NIM"
              value={formatPct(result.nim)}
              sublabel="Margen interes neto"
              color="text-amber-600"
            />
            <SummaryCard
              label="Portfolio Yield"
              value={formatPct(result.portfolioYield)}
              sublabel="Rendimiento de cartera"
              color="text-orange-600"
            />
            <SummaryCard
              label="OSS"
              value={`${(result.oss * 100).toFixed(0)}%`}
              sublabel={result.oss >= 1 ? "Autosuficiente" : "No autosuficiente"}
              color={result.oss >= 1 ? "text-green-600" : "text-red-600"}
            />
            <SummaryCard
              label="OER"
              value={formatPct(result.oer)}
              sublabel="Gasto op. / cartera"
              color="text-rose-600"
            />
            <SummaryCard
              label="RAROC"
              value={formatPct(result.raroc)}
              sublabel="Retorno ajustado por riesgo"
              color="text-violet-600"
            />
          </div>
          {/* Row 4: Structural */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
            <SummaryCard
              label="EAD"
              value={formatMXN(result.ead)}
              sublabel={`Exposicion en mes ${params.defaultMonth}`}
              color="text-red-500"
            />
            <SummaryCard
              label="WAL"
              value={`${result.wal.toFixed(1)} anos`}
              sublabel="Vida promedio ponderada"
              color="text-sky-600"
            />
            <SummaryCard
              label="Duration"
              value={result.duration.toFixed(2)}
              sublabel="Sensibilidad a tasa"
              color="text-fuchsia-600"
            />
            <SummaryCard
              label="Break-even"
              value={`${result.breakEvenLoans} prestamos`}
              sublabel="Para cubrir 1 default total"
              color="text-orange-700"
            />
          </div>
        </>
      )}

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
                formula={`Suma de la porcion de intereses de los ${effectiveTermMonths} pagos mensuales.\nCada mes: Interes = Saldo pendiente x Tasa mensual (${formatPct(params.annualRate)} anual / 12 = ${(params.annualRate / 12 * 100).toFixed(2)}% mensual)\nMes 1: ${formatMXN(params.principal)} x ${(params.annualRate / 12 * 100).toFixed(2)}% = ${formatMXN(params.principal * params.annualRate / 12)}\nComo el saldo baja cada mes, los intereses tambien bajan.${params.prepaymentMonth > 0 ? `\n\nNota: Con prepago en mes ${params.prepaymentMonth}, solo se pagan ${effectiveTermMonths} meses en vez de ${params.termMonths}.` : ""}`}
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
                label="Provision por Perdidas (EAD-based)"
                value={result.provisionAmount}
                concept={`Reserva de dinero por si el doctor no paga. Ahora se calcula sobre la Exposicion al Default (EAD = ${formatMXN(result.ead)}), que es el saldo que quedaria pendiente en el mes ${params.defaultMonth}, NO sobre el principal original. Esto es mas preciso porque el doctor ya habra pagado parte del capital.`}
                formula={`EAD x Probabilidad de Default x Perdida en Default\n= ${formatMXN(result.ead)} x ${formatPct(params.defaultRate)} PD x ${formatPct(1 - params.recoveryRate)} LGD\n= ${formatMXN(result.ead)} x ${formatPct(params.defaultRate)} x (1 - ${formatPct(params.recoveryRate)} recuperacion)\n= ${formatMXN(result.provisionAmount)}\n\nNota: EAD (${formatMXN(result.ead)}) < Principal (${formatMXN(params.principal)})\nporque al mes ${params.defaultMonth} el doctor ya pago ${formatMXN(params.principal - result.ead)} de capital.`}
              />
              <ExplainerRow
                label="Gastos Operativos"
                value={result.opExTotal}
                concept="Costos reales de operar el prestamo: evaluar al doctor, procesar documentos, dar seguimiento a pagos, sistemas, personal."
                formula={`Costo de originacion + (Servicio anual x Plazo en anos)\n= ${formatMXN(params.originationCost)} + (${formatMXN(params.annualServicingCost)} x ${termYears.toFixed(1)} anos)\n= ${formatMXN(params.originationCost)} + ${formatMXN(params.annualServicingCost * termYears)} = ${formatMXN(result.opExTotal)}`}
              />
              <TotalRow label="= Costos Totales" value={result.totalCosts} color="text-red-600" />
            </ExplainerSection>

            {/* ── BORROWER AFFORDABILITY ── */}
            <ExplainerSection title="CAPACIDAD DEL DOCTOR" color="blue">
              <ExplainerRow
                label="DTI (Deuda sobre Ingreso)"
                value={null}
                displayValue={formatPct(result.dti)}
                concept={'Que porcentaje del ingreso mensual del doctor se va en pagar este prestamo. Regla de oro: menos de 35% es saludable, 35-50% es alerta, mas de 50% es riesgo alto de default. La mayoria de reguladores y bancos usan este limite.'}
                formula={`Pago Mensual / Ingreso Mensual del Doctor\n= ${formatMXN(result.monthlyPayment)} / ${formatMXN(params.doctorMonthlyIncome)} = ${formatPct(result.dti)}\n\n${result.dti <= 0.35 ? "Saludable: el doctor puede pagar comodamente." : result.dti <= 0.50 ? "Alerta: al limite. Considerar monto menor o plazo mas largo." : "Riesgo alto: el pago es demasiado grande para este ingreso."}`}
              />
              <ExplainerRow
                label="DSCR (Cobertura de Deuda)"
                value={null}
                displayValue={`${result.dscr.toFixed(2)}x`}
                concept={'Cuantas veces el ingreso disponible del doctor cubre el pago mensual. Asumimos que el 70% del ingreso es disponible para deuda (despues de gastos fijos de vida). Un DSCR de 2.0x significa que podria pagar el doble de la cuota. Minimo aceptable: 1.2x.'}
                formula={`Ingreso disponible / Pago mensual\n= (${formatMXN(params.doctorMonthlyIncome)} x 70%) / ${formatMXN(result.monthlyPayment)}\n= ${formatMXN(params.doctorMonthlyIncome * 0.7)} / ${formatMXN(result.monthlyPayment)} = ${result.dscr.toFixed(2)}x\n\n${result.dscr >= 1.5 ? "Comodo: buen margen de seguridad." : result.dscr >= 1.2 ? "Aceptable pero ajustado." : "Insuficiente: alto riesgo de incumplimiento."}`}
              />
              <ExplainerRow
                label="CAT (Costo Anual Total)"
                value={null}
                displayValue={formatPct(result.cat)}
                concept={'Metrica regulatoria obligatoria en Mexico (Banxico/CONDUSEF). Es lo que EL DOCTOR realmente paga al ano, incluyendo intereses, comisiones e IVA. Se calcula igual que la TIR pero desde la perspectiva del deudor. Por ley, toda publicidad de credito debe mostrar el CAT.'}
                formula={`Se calcula como la TIR de los flujos del doctor:\n\nMes 0: Recibe ${formatMXN(params.principal)} - Paga ${formatMXN(result.originationFee)} comision = ${formatMXN(params.principal - result.originationFee)} neto\nMeses 1-${effectiveTermMonths}: Paga ${formatMXN(result.monthlyPayment)}/mes\n\nCAT = ${formatPct(result.cat)} anual\n\nReferencia: CAT promedio tarjetas de credito ~60-80%.\nCAT promedio credito personal bancario ~30-50%.\nCAT de este prestamo: ${formatPct(result.cat)}${result.cat > 1.0 ? "\n\nALERTA: CAT arriba de 100% — probable escrutinio regulatorio de CONDUSEF." : ""}`}
              />
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
                displayValue={`${formatPct(result.irr)} ${result.hurdleCleared ? "PASA" : "NO PASA"}`}
                concept={'LA metrica mas importante para inversionistas. A diferencia del ROI simple, la TIR considera CUANDO recibes el dinero. Si prestas $200K y recibes pagos cada mes, tu dinero se "libera" poco a poco para re-prestarlo. Por eso la TIR es mucho mayor que el ROI simple — refleja que tu capital no esta atrapado los 2 anos completos.'}
                formula={`Se calcula el rendimiento mensual que hace que:\nInversion inicial = Valor presente de todos los pagos futuros\n\nFlujos: Mes 0: -${formatMXN(params.principal)} + ${formatMXN(result.originationFee)} = ${formatMXN(-params.principal + result.originationFee)}\nMeses 1-${effectiveTermMonths}: +${formatMXN(result.monthlyPayment)} pago - ${formatMXN(Math.round(result.totalCosts / effectiveTermMonths))} costos/mes = +${formatMXN(Math.round(result.monthlyPayment - result.totalCosts / effectiveTermMonths))}/mes neto\n\nTIR = ${formatPct(result.irr)} vs Hurdle Rate = ${formatPct(params.hurdleRate)}\n${result.hurdleCleared ? "PASA: la TIR supera el rendimiento minimo aceptable." : "NO PASA: la TIR no alcanza el rendimiento minimo exigido."}\n\nComparacion: CETES ~8.5%, Bolsa ~12%, esta TIR = ${formatPct(result.irr)}`}
              />
              <ExplainerRow
                label="MOIC (Multiplo sobre Capital)"
                value={null}
                displayValue={`${result.moic.toFixed(2)}x`}
                concept={'Responde la pregunta mas basica: "por cada peso que invierto, cuantos pesos me regresan en total?" Un MOIC de 1.08x significa que por cada $1 invertido recuperas $1.08. Debajo de 1.0x estas perdiendo dinero.'}
                formula={`Total dinero que entra / Total dinero que sale\n\nDinero que entra:\n  Pagos del doctor: ${formatMXN(result.schedule.reduce((s, r) => s + r.payment, 0))}\n  Comision apertura: ${formatMXN(result.originationFee)}\n  Total: ${formatMXN(result.schedule.reduce((s, r) => s + r.payment, 0) + result.originationFee)}\n\nDinero que sale:\n  Capital prestado: ${formatMXN(params.principal)}\n  CoF + Provisiones + OpEx: ${formatMXN(result.totalCosts)}\n  Total: ${formatMXN(params.principal + result.totalCosts)}\n\nMOIC = ${result.moic.toFixed(2)}x`}
              />
              <ExplainerRow
                label="RAROC (Retorno Ajustado por Riesgo)"
                value={null}
                displayValue={formatPct(result.raroc)}
                concept={'El RAROC responde: "cual es mi rendimiento REAL despues de considerar las perdidas esperadas?" Es mas conservador que el ROE porque deduce la perdida esperada (EL) del ingreso antes de calcular el retorno. Los bancos lo usan para comparar prestamos de diferentes riesgos en terminos iguales.'}
                formula={`(Ingreso Bruto - Perdida Esperada - OpEx - CoF) / Capital / Anos\n\nPerdida Esperada (EL) = EAD x PD x LGD = ${formatMXN(result.ead)} x ${formatPct(params.defaultRate)} x ${formatPct(1 - params.recoveryRate)} = ${formatMXN(result.ead * params.defaultRate * (1 - params.recoveryRate))}\n\nRAROC = (${formatMXN(result.grossRevenue)} - ${formatMXN(result.ead * params.defaultRate * (1 - params.recoveryRate))} - ${formatMXN(result.opExTotal)} - ${formatMXN(result.cofTotal)}) / ${termYears.toFixed(1)} anos / ${formatMXN(params.principal)}\n= ${formatPct(result.raroc)}`}
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
                formula={`(Intereses cobrados - Costo de fondeo) / Saldo promedio prestado / Plazo en anos\n\nIntereses netos = ${formatMXN(result.totalInterest)} - ${formatMXN(result.cofTotal)} = ${formatMXN(result.totalInterest - result.cofTotal)}\nSaldo promedio durante toda la vida = ${formatMXN(result.avgOutstanding)}\n\nNIM = (${formatMXN(result.totalInterest - result.cofTotal)} / ${termYears.toFixed(1)} anos) / ${formatMXN(result.avgOutstanding)} = ${formatPct(result.nim)}`}
              />
              <ExplainerRow
                label="ROI Simple"
                value={null}
                displayValue={formatPct(result.annualizedROI)}
                concept={'Version simplificada: utilidad / capital / anos. Subestima el rendimiento real porque asume que los $200K estan invertidos todo el tiempo, cuando en realidad cada mes recuperas parte. Usa la TIR para la comparacion real con otras inversiones.'}
                formula={`Utilidad Neta / Capital Prestado / Plazo en anos\n= ${formatMXN(result.netProfit)} / ${formatMXN(params.principal)} / ${termYears.toFixed(1)} anos = ${formatPct(result.annualizedROI)}\n\nNota: Este numero es MENOR que la TIR (${formatPct(result.irr)}) porque ignora que el capital se recicla.`}
              />
              <ExplainerRow
                label="Utilidad Mensual"
                value={null}
                displayValue={`${formatMXN(result.monthlyProfit)} / mes`}
                concept="Ganancia promedio por mes. Util para pensar en flujo de efectivo mensual del negocio."
                formula={`Utilidad Neta / Plazo en meses\n= ${formatMXN(result.netProfit)} / ${effectiveTermMonths} meses = ${formatMXN(result.monthlyProfit)}/mes`}
              />
            </ExplainerSection>

            {/* ── PROFITABILITY RATIOS ── */}
            <ExplainerSection title="RATIOS DE RENTABILIDAD" color="blue">
              <ExplainerRow
                label="ROE (Retorno sobre Capital)"
                value={null}
                displayValue={formatPct(result.roe)}
                concept={'Cuanto ganas al ano por cada peso de TU dinero invertido. Si usas solo capital propio, ROE = ROA. Pero si usas apalancamiento (deuda de terceros), el ROE sube porque pones menos capital propio. Benchmark: fintechs buscan ROE de 12-30%.'}
                formula={`Utilidad Neta anualizada / Capital propio invertido\n= (${formatMXN(result.netProfit)} / ${termYears.toFixed(1)} anos) / ${formatMXN(params.principal)}\n= ${formatMXN(Math.round(result.netProfit / termYears))} al ano / ${formatMXN(params.principal)} = ${formatPct(result.roe)}`}
              />
              <ExplainerRow
                label="ROA (Retorno sobre Activos)"
                value={null}
                displayValue={formatPct(result.roa)}
                concept={'Cuanto ganas por cada peso que tienes PRESTADO en promedio. Es mas preciso que el ROE porque usa el saldo promedio real, no el monto original. Benchmark: bancos 1-2%, fintechs 3-8%, microfinanzas 5-15%.'}
                formula={`Utilidad Neta anualizada / Saldo promedio prestado\n= (${formatMXN(result.netProfit)} / ${termYears.toFixed(1)} anos) / ${formatMXN(result.avgOutstanding)}\n= ${formatMXN(Math.round(result.netProfit / termYears))} / ${formatMXN(result.avgOutstanding)} = ${formatPct(result.roa)}`}
              />
              <ExplainerRow
                label="Portfolio Yield (Rendimiento de Cartera)"
                value={null}
                displayValue={formatPct(result.portfolioYield)}
                concept={'Todo lo que cobras (intereses + comisiones) dividido entre lo que tienes prestado. Muestra la productividad de tu cartera antes de costos. Si tu yield es 35% y tu CoF es 14%, tienes 21 puntos para cubrir perdidas y gastos.'}
                formula={`Ingreso Bruto anualizado / Saldo promedio prestado\n= (${formatMXN(result.grossRevenue)} / ${termYears.toFixed(1)} anos) / ${formatMXN(result.avgOutstanding)}\n= ${formatMXN(Math.round(result.grossRevenue / termYears))} / ${formatMXN(result.avgOutstanding)} = ${formatPct(result.portfolioYield)}`}
              />
              <ExplainerRow
                label="OSS (Autosuficiencia Operativa)"
                value={null}
                displayValue={`${(result.oss * 100).toFixed(0)}%`}
                concept={'Metrica clave de CGAP (estandar mundial de microfinanzas). Responde: "los ingresos cubren todos los costos?" Arriba de 100% = sostenible. Debajo de 100% = necesitas subsidio o capital externo para sobrevivir. Meta minima: 120%.'}
                formula={`Ingreso Bruto / Costos Totales\n= ${formatMXN(result.grossRevenue)} / ${formatMXN(result.totalCosts)} = ${(result.oss * 100).toFixed(0)}%\n\n${result.oss >= 1.2 ? "Excelente: muy por encima del 120% minimo." : result.oss >= 1 ? "Sostenible, pero busca llegar a 120%+." : "Alerta: no cubre costos. Revisar pricing o costos."}`}
              />
            </ExplainerSection>

            {/* ── EFFICIENCY & STRUCTURAL ── */}
            <ExplainerSection title="EFICIENCIA Y ESTRUCTURA" color="red">
              <ExplainerRow
                label="EAD (Exposicion al Default)"
                value={null}
                displayValue={formatMXN(result.ead)}
                concept={`La cantidad real que el prestamista tiene en riesgo en el momento esperado de default (mes ${params.defaultMonth}). Es menor que el principal original porque el doctor ya hizo pagos de capital. Las provisiones ahora se calculan sobre este monto, no sobre el principal completo.`}
                formula={`Saldo pendiente al final del mes ${params.defaultMonth} de la tabla de amortizacion\n= ${formatMXN(result.ead)}\n\nAntes: Provision = ${formatMXN(params.principal)} x ${formatPct(params.defaultRate)} x ${formatPct(1 - params.recoveryRate)} = ${formatMXN(params.principal * params.defaultRate * (1 - params.recoveryRate))}\nAhora: Provision = ${formatMXN(result.ead)} x ${formatPct(params.defaultRate)} x ${formatPct(1 - params.recoveryRate)} = ${formatMXN(result.provisionAmount)}\nAhorro en provision: ${formatMXN(params.principal * params.defaultRate * (1 - params.recoveryRate) - result.provisionAmount)}`}
              />
              <ExplainerRow
                label="WAL (Vida Promedio Ponderada)"
                value={null}
                displayValue={`${result.wal.toFixed(1)} anos`}
                concept={'Responde: "en promedio, cuanto tiempo esta cada peso prestado?" Si el WAL es 1.1 anos en un prestamo de 2 anos, significa que el dinero se recicla rapido — la mayoria del capital se devuelve antes de la mitad del plazo. Util para matching de fondeo: tu fuente de fondeo debe tener plazo >= WAL.'}
                formula={`Suma de (Mes x Capital pagado en ese mes) / Total capital pagado / 12\n\nCada mes el doctor paga una porcion de capital. Los meses tempranos pesan menos, los tardios mas.\nWAL = ${result.wal.toFixed(2)} anos\n\nPlazo total: ${termYears.toFixed(1)} anos. WAL es ${((result.wal / termYears) * 100).toFixed(0)}% del plazo.\nTu fondeo debe durar al menos ${result.wal.toFixed(1)} anos.`}
              />
              <ExplainerRow
                label="Payback (Mes de Recuperacion)"
                value={null}
                displayValue={result.paybackMonth > 0 ? `Mes ${result.paybackMonth}` : "No se recupera"}
                concept={'El mes en que el flujo de efectivo acumulado (pagos recibidos minus todos los costos) supera la inversion inicial. Despues de este mes, todo lo que entra es ganancia neta. Si no hay payback dentro del plazo, el prestamo pierde dinero.'}
                formula={`Mes donde: Suma(pagos netos 1..N) >= Inversion inicial\n\nInversion: ${formatMXN(params.principal)} - ${formatMXN(result.originationFee)} comision = ${formatMXN(params.principal - result.originationFee)} neto\nPago neto/mes: ${formatMXN(result.monthlyPayment)} - ${formatMXN(Math.round(result.totalCosts / effectiveTermMonths))} costos = ${formatMXN(Math.round(result.monthlyPayment - result.totalCosts / effectiveTermMonths))}\n\n${result.paybackMonth > 0 ? `Payback en mes ${result.paybackMonth} (${(result.paybackMonth / 12).toFixed(1)} anos)` : "No se recupera en el plazo del prestamo"}`}
              />
              <ExplainerRow
                label="Duration (Sensibilidad a Tasa)"
                value={null}
                displayValue={result.duration.toFixed(2)}
                concept={'Mide cuanto cambia tu utilidad cuando la tasa del prestamo sube o baja 1 punto porcentual. Una duration de 2.5 significa que si la tasa sube 1%, tu utilidad cambia ~2.5%. Util para entender el riesgo de tasa de tu cartera.'}
                formula={`Cambio % en utilidad por cada 1% de cambio en tasa\n\nSe calcula moviendo la tasa +1% y -1% y midiendo el cambio:\nDuration = ${result.duration.toFixed(2)}\n\nInterpretacion: si la tasa baja 1pp (de ${formatPct(params.annualRate)} a ${formatPct(params.annualRate - 0.01)}),\nla utilidad cambiaria ~${(Math.abs(result.duration) * 1).toFixed(1)}%.`}
              />
              <ExplainerRow
                label="OER (Ratio de Gasto Operativo)"
                value={null}
                displayValue={formatPct(result.oer)}
                concept={'Que tanto de tu cartera se "come" la operacion cada ano. Incluye originacion, servicing, cobranza. Meta para fintech digital: menos de 15%. Microfinanzas tradicional: 20-30%. Si tu OER es mayor que tu spread, los gastos se comen las ganancias.'}
                formula={`Gastos Operativos anualizados / Saldo promedio\n= (${formatMXN(result.opExTotal)} / ${termYears.toFixed(1)} anos) / ${formatMXN(result.avgOutstanding)}\n= ${formatMXN(Math.round(result.opExTotal / termYears))} / ${formatMXN(result.avgOutstanding)} = ${formatPct(result.oer)}`}
              />
              <ExplainerRow
                label="Costo Total / Principal"
                value={null}
                displayValue={formatPct(result.costPerLoanPct)}
                concept={'Cuanto cuesta operar este prestamo como porcentaje del monto prestado. Incluye CoF + provisiones + opex. Benchmark: prestamos grandes (>$500K) tienen 5-10%. Microcreditos (<$50K) pueden llegar a 20-30% porque los costos fijos pesan mas.'}
                formula={`Costos Totales / Principal\n= ${formatMXN(result.totalCosts)} / ${formatMXN(params.principal)} = ${formatPct(result.costPerLoanPct)}`}
              />
              <ExplainerRow
                label="Break-even (Prestamos para cubrir 1 default)"
                value={null}
                displayValue={`${result.breakEvenLoans} prestamos`}
                concept={'Cuantos prestamos que paguen bien necesitas para cubrir la perdida de UN default total. Si el numero es 3, necesitas al menos 3 prestamos buenos por cada malo. Con una tasa de default de 4%, necesitarias al menos 1 de cada 25 — si break-even es 3, estas bien cubierto.'}
                formula={`Perdida maxima por default / Utilidad por prestamo bueno\n= ${formatMXN(params.principal * (1 - params.recoveryRate))} perdida total / ${formatMXN(result.netProfit)} utilidad\n= ${result.breakEvenLoans} prestamos\n\nCon PD de ${formatPct(params.defaultRate)}, en 100 prestamos esperas ${Math.round(params.defaultRate * 100)} defaults.\nNecesitas: ${result.breakEvenLoans * Math.round(params.defaultRate * 100)} buenos para cubrir los ${Math.round(params.defaultRate * 100)} malos.\nTienes: ${100 - Math.round(params.defaultRate * 100)} buenos. ${(100 - Math.round(params.defaultRate * 100)) >= result.breakEvenLoans * Math.round(params.defaultRate * 100) ? "VIABLE" : "RIESGO"}.`}
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
  badge,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
  badge?: "pass" | "fail" | "warning";
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 relative">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{sublabel}</div>
      {badge === "pass" && (
        <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-green-500" />
      )}
      {badge === "fail" && (
        <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-red-500" />
      )}
      {badge === "warning" && (
        <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-amber-500" />
      )}
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
