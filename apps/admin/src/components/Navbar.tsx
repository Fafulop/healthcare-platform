import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition">
          <span className="text-xl font-bold text-blue-600">Healthcare Admin</span>
        </Link>

        <div className="flex items-center space-x-4">
          <Link
            href="/doctors/new"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Nuevo Doctor
          </Link>
          <Link
            href="/doctors"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Ver Doctores
          </Link>
          <Link
            href="/llm-usage"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Uso IA
          </Link>
          <Link
            href="/guides"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Guías
          </Link>
          <Link
            href="/settings"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Configuracion
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}
