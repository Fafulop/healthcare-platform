// SMS Service using Twilio
// Sends appointment confirmation and notification via SMS

import twilio from 'twilio';

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
 */
export async function sendPatientSMS(details: BookingDetails): Promise<boolean> {
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

  // SMS has 160 character limit per segment, keep it concise
  const message = `¡Hola ${details.patientName}!

Tu cita confirmada:
Dr. ${details.doctorName}
${formattedDate}
${details.startTime} - ${details.endTime}
Precio: $${details.finalPrice}

Codigo: ${details.confirmationCode}

Por favor llega 10 min antes.`;

  try {
    const formattedPhone = formatPhoneNumber(details.patientPhone);

    await client.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone,
      body: message,
    });

    console.log(`✅ SMS sent to patient: ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending SMS to patient:', error);
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
 * Check if SMS service is properly configured
 */
export function isSMSConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}
