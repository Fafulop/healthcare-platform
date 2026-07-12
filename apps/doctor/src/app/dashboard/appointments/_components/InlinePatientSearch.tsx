"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
}

interface Props {
  onSelect: (patient: { id: string; firstName: string; lastName: string }) => void;
}

export function InlinePatientSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/medical-records/patients?search=${encodeURIComponent(query)}&status=active`
        );
        const data = await res.json();
        if (data.data) {
          setResults((data.data ?? []).slice(0, 5));
          setOpen(true);
        }
      } catch {
        // silently ignore search errors
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (patient: PatientResult) => {
    onSelect({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName });
    setQuery("");
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative w-40">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar paciente..."
          className="w-full text-xs pl-6 pr-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
          {results.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">Sin resultados</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onMouseDown={() => handleSelect(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col gap-0.5"
              >
                <span className="text-xs font-medium text-gray-800">
                  {p.firstName} {p.lastName}
                </span>
                {p.phone && (
                  <span className="text-xs text-gray-400">{p.phone}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
      {loading && (
        <div className="absolute z-50 top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2">
          <span className="text-xs text-gray-400">Buscando...</span>
        </div>
      )}
    </div>
  );
}
