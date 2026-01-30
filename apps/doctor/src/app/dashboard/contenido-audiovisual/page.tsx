"use client";

import { Video } from "lucide-react";

export default function ContenidoAudiovisualPage() {
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
          <Video className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
          Contenido Audiovisual
        </h1>
        <p className="text-gray-500 text-lg">Próximamente</p>
        <p className="text-gray-400 mt-2 text-sm">
          Aquí podrás gestionar tu contenido multimedia para pacientes y redes sociales.
        </p>
      </div>
    </div>
  );
}
