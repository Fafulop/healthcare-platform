"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, DollarSign, Percent, Info, Loader2 } from "lucide-react";

interface CreateSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onSuccess: () => void;
}

export default function CreateSlotsModal({
  isOpen,
  onClose,
  doctorId,
  onSuccess,
}: CreateSlotsModalProps) {
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [duration, setDuration] = useState<30 | 60>(60);
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [basePrice, setBasePrice] = useState("");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSlots, setPreviewSlots] = useState<number>(0);

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Calculate preview of slots to be created
  useEffect(() => {
    if (!startTime || !endTime || !duration) {
      setPreviewSlots(0);
      return;
    }

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const [breakStartH, breakStartM] = hasBreak ? breakStart.split(":").map(Number) : [0, 0];
    const [breakEndH, breakEndM] = hasBreak ? breakEnd.split(":").map(Number) : [0, 0];

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const breakStartMinutes = hasBreak ? breakStartH * 60 + breakStartM : 0;
    const breakEndMinutes = hasBreak ? breakEndH * 60 + breakEndM : 0;
    const breakDuration = hasBreak ? breakEndMinutes - breakStartMinutes : 0;

    const totalMinutes = endMinutes - startMinutes - breakDuration;
    const slotsPerDay = Math.floor(totalMinutes / duration);

    if (mode === "single") {
      setPreviewSlots(slotsPerDay);
    } else if (mode === "recurring" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let daysCount = 0;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (daysOfWeek.includes(adjustedDay)) {
          daysCount++;
        }
      }

      setPreviewSlots(slotsPerDay * daysCount);
    }
  }, [
    mode,
    singleDate,
    startDate,
    endDate,
    daysOfWeek,
    startTime,
    endTime,
    duration,
    hasBreak,
    breakStart,
    breakEnd,
  ]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const calculateFinalPrice = () => {
    const base = parseFloat(basePrice) || 0;
    if (!hasDiscount || !discount) return base;

    const discountValue = parseFloat(discount) || 0;
    if (discountType === "PERCENTAGE") {
      return base - (base * discountValue) / 100;
    } else {
      return Math.max(0, base - discountValue);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!basePrice || parseFloat(basePrice) <= 0) {
      alert("Please enter a valid base price");
      return;
    }

    if (mode === "single" && !singleDate) {
      alert("Please select a date");
      return;
    }

    if (mode === "recurring" && (!startDate || !endDate)) {
      alert("Please select start and end dates");
      return;
    }

    if (mode === "recurring" && daysOfWeek.length === 0) {
      alert("Please select at least one day of the week");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        doctorId,
        mode,
        startTime,
        endTime,
        duration,
        basePrice: parseFloat(basePrice),
        discount: hasDiscount && discount ? parseFloat(discount) : null,
        discountType: hasDiscount && discount ? discountType : null,
      };

      if (hasBreak) {
        payload.breakStart = breakStart;
        payload.breakEnd = breakEnd;
      }

      if (mode === "single") {
        payload.date = singleDate;
      } else {
        payload.startDate = startDate;
        payload.endDate = endDate;
        payload.daysOfWeek = daysOfWeek;
      }

      const response = await fetch("http://localhost:3003/api/appointments/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log("✅ Slot creation response:", data);
      console.log("📋 Payload sent:", payload);

      if (data.success) {
        alert(`Success! Created ${data.count} appointment slots.`);
        onSuccess();
        onClose();
        resetForm();
      } else {
        alert(data.error || "Failed to create slots");
      }
    } catch (error) {
      console.error("Error creating slots:", error);
      alert("Failed to create slots. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMode("single");
    setSingleDate("");
    setStartDate("");
    setEndDate("");
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setStartTime("09:00");
    setEndTime("17:00");
    setDuration(60);
    setHasBreak(false);
    setBreakStart("12:00");
    setBreakEnd("13:00");
    setBasePrice("");
    setHasDiscount(false);
    setDiscount("");
    setDiscountType("PERCENTAGE");
  };

  if (!isOpen) return null;

  const finalPrice = calculateFinalPrice();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Create Appointment Slots
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Creation Mode
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === "single"
                    ? "bg-green-100 text-green-700 border-2 border-green-500"
                    : "bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200"
                }`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => setMode("recurring")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === "recurring"
                    ? "bg-green-100 text-green-700 border-2 border-green-500"
                    : "bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200"
                }`}
              >
                Recurring
              </button>
            </div>
          </div>

          {/* Date Selection */}
          <div className="border-t pt-6">
            {mode === "single" ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Date *
                </label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Repeat On *
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {dayNames.map((day, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          daysOfWeek.includes(index)
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Settings */}
          <div className="border-t pt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              <Clock className="inline w-4 h-4 mr-2" />
              Time Settings
            </label>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Slot Duration *
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDuration(30)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    duration === 30
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  30 minutes
                </button>
                <button
                  type="button"
                  onClick={() => setDuration(60)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    duration === 60
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  60 minutes
                </button>
              </div>
            </div>

            {/* Break Time */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={hasBreak}
                  onChange={(e) => setHasBreak(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Add break time (optional)
                </span>
              </label>

              {hasBreak && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Break Start
                    </label>
                    <input
                      type="time"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Break End
                    </label>
                    <input
                      type="time"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="border-t pt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              <DollarSign className="inline w-4 h-4 mr-2" />
              Pricing
            </label>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Base Price (USD) *
              </label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                min="0"
                step="0.01"
                placeholder="50.00"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={hasDiscount}
                  onChange={(e) => setHasDiscount(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Add discount (optional)
                </span>
              </label>

              {hasDiscount && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDiscountType("PERCENTAGE")}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all text-sm ${
                        discountType === "PERCENTAGE"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Percent className="inline w-4 h-4 mr-1" />
                      Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("FIXED")}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all text-sm ${
                        discountType === "FIXED"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <DollarSign className="inline w-4 h-4 mr-1" />
                      Fixed Amount
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Discount {discountType === "PERCENTAGE" ? "(%)" : "(USD)"}
                    </label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      min="0"
                      max={discountType === "PERCENTAGE" ? "100" : undefined}
                      step={discountType === "PERCENTAGE" ? "1" : "0.01"}
                      placeholder={discountType === "PERCENTAGE" ? "10" : "5.00"}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {discount && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        <strong>Final Price:</strong> ${finalPrice.toFixed(2)}
                        {discountType === "PERCENTAGE" && discount && (
                          <span className="ml-2 text-green-600">
                            ({discount}% off)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewSlots > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">Preview</p>
                  <p className="text-sm text-blue-700 mt-1">
                    This will create approximately <strong>{previewSlots} appointment slots</strong>
                    {mode === "recurring" && (
                      <span> across the selected date range</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || previewSlots === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${previewSlots} Slot${previewSlots !== 1 ? "s" : ""}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
