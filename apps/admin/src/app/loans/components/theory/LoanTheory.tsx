"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AmortizationType } from "../../lib/types";
import { AMORTIZATION_LABELS } from "../../lib/types";
import { generateAmortization } from "../../lib/amortization";
import { formatMXN, formatPct } from "../../lib/loan-math";

// ─── Collapsible Section ───
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
      >
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4 space-y-4">{children}</div>}
    </div>
  );
}

// ─── Mini Amortization Comparison ───
function AmortizationComparison() {
  const principal = 200000;
  const rate = 0.30;
  const term = 24;

  const types: AmortizationType[] = ["french", "equalPrincipal", "interestOnly", "flat"];

  const schedules = useMemo(() => {
    return types.map((t) => ({
      type: t,
      schedule: generateAmortization(principal, rate, term, 0, t, 3),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colors: Record<AmortizationType, string> = {
    french: "bg-blue-500",
    equalPrincipal: "bg-emerald-500",
    interestOnly: "bg-amber-500",
    flat: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Comparacion con un prestamo de {formatMXN(principal)} a {formatPct(rate)} anual, {term} meses:
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {schedules.map(({ type, schedule }) => {
          const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
          const totalPayments = schedule.reduce((s, r) => s + r.payment, 0);
          const firstPayment = schedule[0]?.payment ?? 0;
          const lastPayment = schedule[schedule.length - 1]?.payment ?? 0;

          return (
            <div key={type} className={`rounded-lg border-2 p-3 ${
              type === "french" ? "border-blue-300 bg-blue-50" :
              type === "flat" ? "border-red-300 bg-red-50" :
              "border-gray-200"
            }`}>
              <div className="text-xs font-bold text-gray-700 mb-2">
                {AMORTIZATION_LABELS[type].short}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Primer pago</span>
                  <span className="font-semibold">{formatMXN(firstPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ultimo pago</span>
                  <span className="font-semibold">{formatMXN(lastPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total intereses</span>
                  <span className="font-semibold text-red-600">{formatMXN(totalInterest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total pagado</span>
                  <span className="font-semibold">{formatMXN(totalPayments)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual bar chart: interest per month */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Interes pagado por mes (primeros 12 meses)</h4>
        <div className="space-y-2">
          {schedules.map(({ type, schedule }) => {
            const maxInterest = Math.max(...schedules.flatMap(s => s.schedule.slice(0, 12).map(r => r.interest)));
            return (
              <div key={type} className="space-y-1">
                <div className="text-xs font-medium text-gray-600">{AMORTIZATION_LABELS[type].short}</div>
                <div className="flex gap-0.5 items-end h-6">
                  {schedule.slice(0, 12).map((row, i) => (
                    <div
                      key={i}
                      className={`${colors[type]} rounded-sm opacity-80`}
                      style={{
                        width: `${100 / 12}%`,
                        height: `${maxInterest > 0 ? (row.interest / maxInterest) * 100 : 0}%`,
                        minHeight: "2px",
                      }}
                      title={`Mes ${row.month}: ${formatMXN(row.interest)} interes`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Nota: Flat mantiene interes constante. Frances/Aleman bajan. Solo Intereses es alto durante gracia y luego baja.
        </p>
      </div>

      {/* Payment profile chart */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Perfil de pagos mensuales</h4>
        <div className="space-y-2">
          {schedules.map(({ type, schedule }) => {
            const maxPayment = Math.max(...schedules.flatMap(s => s.schedule.map(r => r.payment)));
            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">{AMORTIZATION_LABELS[type].short}</span>
                  <span className="text-[10px] text-gray-400">
                    {formatMXN(schedule[0]?.payment ?? 0)} → {formatMXN(schedule[schedule.length - 1]?.payment ?? 0)}
                  </span>
                </div>
                <div className="flex gap-0.5 items-end h-8">
                  {schedule.map((row, i) => (
                    <div key={i} className="flex flex-col" style={{ width: `${100 / term}%` }}>
                      <div
                        className="bg-green-400 rounded-t-sm"
                        style={{ height: `${maxPayment > 0 ? (row.principal / maxPayment) * 32 : 0}px` }}
                        title={`Capital: ${formatMXN(row.principal)}`}
                      />
                      <div
                        className="bg-red-400 rounded-b-sm"
                        style={{ height: `${maxPayment > 0 ? (row.interest / maxPayment) * 32 : 0}px` }}
                        title={`Interes: ${formatMXN(row.interest)}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-4 text-[10px] text-gray-500 mt-1">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-400 rounded-sm inline-block" /> Capital</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-400 rounded-sm inline-block" /> Interes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Theory Component ───
export default function LoanTheory() {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
        <h1 className="text-lg font-bold text-gray-900 mb-2">Teoria de Prestamos</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          Guia de referencia para entender como funcionan los prestamos, los distintos tipos de amortizacion
          usados en Mexico, y por que los numeros del simulador dicen lo que dicen.
        </p>
      </div>

      {/* Section 1: Amortization Types */}
      <Section title="1. Tipos de Amortizacion en Mexico" defaultOpen={true}>
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none text-gray-600">
            <p>
              En Mexico se usan principalmente <strong>4 sistemas de amortizacion</strong>. La diferencia fundamental
              es <em>como se calculan los intereses</em> y <em>como se distribuye el pago entre capital e interes</em>
              cada mes.
            </p>
          </div>

          {/* Type descriptions */}
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="text-sm font-bold text-blue-800 mb-1">Frances (Cuota Fija) — El estandar en Mexico</h4>
              <p className="text-xs text-gray-600 mb-2">
                Usado por BBVA, Banorte, Santander, fintechs (Konfio, Kubo, yotepresto). Es el que usan todos los
                creditos personales, hipotecarios y automotrices regulados.
              </p>
              <div className="bg-white rounded p-3 text-xs font-mono text-gray-700 space-y-1">
                <p>Pago mensual = P x r x (1+r)^n / ((1+r)^n - 1)</p>
                <p className="text-gray-400">donde P = principal, r = tasa/12, n = plazo en meses</p>
              </div>
              <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc pl-4">
                <li>Pago mensual <strong>siempre igual</strong></li>
                <li>Los primeros meses pagas mas interes y poco capital</li>
                <li>Los ultimos meses pagas mas capital y poco interes</li>
                <li>Obligatorio por ley proporcionar la tabla al firmar contrato</li>
              </ul>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <h4 className="text-sm font-bold text-emerald-800 mb-1">Aleman (Capital Fijo)</h4>
              <p className="text-xs text-gray-600 mb-2">
                Menos comun en Mexico. Se usa en algunos creditos empresariales, agropecuarios y de banca de desarrollo
                (NAFIN, FIRA). Tambien en algunos creditos Infonavit.
              </p>
              <div className="bg-white rounded p-3 text-xs font-mono text-gray-700 space-y-1">
                <p>Capital fijo = P / n</p>
                <p>Interes = Saldo x r</p>
                <p>Pago = Capital fijo + Interes (baja cada mes)</p>
              </div>
              <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc pl-4">
                <li>Primer pago es el <strong>mas alto</strong>, ultimo el mas bajo</li>
                <li>Pagas <strong>menos interes total</strong> que Frances</li>
                <li>Requiere mayor capacidad de pago al inicio</li>
              </ul>
            </div>

            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h4 className="text-sm font-bold text-amber-800 mb-1">Solo Intereses + Amortizacion (Periodo de Gracia)</h4>
              <p className="text-xs text-gray-600 mb-2">
                Comun en creditos para negocios, creditos puente inmobiliarios y creditos agropecuarios en Mexico.
                El prestatario paga solo intereses por N meses mientras genera ingresos con el capital.
              </p>
              <div className="bg-white rounded p-3 text-xs font-mono text-gray-700 space-y-1">
                <p>Meses 1-N: Pago = Saldo x r (solo intereses)</p>
                <p>Mes N+1 en adelante: Amortizacion francesa normal</p>
              </div>
              <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc pl-4">
                <li>Pagos <strong>muy bajos al inicio</strong> (solo interes)</li>
                <li>El saldo <strong>no baja durante la gracia</strong></li>
                <li>Pagas <strong>mas interes total</strong> porque el saldo es alto mas tiempo</li>
                <li>Util cuando el doctor necesita tiempo para ver retorno de su inversion</li>
              </ul>
            </div>

            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <h4 className="text-sm font-bold text-red-800 mb-1">Tasa Flat (Sobre Saldo Original)</h4>
              <p className="text-xs text-gray-600 mb-2">
                Usado en tiendas departamentales (Liverpool, Palacio), algunas mueblerías, y prestamistas informales.
                CONDUSEF y Banxico lo critican porque <strong>el costo real es mucho mayor</strong> al anunciado.
              </p>
              <div className="bg-white rounded p-3 text-xs font-mono text-gray-700 space-y-1">
                <p>Interes mensual = P (original) x r</p>
                <p className="text-red-600">Siempre se cobra sobre el monto original, no sobre lo que debes</p>
              </div>
              <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc pl-4">
                <li>Un 25% "flat" equivale a ~45-50% de tasa real (sobre saldo)</li>
                <li>En el mes 20 de 24, debes $33K pero te cobran interes sobre $200K</li>
                <li>Las instituciones reguladas en Mexico <strong>no pueden usar tasa flat</strong> sin declarar el CAT real</li>
                <li className="text-red-600 font-medium">Incluido aqui como referencia educativa — no recomendado</li>
              </ul>
            </div>
          </div>

          {/* Interactive comparison */}
          <AmortizationComparison />
        </div>
      </Section>

      {/* Section 2: The CAT / Yield Paradox */}
      <Section title="2. La Paradoja: Tasa Nominal vs CAT vs TIR del Prestamista">
        <div className="space-y-4">
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm font-bold text-amber-800 mb-2">
              "Cobro 25% pero solo gano 12% y el doctor paga 28%... que esta mal?"
            </p>
            <p className="text-xs text-gray-600">
              Nada esta mal. Estos tres numeros miden cosas diferentes y los tres son correctos.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">Metrica</th>
                  <th className="px-3 py-2 text-center text-gray-600 font-semibold">Valor</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">Que mide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-medium">Tasa Nominal</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-600">25%</td>
                  <td className="px-3 py-2 text-xs text-gray-600">La tasa contractual. Cada mes se aplica 25%/12 = 2.08% al saldo pendiente.</td>
                </tr>
                <tr className="bg-red-50">
                  <td className="px-3 py-2 font-medium">CAT</td>
                  <td className="px-3 py-2 text-center font-bold text-red-600">~28%</td>
                  <td className="px-3 py-2 text-xs text-gray-600">Costo total para el doctor (con comisiones), compuesto. Definido por Banxico como TIR del prestatario.</td>
                </tr>
                <tr className="bg-green-50">
                  <td className="px-3 py-2 font-medium">TIR del Prestamista</td>
                  <td className="px-3 py-2 text-center font-bold text-green-600">~12%</td>
                  <td className="px-3 py-2 text-xs text-gray-600">Tu retorno real despues de costos. Afectado por saldo decreciente, CoF, y gastos operativos.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Why CAT > Nominal */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Por que el CAT es mayor que la tasa nominal?</h4>
            <div className="text-xs text-gray-600 space-y-2">
              <p>
                <strong>Compounding (interes compuesto).</strong> La tasa nominal de 25% se aplica mensualmente como 25%/12 = 2.083%.
                Si reinviertes esos pagos mensuales al mismo ritmo, al final del ano el efecto acumulado es:
              </p>
              <div className="bg-gray-50 rounded p-3 font-mono text-center">
                (1 + 0.25/12)^12 - 1 = <strong>28.07%</strong>
              </div>
              <p>
                Ademas, el CAT incluye la comision de apertura y cualquier otro cargo, lo cual lo sube aun mas.
                Esto es identico al concepto de APY vs APR en EE.UU. o TAE vs TIN en Europa.
              </p>
              <p className="text-gray-500 italic">
                Fuente: Banxico Circular 21/2009 — "El CAT se calcula como la Tasa Interna de Retorno (TIR)
                del flujo de efectivo desde la perspectiva del acreditado."
              </p>
            </div>
          </div>

          {/* Why Lender IRR < Nominal */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Por que la TIR del prestamista es menor que la tasa cobrada?</h4>
            <div className="text-xs text-gray-600 space-y-3">
              <p>
                <strong>Efecto del saldo decreciente.</strong> Con amortizacion francesa, cada mes que el doctor te paga,
                parte del pago es capital. Tu saldo — sobre el cual ganas intereses — baja cada mes:
              </p>

              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1 text-left">Mes</th>
                      <th className="px-2 py-1 text-right">Saldo</th>
                      <th className="px-2 py-1 text-right">Interes ganado</th>
                      <th className="px-2 py-1 text-left">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="px-2 py-1">1</td><td className="px-2 py-1 text-right font-mono">$200,000</td><td className="px-2 py-1 text-right font-mono">$4,167</td><td className="px-2 py-1 text-gray-500">25% de $200K / 12</td></tr>
                    <tr><td className="px-2 py-1">6</td><td className="px-2 py-1 text-right font-mono">$159,271</td><td className="px-2 py-1 text-right font-mono">$3,318</td><td className="px-2 py-1 text-gray-500">25% de $159K / 12</td></tr>
                    <tr><td className="px-2 py-1">12</td><td className="px-2 py-1 text-right font-mono">$106,741</td><td className="px-2 py-1 text-right font-mono">$2,224</td><td className="px-2 py-1 text-gray-500">25% de $107K / 12</td></tr>
                    <tr><td className="px-2 py-1">18</td><td className="px-2 py-1 text-right font-mono">$56,413</td><td className="px-2 py-1 text-right font-mono">$1,175</td><td className="px-2 py-1 text-gray-500">25% de $56K / 12</td></tr>
                    <tr><td className="px-2 py-1">23</td><td className="px-2 py-1 text-right font-mono">$18,340</td><td className="px-2 py-1 text-right font-mono">$382</td><td className="px-2 py-1 text-gray-500">25% de $18K / 12</td></tr>
                  </tbody>
                </table>
              </div>

              <p>
                Tu <strong>promedio ponderado de saldo</strong> sobre 24 meses es ~$108K — no $200K.
                Ganas 25% sobre un promedio de ~$108K, no sobre $200K. El resultado: ~$27K de intereses totales
                sobre $200K invertidos en 2 anos = <strong>~13.5% bruto anualizado</strong>.
              </p>
              <p>
                Despues de restar costo de fondeo, provisiones y gastos operativos, queda ~12%.
              </p>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs font-medium text-blue-800">
                  Solucion para mayor rendimiento: Si quisieras ganar 25% real, necesitarias un
                  <strong> prestamo bullet</strong> (solo intereses, capital al vencimiento). Pero eso concentra
                  todo el riesgo en un solo pago final — mucho mas peligroso para el prestamista.
                </p>
              </div>
            </div>
          </div>

          {/* Costo Simple vs CAT */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Costo Simple vs CAT: dos formas de ver lo mismo</h4>
            <div className="text-xs text-gray-600 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded p-3">
                  <div className="font-bold text-gray-700 mb-1">Costo Simple</div>
                  <div className="font-mono text-center text-lg font-bold text-gray-800">
                    ~14%
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Total intereses + comisiones / monto prestado.
                    Facil de entender: "de cada $100 prestados, el doctor paga $14 en costos".
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="font-bold text-gray-700 mb-1">CAT (TIR)</div>
                  <div className="font-mono text-center text-lg font-bold text-red-600">
                    ~28%
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Tasa interna de retorno anualizada. Considera el <em>valor del dinero en el tiempo</em>:
                    pagar $100 hoy no es lo mismo que pagar $100 en 24 meses.
                  </p>
                </div>
              </div>
              <p>
                Ambos son correctos. El costo simple es intuitivo para el cliente.
                El CAT es el estandar regulatorio definido por Banxico para comparar productos.
                <strong> Cualquier institucion regulada en Mexico debe publicar el CAT.</strong>
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: Key Lending Concepts */}
      <Section title="3. Conceptos Clave para Prestamistas">
        <div className="space-y-3">
          <ConceptCard
            term="Spread"
            formula="Tasa cobrada - Costo de fondeo"
            example="30% - 12% = 18%"
            explanation="Margen bruto entre lo que cobras y lo que pagas por el dinero. Pero no es tu ganancia real — faltan costos operativos, provisiones, y el efecto del saldo decreciente."
          />
          <ConceptCard
            term="NIM (Net Interest Margin)"
            formula="(Interes cobrado - Interes pagado) / Saldo promedio"
            example="($27K - $13K) / $108K = 13%"
            explanation="Mas preciso que el spread porque usa saldo promedio real, no principal nominal. Este es el indicador que usan los bancos para medir eficiencia de su cartera."
          />
          <ConceptCard
            term="EAD (Exposure at Default)"
            formula="Saldo pendiente al momento del default"
            example="Si default en mes 10: ~$92K"
            explanation="Cuanto puedes perder si el doctor deja de pagar. En amortizacion francesa, el EAD baja cada mes porque el doctor va pagando capital. Un prestamo bullet tiene EAD = 100% siempre."
          />
          <ConceptCard
            term="PD x LGD x EAD = Perdida Esperada"
            formula="Probabilidad de default x (1 - Tasa recuperacion) x Exposicion"
            example="4% x 70% x $92K = $2,576"
            explanation="Lo que debes provisionar por prestamo. Las SOFOM reguladas en Mexico deben seguir las metodologias de provision de la CNBV."
          />
          <ConceptCard
            term="DTI (Debt-to-Income)"
            formula="Pago mensual / Ingreso mensual"
            example="$9,504 / $120,000 = 7.9%"
            explanation="Capacidad de pago del doctor. En Mexico, CONDUSEF recomienda que la deuda total no supere 30-35% del ingreso. Para un solo prestamo, DTI < 15% es ideal."
          />
          <ConceptCard
            term="DSCR (Debt Service Coverage)"
            formula="Ingreso disponible / Pago mensual"
            example="$84,000 / $9,504 = 8.8x"
            explanation="Inverso del DTI, mas usado en creditos empresariales. DSCR > 1.25x es el minimo aceptable. > 2x es saludable."
          />
          <ConceptCard
            term="WAL (Weighted Average Life)"
            formula="Sum(mes x capital_pagado) / capital_total"
            example="~1.04 anos para prestamo de 24 meses"
            explanation="Vida promedio ponderada del capital. Te dice por cuanto tiempo, en promedio, tu dinero esta trabajando. Util para calzar plazos con tu fuente de fondeo."
          />
          <ConceptCard
            term="Capital Utilization"
            formula="Meses prestado / (Meses prestado + Meses parado)"
            example="24 / (24 + 2) = 92%"
            explanation="Que porcentaje del tiempo tu capital esta generando rendimiento. El enemigo es el tiempo muerto entre que un prestamo se paga y logras colocar otro."
          />
        </div>
      </Section>

      {/* Section 4: Mexican Regulatory Context */}
      <Section title="4. Marco Regulatorio en Mexico">
        <div className="space-y-3 text-xs text-gray-600">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-gray-700 mb-2">Instituciones relevantes</h4>
            <ul className="space-y-2">
              <li><strong>CNBV</strong> — Regula bancos y SOFOM reguladas. Define metodologias de provision y capital.</li>
              <li><strong>Banxico</strong> — Define el CAT (Circular 21/2009). Fija la tasa de referencia (8.50% mayo 2026).</li>
              <li><strong>CONDUSEF</strong> — Protege al usuario. Revisa contratos y publicidad. Compara productos (RECA/REUNE).</li>
              <li><strong>PROFECO</strong> — Aplica para financiamientos comerciales (tiendas departamentales, etc).</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-gray-700 mb-2">Obligaciones de transparencia</h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>Publicar el <strong>CAT</strong> en toda publicidad y contratos</li>
              <li>Entregar <strong>tabla de amortizacion</strong> al firmar contrato de tasa fija</li>
              <li>Informar el <strong>costo total del credito</strong> (capital + intereses + comisiones)</li>
              <li>Las SOFOM ENR deben estar registradas en CONDUSEF desde 2014</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-gray-700 mb-2">Amortizacion: que es estandar?</h4>
            <ul className="space-y-1 list-disc pl-4">
              <li><strong>Creditos personales</strong> → Frances (cuota fija). 100% del mercado bancario y fintech.</li>
              <li><strong>Hipotecarios</strong> → Frances. Algunos esquemas Infonavit usan pagos crecientes.</li>
              <li><strong>Automotrices</strong> → Frances. Bancos y financieras (NR Finance, GMAC).</li>
              <li><strong>Empresariales</strong> → Frances o Aleman. Creditos NAFIN/FIRA pueden ser Aleman.</li>
              <li><strong>Creditos puente</strong> → Solo intereses + balloon. Comun en desarrollo inmobiliario.</li>
              <li><strong>Retail/departamentales</strong> → Tasa flat disfrazada. El CAT debe revelarlo.</li>
            </ul>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-2">Recomendacion para doctores</h4>
            <p>
              Para un producto de credito para doctores (consultorios, equipo medico), el estandar es
              <strong> amortizacion francesa con tasa fija</strong>. Opcionalmente, ofrecer un periodo de gracia
              de 2-3 meses si el credito es para equipamiento que necesita tiempo de instalacion.
              El sistema Aleman es viable si los doctores tienen flujo alto desde el inicio.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 5: Business Model */}
      <Section title="5. Economia del Negocio de Prestamos">
        <div className="space-y-3 text-xs text-gray-600">
          <p>
            La seccion "Economia del Fondo" en el Simulador modela el ciclo completo de capital:
          </p>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-mono">
              <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">Prestar</span>
              <span className="text-gray-400">→</span>
              <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">Cobrar</span>
              <span className="text-gray-400">→</span>
              <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Esperar</span>
              <span className="text-gray-400">→</span>
              <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">Prestar</span>
            </div>
            <p className="mt-2">
              El tiempo de espera ("redeployment") es critico. Cada mes que tu capital esta parado,
              sigues pagando costo de fondeo al inversionista pero no generas nada.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-gray-700 mb-2">Claves de rentabilidad</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">1</span>
                <p><strong>Spread positivo no es suficiente.</strong> Un spread de 18pp (30% - 12%) se reduce a ~6-8% real despues de costos operativos, provisiones, y tiempo muerto.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">2</span>
                <p><strong>Rotacion de capital importa mas que margen.</strong> Un prestamo de 12 meses a 24% puede ser mas rentable que uno de 36 meses a 30% si puedes recolocar mas rapido.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">3</span>
                <p><strong>Un default borra multiples ganancias.</strong> El break-even tipico es 4-8 prestamos buenos por cada default total. Seleccion rigurosa {">"} tasa alta.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">4</span>
                <p><strong>El saldo decreciente es real.</strong> Cobrar 25% nominal solo genera ~12-14% de retorno sobre capital. Esto no es un error, es matematica fundamental de la amortizacion. Todos los bancos viven con esto.</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h4 className="font-bold text-amber-800 mb-2">Benchmark: que es un buen negocio?</h4>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="px-2 py-1 text-left">Metrica</th>
                    <th className="px-2 py-1 text-center text-red-600">Malo</th>
                    <th className="px-2 py-1 text-center text-amber-600">Regular</th>
                    <th className="px-2 py-1 text-center text-green-600">Bueno</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-2 py-1">TIR del Fondo</td><td className="px-2 py-1 text-center">{"<"}8%</td><td className="px-2 py-1 text-center">8-15%</td><td className="px-2 py-1 text-center">{">"}15%</td></tr>
                  <tr><td className="px-2 py-1">NIM</td><td className="px-2 py-1 text-center">{"<"}5%</td><td className="px-2 py-1 text-center">5-12%</td><td className="px-2 py-1 text-center">{">"}12%</td></tr>
                  <tr><td className="px-2 py-1">OSS</td><td className="px-2 py-1 text-center">{"<"}1.0x</td><td className="px-2 py-1 text-center">1.0-1.3x</td><td className="px-2 py-1 text-center">{">"}1.3x</td></tr>
                  <tr><td className="px-2 py-1">Default rate</td><td className="px-2 py-1 text-center">{">"}8%</td><td className="px-2 py-1 text-center">4-8%</td><td className="px-2 py-1 text-center">{"<"}4%</td></tr>
                  <tr><td className="px-2 py-1">Capital Utilization</td><td className="px-2 py-1 text-center">{"<"}80%</td><td className="px-2 py-1 text-center">80-90%</td><td className="px-2 py-1 text-center">{">"}90%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* Sources */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="text-xs font-bold text-gray-600 mb-2">Fuentes</h3>
        <ul className="text-[10px] text-gray-500 space-y-1">
          <li>Banxico — Circular 21/2009 (Calculo del CAT)</li>
          <li>CNBV — Disposiciones de caracter general aplicables a las SOFOM</li>
          <li>CONDUSEF — Registro de Contratos de Adhesion (RECA)</li>
          <li>BBVA Mexico — Educacion Financiera: Tabla de Amortizacion</li>
          <li>Xepelin, Kubo Financiero, yotepresto — Guias de amortizacion</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Concept Card ───
function ConceptCard({
  term,
  formula,
  example,
  explanation,
}: {
  term: string;
  formula: string;
  example: string;
  explanation: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-bold text-gray-800">{term}</h4>
        <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600 shrink-0">
          {example}
        </span>
      </div>
      <p className="text-[10px] font-mono text-gray-500 mb-1">{formula}</p>
      <p className="text-xs text-gray-600">{explanation}</p>
    </div>
  );
}
