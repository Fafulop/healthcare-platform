"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Package, Edit2 } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface AttributeValue {
  id: number;
  value: string;
  cost: string | null;
  unit: string | null;
  attribute: {
    id: number;
    name: string;
  };
}

interface Component {
  id?: number;
  tempId?: string;
  attributeValueId: number;
  quantity: number;
  attributeValue?: AttributeValue;
  calculatedCost?: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  price: string | null;
  cost: string | null;
  stockQuantity: number | null;
  unit: string | null;
  status: string;
  components: any[];
}

export default function EditProductPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableValues, setAvailableValues] = useState<AttributeValue[]>([]);
  const [product, setProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    price: "",
    cost: "",
    stockQuantity: "",
    unit: "",
    status: "active"
  });

  const [components, setComponents] = useState<Component[]>([]);
  const [selectedValueId, setSelectedValueId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [editingComponentId, setEditingComponentId] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
    fetchProduct();
    fetchAvailableValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

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

  const fetchProduct = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/products/${productId}`);

      if (!response.ok) throw new Error('Failed to fetch product');

      const result = await response.json();
      const productData = result.data;

      setProduct(productData);
      setFormData({
        name: productData.name,
        sku: productData.sku || "",
        category: productData.category || "",
        description: productData.description || "",
        price: productData.price || "",
        cost: productData.cost || "",
        stockQuantity: productData.stockQuantity?.toString() || "",
        unit: productData.unit || "",
        status: productData.status
      });

      setComponents(productData.components.map((comp: any) => ({
        id: comp.id,
        attributeValueId: comp.attributeValueId,
        quantity: parseFloat(comp.quantity),
        attributeValue: comp.attributeValue,
        calculatedCost: parseFloat(comp.calculatedCost),
        isNew: false,
        isDeleted: false
      })));

    } catch (err: any) {
      console.error('Error fetching product:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableValues = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/product-attributes`);

      if (!response.ok) throw new Error('Failed to fetch master data');

      const result = await response.json();
      const allValues: AttributeValue[] = [];

      result.data.forEach((attr: any) => {
        attr.values.forEach((val: any) => {
          allValues.push({
            ...val,
            attribute: { id: attr.id, name: attr.name }
          });
        });
      });

      setAvailableValues(allValues);
    } catch (err: any) {
      console.error('Error fetching master data:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const addComponent = () => {
    if (!selectedValueId) return;

    const valueId = parseInt(selectedValueId);
    const qty = parseFloat(quantity);

    if (qty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    const selectedValue = availableValues.find(v => v.id === valueId);
    if (!selectedValue) return;

    const cost = parseFloat(selectedValue.cost || '0');
    const calculatedCost = cost * qty;

    setComponents([...components, {
      tempId: `temp-${Date.now()}`,
      attributeValueId: valueId,
      quantity: qty,
      attributeValue: selectedValue,
      calculatedCost,
      isNew: true,
      isDeleted: false
    }]);

    setSelectedValueId("");
    setQuantity("1");
  };

  const startEditingComponent = (comp: Component) => {
    if (comp.id) {
      setEditingComponentId(comp.id);
      setEditingQuantity(comp.quantity.toString());
    }
  };

  const saveComponentQuantity = (comp: Component) => {
    const newQty = parseFloat(editingQuantity);
    if (newQty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    const cost = parseFloat(comp.attributeValue?.cost || '0');
    const newCalculatedCost = cost * newQty;

    setComponents(components.map(c =>
      c.id === comp.id
        ? { ...c, quantity: newQty, calculatedCost: newCalculatedCost }
        : c
    ));

    setEditingComponentId(null);
    setEditingQuantity("");
  };

  const cancelEditingComponent = () => {
    setEditingComponentId(null);
    setEditingQuantity("");
  };

  const removeComponent = (comp: Component) => {
    if (comp.isNew) {
      // Remove new components immediately
      setComponents(components.filter(c => c.tempId !== comp.tempId));
    } else {
      // Mark existing components as deleted
      setComponents(components.map(c =>
        c.id === comp.id ? { ...c, isDeleted: true } : c
      ));
    }
  };

  const calculateTotalCost = (): number => {
    return components
      .filter(c => !c.isDeleted)
      .reduce((sum, comp) => sum + (comp.calculatedCost || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      // Update product
      const productData = {
        ...formData,
        cost: calculateTotalCost().toString()
      };

      const productResponse = await authFetch(`${API_URL}/api/practice-management/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      // Handle component changes
      for (const component of components) {
        if (component.isDeleted && component.id) {
          // Delete component
          await authFetch(`${API_URL}/api/practice-management/products/${productId}/components/${component.id}`, {
            method: 'DELETE'
          });
        } else if (component.isNew) {
          // Add new component
          await authFetch(`${API_URL}/api/practice-management/products/${productId}/components`, {
            method: 'POST',
            body: JSON.stringify({
              attributeValueId: component.attributeValueId,
              quantity: component.quantity
            })
          });
        } else if (component.id && !component.isNew) {
          // Update existing component if quantity changed
          const originalComp = product?.components.find((c: any) => c.id === component.id);
          if (originalComp && parseFloat(originalComp.quantity) !== component.quantity) {
            await authFetch(`${API_URL}/api/practice-management/products/${productId}/components/${component.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                quantity: component.quantity
              })
            });
          }
        }
      }

      router.push('/dashboard/practice/products');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h2>
          <Link
            href="/dashboard/practice/products"
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const totalCost = calculateTotalCost();
  const price = parseFloat(formData.price || '0');
  const margin = price > 0 ? ((price - totalCost) / price * 100).toFixed(1) : '0';
  const activeComponents = components.filter(c => !c.isDeleted);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Link
            href="/dashboard/practice/products"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            Edit Product
          </h1>
          <p className="text-gray-600 mt-2">Update product information and bill of materials</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Product Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Sweet Bread"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SKU / Product Code
                    </label>
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., PD-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Bakery, Electronics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selling Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="150.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit of Measure
                    </label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="pcs, kg, liter"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stock
                    </label>
                    <input
                      type="number"
                      name="stockQuantity"
                      value={formData.stockQuantity}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Product description..."
                    />
                  </div>
                </div>
              </div>

              {/* Bill of Materials */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Bill of Materials (BOM)</h2>

                {/* Add Component */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <select
                        value={selectedValueId}
                        onChange={(e) => setSelectedValueId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a component...</option>
                        {availableValues.map(val => (
                          <option key={val.id} value={val.id}>
                            {val.attribute.name}: {val.value}
                            {val.cost && ` - $${val.cost}`}
                            {val.unit && ` per ${val.unit}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        onClick={addComponent}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Components List */}
                <div className="space-y-2">
                  {activeComponents.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No components. Add components to calculate cost.
                    </p>
                  ) : (
                    activeComponents.map((comp, index) => (
                      <div key={comp.id || comp.tempId || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {comp.attributeValue?.attribute.name}: {comp.attributeValue?.value}
                            {comp.isNew && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">New</span>
                            )}
                          </div>
                          {editingComponentId === comp.id ? (
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                type="number"
                                step="0.0001"
                                value={editingQuantity}
                                onChange={(e) => setEditingQuantity(e.target.value)}
                                className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
                                autoFocus
                              />
                              <span className="text-sm text-gray-600">{comp.attributeValue?.unit}</span>
                              <button
                                type="button"
                                onClick={() => saveComponentQuantity(comp)}
                                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingComponent}
                                className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 mt-1">
                              {comp.quantity} {comp.attributeValue?.unit} × ${comp.attributeValue?.cost || 0} = ${comp.calculatedCost?.toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!comp.isNew && editingComponentId !== comp.id && (
                            <button
                              type="button"
                              onClick={() => startEditingComponent(comp)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit quantity"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeComponent(comp)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove component"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              {/* Cost Summary */}
              <div className="bg-white rounded-lg shadow p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Components</span>
                    <span className="font-semibold text-gray-900">{activeComponents.length}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Total Cost</span>
                    <span className="font-semibold text-lg text-gray-900">${totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Selling Price</span>
                    <span className="font-semibold text-lg text-blue-600">${price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Profit Margin</span>
                    <span className={`font-semibold text-lg ${parseFloat(margin) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {margin}%
                    </span>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="mt-6 space-y-2">
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Update Product
                      </>
                    )}
                  </button>
                  <Link
                    href="/dashboard/practice/products"
                    className="block text-center w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </form>
    </div>
  );
}
