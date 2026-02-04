"use client";

interface FaqsSocialSectionProps {
  formData: any;
  updateField: (field: string, value: any) => void;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export default function FaqsSocialSection({ formData, updateField, setFormData }: FaqsSocialSectionProps) {
  // FAQ helpers
  const addFAQ = () => {
    setFormData((prev: any) => ({
      ...prev,
      faqs: [...prev.faqs, { question: "", answer: "" }],
    }));
  };

  const removeFAQ = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      faqs: prev.faqs.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateFAQ = (index: number, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      faqs: prev.faqs.map((faq: any, i: number) =>
        i === index ? { ...faq, [field]: value } : faq
      ),
    }));
  };

  return (
    <div className="space-y-8">
      {/* FAQs */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Preguntas Frecuentes ({formData.faqs.length})
          </h3>
          <button
            onClick={addFAQ}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Agregar FAQ
          </button>
        </div>

        {formData.faqs.length === 0 ? (
          <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg text-sm">
            No hay preguntas frecuentes.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.faqs.map((faq: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-700 text-sm">FAQ {index + 1}</h4>
                  <button
                    onClick={() => removeFAQ(index)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pregunta *</label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => updateFAQ(index, "question", e.target.value)}
                    placeholder="Cual es el costo de la consulta?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Respuesta *</label>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                    placeholder="El costo es..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Social Links */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Redes Sociales</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
            <input
              type="url"
              value={formData.social_links?.linkedin || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...formData.social_links,
                  linkedin: e.target.value,
                })
              }
              placeholder="https://linkedin.com/in/tu-perfil"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Twitter / X</label>
            <input
              type="url"
              value={formData.social_links?.twitter || ""}
              onChange={(e) =>
                updateField("social_links", {
                  ...formData.social_links,
                  twitter: e.target.value,
                })
              }
              placeholder="https://twitter.com/tu-perfil"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
