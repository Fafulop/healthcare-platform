"use client";

import { useSession } from "next-auth/react";
import { redirect, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, Loader2, Package, Download, FileText } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
}

interface Supplier {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
}

interface Quotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
}

interface PurchaseItem {
  id: number;
  description: string;
  sku: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
}

interface Purchase {
  id: number;
  purchaseNumber: string;
  purchaseDate: string;
  deliveryDate: string | null;
  status: string;
  paymentStatus: string;
  subtotal: string;
  taxRate: string | null;
  tax: string | null;
  total: string;
  amountPaid: string;
  notes: string | null;
  termsAndConditions: string | null;
  supplier: Supplier;
  quotation: Quotation | null;
  items: PurchaseItem[];
}

const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  PROCESSING: { label: 'En Proceso', color: 'bg-purple-100 text-purple-800', icon: '⚙️' },
  SHIPPED: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: '📦' },
  RECEIVED: { label: 'Recibida', color: 'bg-green-100 text-green-800', icon: '✅' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
};

const paymentStatusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-red-100 text-red-800', icon: '💵' },
  PARTIAL: { label: 'Pago Parcial', color: 'bg-orange-100 text-orange-800', icon: '💰' },
  PAID: { label: 'Pagada', color: 'bg-green-100 text-green-800', icon: '✅' }
};

export default function ViewPurchasePage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const params = useParams();
  const purchaseId = params.id as string;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
  }, [session]);

  useEffect(() => {
    if (purchaseId) {
      fetchPurchase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const fetchPurchase = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`);

      if (!response.ok) throw new Error('Error al cargar la compra');

      const result = await response.json();
      setPurchase(result.data);
    } catch (err: any) {
      console.error('Error al cargar compra:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Compra no encontrada</h2>
          <Link
            href="/dashboard/practice/compras"
            className="text-blue-600 hover:text-blue-700"
          >
            Volver a Compras
          </Link>
        </div>
      </div>
    );
  }

  const statusConf = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const paymentConf = paymentStatusConfig[purchase.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;
  const balanceDue = parseFloat(purchase.total) - parseFloat(purchase.amountPaid);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Link
            href="/dashboard/practice/compras"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Compras
          </Link>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                Compra {purchase.purchaseNumber}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusConf.color}`}>
                  {statusConf.icon} {statusConf.label}
                </span>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${paymentConf.color}`}>
                  {paymentConf.icon} {paymentConf.label}
                </span>
              </div>
              {purchase.quotation && (
                <Link
                  href={`/dashboard/practice/cotizaciones/${purchase.quotation.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <FileText className="w-4 h-4" />
                  Generada desde cotización {purchase.quotation.quotationNumber}
                </Link>
              )}
            </div>

            <div className="flex gap-2">
              <Link
                href={`/dashboard/practice/compras/${purchase.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </Link>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Descargar PDF (próximamente)"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Purchase Document */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Document Header */}
          <div className="bg-blue-600 text-white p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold">ORDEN DE COMPRA</h2>
              <p className="text-blue-100 mt-2">Folio: {purchase.purchaseNumber}</p>
            </div>
          </div>

          <div className="p-8">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm text-gray-600">Fecha de compra</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(purchase.purchaseDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha de entrega</p>
                <p className="text-lg font-semibold text-gray-900">
                  {purchase.deliveryDate ? formatDate(purchase.deliveryDate) : 'No especificada'}
                </p>
              </div>
            </div>

            {/* Client Information */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">PROVEEDOR</h3>
              <div className="space-y-2">
                <p className="text-xl font-bold text-gray-900">{purchase.supplier.businessName}</p>
                {purchase.supplier.contactName && (
                  <p className="text-gray-700">Contacto: {purchase.supplier.contactName}</p>
                )}
                {purchase.supplier.email && (
                  <p className="text-gray-700">Email: {purchase.supplier.email}</p>
                )}
                {purchase.supplier.phone && (
                  <p className="text-gray-700">Teléfono: {purchase.supplier.phone}</p>
                )}
                {purchase.supplier.rfc && (
                  <p className="text-gray-700">RFC: {purchase.supplier.rfc}</p>
                )}
                {purchase.supplier.street && (
                  <p className="text-gray-700">
                    {purchase.supplier.street}, {purchase.supplier.city}, {purchase.supplier.state} {purchase.supplier.postalCode}
                  </p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">PRODUCTOS Y SERVICIOS</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Descripción</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Cant.</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Unidad</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">P. Unit.</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Desc. %</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">IVA %</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item, index) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-3 text-gray-900">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          {item.sku && (
                            <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900">{parseFloat(item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{item.unit || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.discountRate ? `${(parseFloat(item.discountRate) * 100).toFixed(0)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.taxRate ? `${(parseFloat(item.taxRate) * 100).toFixed(0)}%` : '16%'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-full md:w-1/2">
                <div className="space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(purchase.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">IVA Total:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(purchase.tax || 0)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-gray-300">
                    <span className="text-lg font-bold text-gray-900">TOTAL:</span>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(purchase.total)}</span>
                  </div>

                  {/* Payment Information */}
                  {parseFloat(purchase.amountPaid) > 0 && (
                    <>
                      <div className="flex justify-between py-2 border-t border-gray-200">
                        <span className="text-gray-700">Monto Pagado:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(purchase.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-700">Saldo Pendiente:</span>
                        <span className={`font-semibold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(balanceDue)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Notes and Terms */}
            {(purchase.notes || purchase.termsAndConditions) && (
              <div className="space-y-4 border-t pt-6">
                {purchase.notes && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Notas:</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{purchase.notes}</p>
                  </div>
                )}
                {purchase.termsAndConditions && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Términos y Condiciones:</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{purchase.termsAndConditions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
