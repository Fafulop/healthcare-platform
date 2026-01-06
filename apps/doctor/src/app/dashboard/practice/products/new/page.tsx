"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Package } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

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
  tempId?: string;
  attributeValueId: number;
  quantity: number;
  attributeValue?: AttributeValue;
  calculatedCost?: number;
}

export default function NewProductPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableValues, setAvailableValues] = useState<AttributeValue[]>([]);
  const [loadingValues, setLoadingValues] = useState(true);

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
  const [manualCostMode, setManualCostMode] = useState(false);
  const [manualCost, setManualCost] = useState("");

  useEffect(() => {
    fetchAvailableValues();
  }, [session]);

  const fetchAvailableValues = async () => {
    if (!session?.user?.email) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/product-attributes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

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
    } finally {
      setLoadingValues(false);
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
      calculatedCost
    }]);

    setSelectedValueId("");
    setQuantity("1");
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const calculateTotalCost = (): number => {
    if (manualCostMode && manualCost) {
      return parseFloat(manualCost);
    }
    return components.reduce((sum, comp) => sum + (comp.calculatedCost || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      // Create product
      const productData = {
        ...formData,
        cost: calculateTotalCost().toString() // Set calculated cost
      };

      const productResponse = await fetch(`${API_URL}/api/practice-management/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(errorData.error || 'Failed to create product');
      }

      const productResult = await productResponse.json();
      const productId = productResult.data.id;

      // Add components
      for (const component of components) {
        await fetch(`${API_URL}/api/practice-management/products/${productId}/components`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            attributeValueId: component.attributeValueId,
            quantity: component.quantity
          })
        });
      }

      router.push('/dashboard/practice/products');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loadingValues) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  const totalCost = calculateTotalCost();
  const price = parseFloat(formData.price || '0');
  const margin = price > 0 ? ((price - totalCost) / price * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard/practice/products"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-green-600" />
            New Product
          </h1>
          <p className="text-gray-600 mt-2">Create a product with automatic cost calculation</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Product Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-xl shadow-lg p-6">
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Bakery, Electronics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selling Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="150.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Set your selling price (independent of cost)
                    </p>
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="pcs, kg, liter"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      name="stockQuantity"
                      value={formData.stockQuantity}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={3}
                      placeholder="Product description..."
                    />
                  </div>
                </div>
              </div>

              {/* Bill of Materials */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Bill of Materials (BOM)</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualCostMode}
                      onChange={(e) => {
                        setManualCostMode(e.target.checked);
                        if (e.target.checked) {
                          setManualCost(calculateTotalCost().toString());
                        }
                      }}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Manual Cost Entry</span>
                  </label>
                </div>

                {/* Manual Cost Input */}
                {manualCostMode ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Manual Cost (Override BOM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualCost}
                      onChange={(e) => setManualCost(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter cost manually..."
                    />
                    <p className="text-xs text-blue-700 mt-2">
                      💡 Manual mode: Enter cost directly. BOM components will be ignored for cost calculation.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Add Component */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <select
                        value={selectedValueId}
                        onChange={(e) => setSelectedValueId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        onClick={addComponent}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                    {/* Components List */}
                    <div className="space-y-2">
                      {components.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">
                          No components yet. Add components to automatically calculate cost, or use manual cost entry.
                        </p>
                      ) : (
                        components.map((comp, index) => (
                          <div key={comp.tempId || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {comp.attributeValue?.attribute.name}: {comp.attributeValue?.value}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {comp.quantity} {comp.attributeValue?.unit} × ${comp.attributeValue?.cost || 0} = ${comp.calculatedCost?.toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeComponent(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              {/* Cost Summary */}
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Components</span>
                    <span className="font-semibold text-gray-900">{components.length}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Total Cost</span>
                    <div className="text-right">
                      <span className="font-semibold text-lg text-gray-900">${totalCost.toFixed(2)}</span>
                      {manualCostMode && (
                        <div className="text-xs text-blue-600">Manual</div>
                      )}
                      {!manualCostMode && components.length > 0 && (
                        <div className="text-xs text-green-600">Auto-calculated</div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-600">Selling Price</span>
                    <span className="font-semibold text-lg text-green-600">${price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Profit Margin</span>
                    <span className={`font-semibold text-lg ${parseFloat(margin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {margin}%
                    </span>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="mt-6 space-y-2">
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Create Product
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
    </div>
  );
}
