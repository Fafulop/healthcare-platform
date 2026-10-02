import { VentasComprasTabs } from "@/components/practice/VentasComprasTabs";

// La barra de pestañas de «Ventas/Compras» sólo se pinta en las listas de Ventas, Compras y
// Productos y Servicios; en el resto de `practice/` (Flujo de Dinero, Conciliación, detalles…)
// `VentasComprasTabs` devuelve null y este layout no agrega nada.
export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VentasComprasTabs />
      {children}
    </>
  );
}
