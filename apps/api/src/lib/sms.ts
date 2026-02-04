// SMS Service using Twilio
// Sends appointment confirmation and notification via SMS

import twilio from 'twilio';
import { prisma } from '@healthcare/database';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
const client =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

export interface BookingDetails {
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorPhone?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  finalPrice: number;
  confirmationCode: string;
  clinicAddress?: string;
  specialty?: string;
  reviewToken?: string;
}

/**
 * Format phone number to E.164 format for Mexico
 */
function formatPhoneNumber(phone: string): string {
  // Remove all spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Add +52 (Mexico country code) if not present
  if (!cleaned.startsWith('+')) {
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+52' + cleaned;
  }

  return cleaned;
}

/**
 * Send SMS confirmation to patient
 * @param details - Booking details
 * @param status - Booking status: 'PENDING' sends request acknowledgment, 'CONFIRMED' sends confirmation
 */
export async function sendPatientSMS(
  details: BookingDetails,
  status: 'PENDING' | 'CONFIRMED' = 'CONFIRMED'
): Promise<boolean> {
  if (!client || !TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ Twilio SMS not configured. Skipping SMS notification.');
    return false;
  }

  const formattedDate = new Date(details.date).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let message: string;

  if (status === 'PENDING') {
    // SMS 1: Booking request received (pending doctor confirmation)
    message = `¡Hola ${details.patientName}!

Tu solicitud de cita ha sido recibida:
Dr. ${details.doctorName}
${formattedDate}
${details.startTime} - ${details.endTime}

Recibirás la confirmación del doctor pronto vía SMS y correo electrónico.

Código de referencia: ${details.confirmationCode}`;
  } else {
    // SMS 2: Booking confirmed by doctor
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const reviewLink = details.reviewToken
      ? `\n\nDespués de tu cita, déjanos tu opinión:\n${baseUrl}/review/${details.reviewToken}`
      : '';

    message = `¡Hola ${details.patientName}!

Tu cita ha sido CONFIRMADA:
Dr. ${details.doctorName}
${formattedDate}
${details.startTime} - ${details.endTime}
Precio: $${details.finalPrice}

Código de confirmación: ${details.confirmationCode}

Por favor llega 10 min antes.${reviewLink}`;
  }

  try {
    const formattedPhone = formatPhoneNumber(details.patientPhone);

    await client.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone,
      body: message,
    });

    console.log(`✅ SMS sent to patient (${status}): ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending SMS to patient (${status}):`, error);
    return false;
  }
}

/**
 * Send SMS notification to doctor about new booking
 */
export async function sendDoctorSMS(details: BookingDetails): Promise<boolean> {
  if (!client || !TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ Twilio SMS not configured. Skipping SMS notification.');
    return false;
  }

  if (!details.doctorPhone) {
    console.warn('⚠️ Doctor phone not provided. Skipping SMS notification.');
    return false;
  }

  const formattedDate = new Date(details.date).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const message = `Nueva cita agendada

Paciente: ${details.patientName}
Tel: ${details.patientPhone}

${formattedDate}
${details.startTime} - ${details.endTime}
Duracion: ${details.duration} min
Precio: $${details.finalPrice}

Codigo: ${details.confirmationCode}`;

  try {
    const formattedPhone = formatPhoneNumber(details.doctorPhone);

    await client.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone,
      body: message,
    });

    console.log(`✅ SMS sent to doctor: ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending SMS to doctor:', error);
    return false;
  }
}

/**
 * Check if SMS service is properly configured (Twilio credentials present)
 */
export function isSMSConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

/**
 * Check if SMS is enabled via admin toggle AND Twilio is configured.
 * Queries the system_settings table for the sms_enabled flag.
 */
export async function isSMSEnabled(): Promise<boolean> {
  if (!isSMSConfigured()) return false;

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'sms_enabled' },
    });
    return setting?.value === 'true';
  } catch (error) {
    console.error('Error checking SMS setting, defaulting to disabled:', error);
    return false;
  }
}
