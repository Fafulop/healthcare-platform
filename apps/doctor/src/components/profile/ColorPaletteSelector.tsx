"use client";

import { useState } from "react";
import { COLOR_PALETTES, type ColorPalette } from "@healthcare/types";

interface ColorPaletteSelectorProps {
  currentPaletteId: string;
  onSelect: (paletteId: string) => void;
  isModal?: boolean;
}

export default function ColorPaletteSelector({
  currentPaletteId,
  onSelect,
  isModal = false,
}: ColorPaletteSelectorProps) {
  const [selectedId, setSelectedId] = useState(currentPaletteId);

  const handleSelect = (paletteId: string) => {
    setSelectedId(paletteId);
    if (!isModal) {
      onSelect(paletteId);
    }
  };

  const handleConfirm = () => {
    onSelect(selectedId);
  };

  const palettes = Object.values(COLOR_PALETTES);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Seleccionar Paleta de Colores
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {palettes.map((palette) => (
          <button
            key={palette.id}
            onClick={() => handleSelect(palette.id)}
            className={`
              relative p-4 rounded-lg border-2 transition-all text-left
              ${
                selectedId === palette.id
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }
            `}
          >
            {/* Selected indicator */}
            {selectedId === palette.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}

            {/* Palette name and type */}
            <div className="mb-3">
              <h4 className="font-semibold text-gray-900">{palette.name}</h4>
              <p className="text-xs text-gray-500">
                {palette.type === "single" ? "Color unico" : "Dos colores"}
              </p>
            </div>

            {/* Color swatches */}
            <div className="flex gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-md border border-gray-200 shadow-sm"
                style={{ backgroundColor: palette.colors.primary }}
                title={`Primary: ${palette.colors.primary}`}
              />
              <div
                className="w-8 h-8 rounded-md border border-gray-200 shadow-sm"
                style={{ backgroundColor: palette.colors.secondary }}
                title={`Secondary: ${palette.colors.secondary}`}
              />
              <div
                className="w-8 h-8 rounded-md border border-gray-200 shadow-sm"
                style={{ backgroundColor: palette.colors.accent }}
                title={`Accent: ${palette.colors.accent}`}
              />
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600">{palette.description}</p>
          </button>
        ))}
      </div>

      {isModal && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={() => onSelect(currentPaletteId)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}
