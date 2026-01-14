"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { Calendar, Clock, DollarSign, Plus, Trash2, Lock, Unlock, Loader2, CheckSquare, Square, User, Phone, Mail, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import CreateSlotsModal from "./CreateSlotsModal";
import Sidebar from "@/components/layout/Sidebar";
import { authFetch } from "@/lib/auth-fetch";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  basePrice: number;
  discount: number | null;
  discountType: string | null;
  finalPrice: number;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  currentBookings: number;
  maxBookings: number;
}

interface Booking {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientWhatsapp: string | null;
  status: string;
  finalPrice: number;
  confirmationCode: string;
  createdAt: string;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
}

export default function AppointmentsPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  // Get doctor ID from session
  const doctorId = session?.user?.doctorId;

  useEffect(() => {
    if (doctorId) {
      fetchDoctorProfile(doctorId);
      fetchSlots();
      fetchBookings();
    }
  }, [doctorId, selectedDate]);

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

  const fetchSlots = async () => {
    if (!doctorId) return;

    setLoading(true);
    try {
      // Fetch slots for the current month
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0).toISOString();

      const response = await authFetch(
        `${API_URL}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setSlots(data.data);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!doctorId) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/bookings?doctorId=${doctorId}`
      );
      const data = await response.json();

      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        alert("Slot deleted successfully");
        fetchSlots();
        fetchBookings();
      } else {
        alert(data.error || "Failed to delete slot");
      }
    } catch (error) {
      console.error("Error deleting slot:", error);
      alert("Failed to delete slot");
    }
  };

  const toggleBlockSlot = async (slotId: string, currentStatus: string) => {
    const newStatus = currentStatus === "BLOCKED" ? "AVAILABLE" : "BLOCKED";

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/${slotId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await response.json();

      if (data.success) {
        alert(data.message);
        fetchSlots();
        fetchBookings();
      } else {
        alert(data.error || "Failed to update slot");
      }
    } catch (error) {
      console.error("Error updating slot:", error);
      alert("Failed to update slot");
    }
  };

  const bulkAction = async (action: "delete" | "block" | "unblock") => {
    const slotIds = Array.from(selectedSlots);

    if (slotIds.length === 0) {
      alert("Please select slots first");
      return;
    }

    const actionText = action === "delete" ? "delete" : action === "block" ? "block" : "unblock";
    if (!confirm(`Are you sure you want to ${actionText} ${slotIds.length} slot(s)?`)) {
      return;
    }

    try {
      const response = await authFetch(
        `${API_URL}/api/appointments/slots/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ slotIds, action }),
        }
      );
      const data = await response.json();

      if (data.success) {
        alert(`Successfully ${actionText}ed ${data.count} slot(s)`);
        setSelectedSlots(new Set());
        fetchSlots();
        fetchBookings();
      } else {
        alert(data.error || `Failed to ${actionText} slots`);
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      alert(`Failed to ${actionText} slots`);
    }
  };

  const toggleSlotSelection = (slotId: string) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(slotId)) {
      newSelected.delete(slotId);
    } else {
      newSelected.add(slotId);
    }
    setSelectedSlots(newSelected);
  };

  const toggleAllSlots = () => {
    if (selectedSlots.size === slots.length) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(slots.map(s => s.id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border-red-200";
      case "COMPLETED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <CheckCircle className="w-4 h-4" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4" />;
      case "PENDING":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Get slots for selected date
  const selectedDateStr = selectedDate.toISOString().split("T")[0];
  const slotsForSelectedDate = slots.filter(
    (slot) => new Date(slot.date).toISOString().split("T")[0] === selectedDateStr
  );

  // Get dates with slots for calendar highlighting
  const datesWithSlots = new Set(
    slots.map((slot) => new Date(slot.date).toISOString().split("T")[0])
  );

  // Calendar days for current month
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-md">
          <p className="text-red-600 font-semibold">No doctor profile linked to your account.</p>
          <p className="text-gray-600 text-sm mt-2">Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Appointment Management</h1>
                <p className="text-gray-600 mt-1">Create and manage your availability</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Slots
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Calendar View
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                List View
              </button>
            </div>
          </div>

          {/* Booked Appointments Card */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Booked Appointments
              </h2>
            <span className="text-sm font-medium text-gray-600">
              {bookings.length} total
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No bookings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date & Time</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Patient</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(booking.slot.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-sm text-gray-600">
                              {booking.slot.startTime} - {booking.slot.endTime}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{booking.patientName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {booking.patientEmail}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {booking.patientPhone}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            booking.status
                          )}`}
                        >
                          {getStatusIcon(booking.status)}
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 font-semibold text-gray-900">
                          <DollarSign className="w-4 h-4" />
                          {booking.finalPrice}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {booking.confirmationCode}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSelectedDate(
                        new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1)
                      )
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    ‹ Prev
                  </button>
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    Today
                  </button>
                  <button
                    onClick={() =>
                      setSelectedDate(
                        new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1)
                      )
                    }
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    Next ›
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-gray-600 text-sm py-2"
                  >
                    {day}
                  </div>
                ))}

                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const dateStr = new Date(year, month, day).toISOString().split("T")[0];
                  const hasSlots = datesWithSlots.has(dateStr);
                  const isSelected = dateStr === selectedDateStr;
                  const isToday =
                    dateStr === new Date().toISOString().split("T")[0];

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                      className={`aspect-square p-2 rounded-lg text-center transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white font-bold"
                          : isToday
                          ? "bg-blue-100 text-blue-700 font-semibold"
                          : hasSlots
                          ? "bg-blue-200 text-blue-900 font-medium hover:bg-blue-300"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <div className="text-sm">{day}</div>
                      {hasSlots && !isSelected && (
                        <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slots for Selected Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h3>

              {slotsForSelectedDate.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No slots for this date</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {slotsForSelectedDate.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-lg border-2 ${
                        slot.status === "BOOKED"
                          ? "bg-blue-50 border-blue-200"
                          : slot.status === "BLOCKED"
                          ? "bg-gray-100 border-gray-300"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            slot.status === "AVAILABLE"
                              ? "bg-blue-100 text-blue-700"
                              : slot.status === "BOOKED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {slot.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">${slot.finalPrice}</span>
                        {slot.discount && (
                          <span className="text-xs text-blue-600">
                            ({slot.discountType === "PERCENTAGE" ? `${slot.discount}%` : `$${slot.discount}`} off)
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => toggleBlockSlot(slot.id, slot.status)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs"
                          title={slot.status === "BLOCKED" ? "Unblock" : "Block"}
                        >
                          {slot.status === "BLOCKED" ? (
                            <Unlock className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs"
                          disabled={slot.currentBookings > 0}
                          title={slot.currentBookings > 0 ? "Cannot delete - has bookings" : "Delete"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">All Slots</h2>

              {/* Bulk Actions Toolbar */}
              {selectedSlots.size > 0 && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedSlots.size} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => bulkAction("block")}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <Lock className="w-3 h-3" />
                      Block
                    </button>
                    <button
                      onClick={() => bulkAction("unblock")}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <Unlock className="w-3 h-3" />
                      Unblock
                    </button>
                    <button
                      onClick={() => bulkAction("delete")}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                    <button
                      onClick={() => setSelectedSlots(new Set())}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-medium transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {slots.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No appointment slots created yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create your first slots
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 w-12">
                        <button
                          onClick={toggleAllSlots}
                          className="p-1 hover:bg-gray-100 rounded"
                          title={selectedSlots.size === slots.length ? "Deselect All" : "Select All"}
                        >
                          {selectedSlots.size === slots.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Time</th>
                      <th className="text-left py-3 px-4">Duration</th>
                      <th className="text-left py-3 px-4">Price</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Bookings</th>
                      <th className="text-right py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSlotSelection(slot.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {selectedSlots.has(slot.id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          {new Date(slot.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">{slot.startTime} - {slot.endTime}</td>
                        <td className="py-3 px-4">{slot.duration} min</td>
                        <td className="py-3 px-4">${slot.finalPrice}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              slot.status === "AVAILABLE"
                                ? "bg-blue-100 text-blue-700"
                                : slot.status === "BOOKED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {slot.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {slot.currentBookings}/{slot.maxBookings}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => toggleBlockSlot(slot.id, slot.status)}
                              className="p-2 hover:bg-gray-200 rounded"
                              title={slot.status === "BLOCKED" ? "Unblock" : "Block"}
                            >
                              {slot.status === "BLOCKED" ? (
                                <Unlock className="w-4 h-4 text-gray-600" />
                              ) : (
                                <Lock className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="p-2 hover:bg-red-100 rounded"
                              disabled={slot.currentBookings > 0}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Slots Modal */}
        <CreateSlotsModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          doctorId={doctorId!}
          onSuccess={() => {
            fetchSlots();
            fetchBookings();
          }}
        />
        </div>
      </main>
    </div>
  );
}
