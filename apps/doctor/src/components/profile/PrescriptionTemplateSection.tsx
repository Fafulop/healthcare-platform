'use client';

import { useState, useEffect } from 'react';
import { Loader2, X, Save, Check, Plus } from 'lucide-react';
import { UploadButton } from '@/lib/uploadthing-components';

interface Credential {
  titulo: string;
  cedula: string;
}

const COLOR_SCHEMES = [
  { id: 'blue',   label: 'Azul médico',        hex: '#1e40af' },
  { id: 'green',  label: 'Verde salud',         hex: '#15803d' },
  { id: 'purple', label: 'Morado profesional',  hex: '#7c3aed' },
  { id: 'red',    label: 'Rojo clásico',        hex: '#b91c1c' },
  { id: 'gray',   label: 'Gris neutro',         hex: '#374151' },
  { id: 'none',   label: 'Sin color',           hex: null },
];

export default function PrescriptionTemplateSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState('blue');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [doctorName, setDoctorName] = useState('');
  const [specialtyHint, setSpecialtyHint] = useState('');

  useEffect(() => {
    fetch('/api/prescription-template')
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setLogoUrl(data.data.prescriptionLogoUrl || null);
          setSignatureUrl(data.data.prescriptionSignatureUrl || null);
          setColorScheme(data.data.prescriptionColorScheme || 'blue');
          setDoctorName(data.data.doctorFullName || '');
          const specialties = [data.data.primarySpecialty, ...(data.data.subspecialties || [])].filter(Boolean);
          setSpecialtyHint(specialties.join(' · '));
          const saved = data.data.prescriptionCredentials;
          if (Array.isArray(saved) && saved.length > 0) {
            setCredentials(saved);
          } else {
            // Seed a starting point from the public profile so the doctor only
            // fills in cédula numbers instead of building the list from zero.
            const seed: Credential[] = [
              { titulo: 'Médico Cirujano', cedula: data.data.cedulaProfesional || '' },
            ];
            if (data.data.primarySpecialty) {
              seed.push({ titulo: `Especialidad en ${data.data.primarySpecialty}`, cedula: '' });
            }
            setCredentials(seed);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateCredential = (index: number, patch: Partial<Credential>) => {
    setCredentials((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCredential = (index: number) => {
    setCredentials((prev) => prev.filter((_, i) => i !== index));
  };

  const addCredential = () => {
    setCredentials((prev) => (prev.length >= 8 ? prev : [...prev, { titulo: '', cedula: '' }]));
  };

  const handleSave = async () => {
    // Only fully-filled rows are saved; drop half-empty leftovers silently
    const cleaned = credentials
      .map((c) => ({ titulo: c.titulo.trim(), cedula: c.cedula.trim() }))
      .filter((c) => c.titulo && c.cedula);
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/prescription-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl, signatureUrl, colorScheme, credentials: cleaned }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaveMessage({ type: 'success', text: 'Plantilla guardada correctamente.' });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch {
      setSaveMessage({ type: 'error', text: 'Error al guardar la plantilla.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Plantilla de Receta</h2>
        <p className="text-sm text-gray-500 mt-1">
          Personaliza el diseño del PDF de tus recetas médicas. Los cambios aplican a todas las recetas nuevas.
        </p>
      </div>

      {/* Doctor identity: credentials shown on every receta */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Identidad del médico</h3>
        <p className="text-xs text-gray-500 mb-3">
          Estos datos aparecen en TODAS tus recetas (encabezado y pie del PDF): tu nombre, y cada
          título con su cédula profesional (médico general, especialidad, subespecialidad).
        </p>
        <div className="mb-3 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-sm font-medium text-gray-900">{doctorName || '(sin nombre en el perfil)'}</p>
          {specialtyHint && <p className="text-xs text-gray-500">{specialtyHint}</p>}
        </div>
        <div className="space-y-2">
          {credentials.map((cred, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={cred.titulo}
                onChange={(e) => updateCredential(i, { titulo: e.target.value })}
                placeholder='Título (ej. "Especialidad en Cardiología")'
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <input
                type="text"
                value={cred.cedula}
                onChange={(e) => updateCredential(i, { cedula: e.target.value })}
                placeholder="Cédula"
                className="w-36 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => removeCredential(i)}
                className="p-1.5 text-gray-400 hover:text-red-600"
                title="Eliminar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {credentials.length < 8 && (
          <button
            onClick={addCredential}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Agregar cédula
          </button>
        )}
        {credentials.every((c) => !c.titulo.trim() || !c.cedula.trim()) && (
          <p className="mt-2 text-xs text-amber-700">
            ⚠️ Sin al menos una cédula completa, las recetas nuevas te pedirán capturar los datos a mano.
          </p>
        )}
      </div>

      {/* Color scheme */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Color del diseño</h3>
        <div className="flex flex-wrap gap-3">
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => setColorScheme(scheme.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                colorScheme === scheme.id
                  ? 'border-blue-500 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-md ${!scheme.hex ? 'border-2 border-dashed border-gray-300 bg-white' : ''}`}
                style={scheme.hex ? { backgroundColor: scheme.hex } : undefined}
              />
              <span className="text-xs text-gray-600 whitespace-nowrap">{scheme.label}</span>
              {colorScheme === scheme.id && <Check className="w-3.5 h-3.5 text-blue-600 -mt-0.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Logo del consultorio</h3>
        <p className="text-xs text-gray-500 mb-3">
          Aparece en la esquina superior izquierda del PDF. Recomendado: PNG con fondo transparente, cuadrado.
        </p>
        {logoUrl && (
          <div className="mb-3 flex items-start gap-3">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-16 w-auto max-w-[120px] border border-gray-200 rounded-md object-contain bg-gray-50 p-1"
            />
            <button
              onClick={() => setLogoUrl(null)}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 mt-1"
            >
              <X className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        )}
        <UploadButton
          endpoint="prescriptionLogo"
          onClientUploadComplete={(res) => {
            if (res?.[0]) setLogoUrl(res[0].ufsUrl);
          }}
          onUploadError={(err) => console.error('Logo upload error:', err)}
        />
      </div>

      {/* Signature */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Firma del médico</h3>
        <p className="text-xs text-gray-500 mb-3">
          Aparece en el pie de página del PDF. Recomendado: fondo blanco o transparente, horizontal.
        </p>
        {signatureUrl && (
          <div className="mb-3 flex items-start gap-3">
            <img
              src={signatureUrl}
              alt="Firma"
              className="h-16 w-auto max-w-[180px] border border-gray-200 rounded-md object-contain bg-gray-50 p-1"
            />
            <button
              onClick={() => setSignatureUrl(null)}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 mt-1"
            >
              <X className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        )}
        <UploadButton
          endpoint="prescriptionSignature"
          onClientUploadComplete={(res) => {
            if (res?.[0]) setSignatureUrl(res[0].ufsUrl);
          }}
          onUploadError={(err) => console.error('Signature upload error:', err)}
        />
      </div>

      {/* Layout preview note */}
      {(() => {
        const activeHex = COLOR_SCHEMES.find((s) => s.id === colorScheme)?.hex;
        return (
          <div
            className="rounded-lg p-4 text-sm"
            style={{
              backgroundColor: activeHex ? `${activeHex}15` : '#f9fafb',
              borderColor: activeHex ? `${activeHex}40` : '#d1d5db',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          >
            <p className="font-medium mb-1" style={{ color: activeHex || '#374151' }}>
              Vista previa del diseño
            </p>
            <p className="text-gray-600 text-xs leading-relaxed">
              {colorScheme === 'none'
                ? 'El PDF usará un diseño sin color: encabezado y pie con bordes, texto en negro. Ideal para papel membretado o impresión en blanco y negro.'
                : 'El PDF tendrá una banda de color en el encabezado con el logo (si está configurado), el texto "RECETA MÉDICA", el nombre del doctor y la cédula. En el pie de página se mostrará la firma y los datos del médico sobre otra banda del mismo color.'}
            </p>
          </div>
        );
      })()}

      {/* Save */}
      {saveMessage && (
        <p className={`text-sm font-medium ${saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
          {saveMessage.text}
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Guardando...' : 'Guardar Plantilla'}
      </button>
    </div>
  );
}
