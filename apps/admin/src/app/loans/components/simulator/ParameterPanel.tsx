"use client";

import type { LoanParams, AmortizationType } from "../../lib/types";
import { FUNDING_PRESETS, TIER_PRESETS, AMORTIZATION_LABELS, type FundingPreset } from "../../lib/types";
import { PARAM_RANGES } from "../../lib/constants";
import { formatMXN, formatPct } from "../../lib/loan-math";

interface Props {
  params: LoanParams;
  onChange: (params: LoanParams) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export default function ParameterPanel({ params, onChange }: Props) {
  const update = (partial: Partial<LoanParams>) => onChange({ ...params, ...partial });

  return (
    <div className="space-y-6">
      {/* Tier Presets */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Presets por Tier</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(TIER_PRESETS) as [string, typeof TIER_PRESETS.a][]).map(([key, tier]) => (
            <button
              key={key}
              onClick={() =>
                update({
                  annualRate: tier.rate,
                  defaultRate: tier.defaultRate,
                  principal: Math.min(params.principal, tier.maxAmount),
                  termMonths: Math.min(params.termMonths, tier.maxTerm),
                })
              }
              className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition"
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amortization Type */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Tipo de Amortizacion</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(AMORTIZATION_LABELS) as [AmortizationType, typeof AMORTIZATION_LABELS.french][]).map(
            ([key, info]) => (
              <button
                key={key}
                onClick={() => update({ amortizationType: key })}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition text-left ${
                  params.amortizationType === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                <div>{info.short}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{info.description.slice(0, 50)}</div>
              </button>
            )
          )}
        </div>
        {params.amortizationType === "interestOnly" && (
          <div className="mt-3">
            <SliderRow
              label="Meses Solo Intereses"
              value={params.gracePeriodMonths}
              min={PARAM_RANGES.gracePeriodMonths.min}
              max={Math.min(PARAM_RANGES.gracePeriodMonths.max, params.termMonths - 1)}
              step={PARAM_RANGES.gracePeriodMonths.step}
              format={(v) => `${v} meses`}
              onChange={(v) => update({ gracePeriodMonths: v })}
            />
          </div>
        )}
      </div>

      {/* Loan Parameters */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Parametros del Prestamo</h3>
        <div className="space-y-4">
          <SliderRow
            label="Monto"
            value={params.principal}
            {...PARAM_RANGES.principal}
            format={formatMXN}
            onChange={(v) => update({ principal: v })}
          />
          <SliderRow
            label="Tasa Anual"
            value={params.annualRate}
            {...PARAM_RANGES.annualRate}
            format={formatPct}
            onChange={(v) => update({ annualRate: v })}
          />
          <SliderRow
            label="Plazo (meses)"
            value={params.termMonths}
            {...PARAM_RANGES.termMonths}
            format={(v) => `${v} meses`}
            onChange={(v) => update({
              termMonths: v,
              ...(params.prepaymentMonth > v ? { prepaymentMonth: v } : {}),
              ...(params.defaultMonth > v ? { defaultMonth: v } : {}),
            })}
          />
          <SliderRow
            label="Comision de Apertura"
            value={params.originationFeeRate}
            {...PARAM_RANGES.originationFeeRate}
            format={formatPct}
            onChange={(v) => update({ originationFeeRate: v })}
          />
        </div>
      </div>

      {/* Funding Source */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Fuente de Fondeo</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(Object.entries(FUNDING_PRESETS) as [FundingPreset, typeof FUNDING_PRESETS.equity][]).map(
            ([key, preset]) => (
              <button
                key={key}
                onClick={() => update({ cofRate: preset.cofRate })}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${
                  Math.abs(params.cofRate - preset.cofRate) < 0.001
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                <div>{preset.label}</div>
                <div className="text-gray-500 mt-0.5">{formatPct(preset.cofRate)}</div>
              </button>
            )
          )}
        </div>
        <SliderRow
          label="Costo de Fondeo (anual)"
          value={params.cofRate}
          {...PARAM_RANGES.cofRate}
          format={formatPct}
          onChange={(v) => update({ cofRate: v })}
        />
      </div>

      {/* Risk Parameters */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Parametros de Riesgo</h3>
        <div className="space-y-4">
          <SliderRow
            label="Tasa de Default (PD)"
            value={params.defaultRate}
            {...PARAM_RANGES.defaultRate}
            format={formatPct}
            onChange={(v) => update({ defaultRate: v })}
          />
          <SliderRow
            label="Tasa de Recuperacion"
            value={params.recoveryRate}
            {...PARAM_RANGES.recoveryRate}
            format={formatPct}
            onChange={(v) => update({ recoveryRate: v })}
          />
          <SliderRow
            label="Mes Promedio de Default"
            value={params.defaultMonth}
            min={PARAM_RANGES.defaultMonth.min}
            max={params.termMonths}
            step={PARAM_RANGES.defaultMonth.step}
            format={(v) => `Mes ${v}`}
            onChange={(v) => update({ defaultMonth: v })}
          />
        </div>
      </div>

      {/* Borrower Profile */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Perfil del Doctor</h3>
        <div className="space-y-4">
          <SliderRow
            label="Ingreso Mensual"
            value={params.doctorMonthlyIncome}
            {...PARAM_RANGES.doctorMonthlyIncome}
            format={formatMXN}
            onChange={(v) => update({ doctorMonthlyIncome: v })}
          />
          <SliderRow
            label="Prepago en Mes"
            value={params.prepaymentMonth}
            min={PARAM_RANGES.prepaymentMonth.min}
            max={params.termMonths}
            step={PARAM_RANGES.prepaymentMonth.step}
            format={(v) => (v === 0 ? "Sin prepago" : `Mes ${v}`)}
            onChange={(v) => update({ prepaymentMonth: v })}
          />
        </div>
      </div>

      {/* Operating Costs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Costos Operativos</h3>
        <div className="space-y-4">
          <SliderRow
            label="Costo de Originacion"
            value={params.originationCost}
            {...PARAM_RANGES.originationCost}
            format={formatMXN}
            onChange={(v) => update({ originationCost: v })}
          />
          <SliderRow
            label="Servicio Anual"
            value={params.annualServicingCost}
            {...PARAM_RANGES.annualServicingCost}
            format={formatMXN}
            onChange={(v) => update({ annualServicingCost: v })}
          />
          <SliderRow
            label="Costo de Cobranza (default)"
            value={params.collectionCost}
            {...PARAM_RANGES.collectionCost}
            format={formatMXN}
            onChange={(v) => update({ collectionCost: v })}
          />
        </div>
      </div>

      {/* Business / Fund Economics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Economia del Negocio</h3>
        <div className="space-y-4">
          <SliderRow
            label="Meses para Re-colocar"
            value={params.redeploymentMonths}
            {...PARAM_RANGES.redeploymentMonths}
            format={(v) => (v === 0 ? "Inmediato" : `${v} meses`)}
            onChange={(v) => update({ redeploymentMonths: v })}
          />
          <SliderRow
            label="Hurdle Rate (TIR minima)"
            value={params.hurdleRate}
            {...PARAM_RANGES.hurdleRate}
            format={formatPct}
            onChange={(v) => update({ hurdleRate: v })}
          />
        </div>
      </div>
    </div>
  );
}
