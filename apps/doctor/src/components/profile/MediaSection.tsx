"use client";

import { UploadDropzone } from "@/lib/uploadthing-components";

interface MediaSectionProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export default function MediaSection({ formData, setFormData }: MediaSectionProps) {
  const removeMedia = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      carousel_items: prev.carousel_items.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateMedia = (index: number, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      carousel_items: prev.carousel_items.map((item: any, i: number) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const moveMedia = (index: number, direction: "up" | "down") => {
    setFormData((prev: any) => {
      const items = [...prev.carousel_items];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
      return { ...prev, carousel_items: items };
    });
  };

  return (
    <div className="space-y-8">
      {/* Clinic Photos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Fotos de la Clinica</h3>
        <UploadDropzone
          endpoint="clinicPhotos"
          config={{ mode: "auto" }}
          onClientUploadComplete={(res) => {
            const newPhotos = res.map((file) => ({
              type: "image" as const,
              src: file.url,
              alt: file.name,
              caption: "",
            }));
            setFormData((prev: any) => ({
              ...prev,
              carousel_items: [...prev.carousel_items, ...newPhotos],
            }));
          }}
          onUploadError={(error: Error) => {
            alert(`Error al subir foto: ${error.message}`);
          }}
        />
      </div>

      {/* Videos */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Videos</h3>
        <UploadDropzone
          endpoint="doctorVideos"
          config={{ mode: "auto" }}
          onClientUploadComplete={(res) => {
            const newVideos = res.map((file) => ({
              type: "video" as const,
              src: file.url,
              alt: file.name,
              caption: "",
            }));
            setFormData((prev: any) => ({
              ...prev,
              carousel_items: [...prev.carousel_items, ...newVideos],
            }));
          }}
          onUploadError={(error: Error) => {
            alert(`Error al subir video: ${error.message}`);
          }}
        />
      </div>

      {/* Gallery */}
      {formData.carousel_items.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Multimedia Subida ({formData.carousel_items.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {formData.carousel_items.map((item: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-medium text-gray-500">
                    {item.type === "image" ? "Foto" : "Video"} #{index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveMedia(index, "up")}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs px-1"
                      title="Mover arriba"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveMedia(index, "down")}
                      disabled={index === formData.carousel_items.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs px-1"
                      title="Mover abajo"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeMedia(index)}
                      className="text-red-600 hover:text-red-700 text-xs ml-1"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {item.type === "image" ? (
                  <img src={item.src} alt={item.alt} className="w-full h-32 object-cover rounded" />
                ) : (
                  <video src={item.src} className="w-full h-32 object-cover rounded" controls />
                )}

                <input
                  type="text"
                  value={item.caption}
                  onChange={(e) => updateMedia(index, "caption", e.target.value)}
                  placeholder="Descripcion breve..."
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
