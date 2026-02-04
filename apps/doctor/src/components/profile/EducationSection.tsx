"use client";

import { UploadDropzone } from "@/lib/uploadthing-components";

interface EducationSectionProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export default function EducationSection({ formData, setFormData }: EducationSectionProps) {
  // Education helpers
  const addEducation = () => {
    setFormData((prev: any) => ({
      ...prev,
      education_items: [
        ...prev.education_items,
        { institution: "", program: "", year: "", notes: "" },
      ],
    }));
  };

  const removeEducation = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      education_items: prev.education_items.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateEducation = (index: number, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      education_items: prev.education_items.map((edu: any, i: number) =>
        i === index ? { ...edu, [field]: value } : edu
      ),
    }));
  };

  // Certificate helpers
  const removeCertificate = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      certificate_images: prev.certificate_images.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateCertificate = (index: number, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      certificate_images: prev.certificate_images.map((cert: any, i: number) =>
        i === index ? { ...cert, [field]: value } : cert
      ),
    }));
  };

  return (
    <div className="space-y-8">
      {/* Education Items */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Formacion Academica ({formData.education_items.length})
          </h3>
          <button
            onClick={addEducation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Agregar
          </button>
        </div>

        {formData.education_items.length === 0 ? (
          <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg text-sm">
            No hay formacion registrada.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.education_items.map((edu: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-700 text-sm">Estudio {index + 1}</h4>
                  <button
                    onClick={() => removeEducation(index)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institucion *</label>
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={(e) => updateEducation(index, "institution", e.target.value)}
                    placeholder="Universidad de Guadalajara"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Programa / Titulo *</label>
                  <input
                    type="text"
                    value={edu.program}
                    onChange={(e) => updateEducation(index, "program", e.target.value)}
                    placeholder="Medico Cirujano"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
                    <input
                      type="text"
                      value={edu.year}
                      onChange={(e) => updateEducation(index, "year", e.target.value)}
                      placeholder="2010"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <input
                      type="text"
                      value={edu.notes}
                      onChange={(e) => updateEducation(index, "notes", e.target.value)}
                      placeholder="Con honores"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificates */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Certificados y Diplomas ({formData.certificate_images.length})
        </h3>

        <UploadDropzone
          endpoint="doctorCertificates"
          onClientUploadComplete={(res) => {
            const newCerts = res.map((file) => ({
              src: file.url,
              alt: file.name,
              issued_by: "",
              year: "",
            }));
            setFormData((prev: any) => ({
              ...prev,
              certificate_images: [...prev.certificate_images, ...newCerts],
            }));
          }}
          onUploadError={(error: Error) => {
            alert(`Error al subir certificado: ${error.message}`);
          }}
        />

        {formData.certificate_images.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {formData.certificate_images.map((cert: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-700">Certificado {index + 1}</span>
                  <button
                    onClick={() => removeCertificate(index)}
                    className="text-red-600 hover:text-red-700 text-xs"
                  >
                    Eliminar
                  </button>
                </div>
                <img src={cert.src} alt={cert.alt} className="w-full h-36 object-cover rounded border" />
                <input
                  type="text"
                  value={cert.alt}
                  onChange={(e) => updateCertificate(index, "alt", e.target.value)}
                  placeholder="Descripcion"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={cert.issued_by}
                    onChange={(e) => updateCertificate(index, "issued_by", e.target.value)}
                    placeholder="Emitido Por"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={cert.year}
                    onChange={(e) => updateCertificate(index, "year", e.target.value)}
                    placeholder="Ano"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
