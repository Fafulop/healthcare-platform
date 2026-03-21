'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (name: string) => void;
  subtemas: { id: string; name: string }[];
  disabled: boolean;
}

export function SubtemaCombobox({ value, onChange, subtemas, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = subtemas.filter((s) =>
    s.name.toLowerCase().includes(value.toLowerCase())
  );
  const exactMatch = subtemas.some(
    (s) => s.name.toLowerCase() === value.toLowerCase()
  );
  const showCreate = value.trim() !== '' && !exactMatch;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Subtema (opcional)"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      {!disabled && open && (filtered.length > 0 || showCreate) && (
        <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-md max-h-44 overflow-y-auto">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.name);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
              >
                {s.name}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(value.trim());
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-500 italic"
              >
                Crear &ldquo;{value.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
