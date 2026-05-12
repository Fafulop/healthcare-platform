"use client";

import type { PortfolioParams } from "../../lib/types";

interface Props {
  params: PortfolioParams;
  onChange: (params: PortfolioParams) => void;
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
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  );
}

const fmtMXN = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number) => `${v}`;

export default function PortfolioParamPanel({ params, onChange }: Props) {
  const set = (key: keyof PortfolioParams, value: number) =>
    onChange({ ...params, [key]: value });

  return (
    <div className="space-y-5">
      {/* Loan Profile */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Perfil del Prestamo
        </h3>
        <div className="space-y-3">
          <SliderRow label="Monto Promedio" value={params.avgLoanSize} min={25000} max={500000} step={25000} format={fmtMXN} onChange={(v) => set("avgLoanSize", v)} />
          <SliderRow label="Plazo Promedio (meses)" value={params.avgTermMonths} min={6} max={48} step={6} format={fmtNum} onChange={(v) => set("avgTermMonths", v)} />
          <SliderRow label="Tasa Promedio" value={params.avgRate} min={0.18} max={0.48} step={0.01} format={fmtPct} onChange={(v) => set("avgRate", v)} />
        </div>
      </div>

      {/* Origination */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Originacion
        </h3>
        <div className="space-y-3">
          <SliderRow label="Prestamos Nuevos / Mes" value={params.monthlyOriginationRate} min={1} max={50} step={1} format={fmtNum} onChange={(v) => set("monthlyOriginationRate", v)} />
          <SliderRow label="Comision Apertura" value={params.originationFeeRate} min={0} max={0.05} step={0.005} format={fmtPct} onChange={(v) => set("originationFeeRate", v)} />
        </div>
      </div>

      {/* Funding & Risk */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Fondeo y Riesgo
        </h3>
        <div className="space-y-3">
          <SliderRow label="Costo de Fondeo (CoF)" value={params.cofRate} min={0.06} max={0.22} step={0.005} format={fmtPct} onChange={(v) => set("cofRate", v)} />
          <SliderRow label="Tasa de Default" value={params.blendedDefaultRate} min={0.01} max={0.15} step={0.005} format={fmtPct} onChange={(v) => set("blendedDefaultRate", v)} />
          <SliderRow label="Tasa de Recuperacion" value={params.recoveryRate} min={0} max={0.60} step={0.05} format={fmtPct} onChange={(v) => set("recoveryRate", v)} />
        </div>
      </div>

      {/* Costs */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Costos Operativos
        </h3>
        <div className="space-y-3">
          <SliderRow label="Costo por Originacion" value={params.originationCostPerLoan} min={500} max={5000} step={250} format={fmtMXN} onChange={(v) => set("originationCostPerLoan", v)} />
          <SliderRow label="Servicing Anual / Prestamo" value={params.annualServicingCostPerLoan} min={200} max={3000} step={100} format={fmtMXN} onChange={(v) => set("annualServicingCostPerLoan", v)} />
          <SliderRow label="Costos Fijos Mensuales" value={params.fixedMonthlyCosts} min={0} max={500000} step={10000} format={fmtMXN} onChange={(v) => set("fixedMonthlyCosts", v)} />
        </div>
      </div>

      {/* Projection */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Proyeccion
        </h3>
        <SliderRow label="Meses a Proyectar" value={params.projectionMonths} min={12} max={60} step={6} format={(v) => `${v} meses`} onChange={(v) => set("projectionMonths", v)} />
      </div>
    </div>
  );
}
