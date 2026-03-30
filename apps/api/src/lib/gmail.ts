import { google } from 'googleapis';

// ─── OAuth client helpers ─────────────────────────────────────────────────────

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
}

function buildAuthedClient(accessToken: string, refreshToken: string | null) {
  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return oauth2Client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppointmentEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  specialty: string | null;
  date: string;       // "2026-04-15"
  startTime: string;  // "10:00"
  endTime: string;    // "11:00"
  serviceName?: string | null;
  appointmentMode?: string | null;
  isFirstTime?: boolean | null;
  confirmationCode: string;
  finalPrice: number;
  notes?: string | null;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  isRescheduled?: boolean;
}

// ─── MIME builder ─────────────────────────────────────────────────────────────

function createRawMessage(
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): string {
  const boundary = `--boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64'),
    '',
    `--${boundary}--`,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendAppointmentConfirmationEmail(
  data: AppointmentEmailData,
  accessToken: string,
  refreshToken: string | null,
  fromName: string,
  fromEmail: string
): Promise<void> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const subject = data.isRescheduled
    ? `Reagendación de cita – ${data.doctorName}`
    : `Confirmación de cita – ${data.doctorName}`;
  const htmlBody = buildAppointmentEmailHtml(data);
  const from = `${fromName} <${fromEmail}>`;

  const raw = createRawMessage(from, data.patientEmail, subject, htmlBody);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

// ─── HTML template ────────────────────────────────────────────────────────────

function formatEmailDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function buildAppointmentEmailHtml(data: AppointmentEmailData): string {
  const formattedDate = formatEmailDate(data.date);
  const modeLabel =
    data.appointmentMode === 'TELEMEDICINA' ? 'Telemedicina (en línea)' : 'Presencial';
  const visitLabel =
    data.isFirstTime === true
      ? 'Primera consulta'
      : data.isFirstTime === false
      ? 'Consulta de seguimiento'
      : null;
  const priceFormatted = `$${Number(data.finalPrice).toLocaleString('es-MX')}`;

  const serviceRow = data.serviceName
    ? `
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e0e8ff;">
          <p style="margin:0 0 3px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Servicio</p>
          <p style="margin:0;color:#1a1a2e;font-size:14px;">${escapeHtml(data.serviceName)}</p>
        </td>
      </tr>`
    : '';

  const visitRow = visitLabel
    ? `
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e0e8ff;">
          <p style="margin:0 0 3px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Tipo de visita</p>
          <p style="margin:0;color:#1a1a2e;font-size:14px;">${visitLabel}</p>
        </td>
      </tr>`
    : '';

  const notesSection = data.notes
    ? `
      <tr>
        <td style="padding:0 40px 24px;">
          <p style="margin:0 0 8px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Motivo / Notas</p>
          <p style="margin:0;color:#444;font-size:14px;line-height:1.6;background:#fffbf0;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;">${escapeHtml(data.notes)}</p>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${data.isRescheduled ? '#b45309,#d97706' : '#1d4ed8,#2563eb'});padding:32px 40px;text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">tusalud.pro</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${data.isRescheduled ? 'Cita Reagendada' : 'Cita Confirmada'}</h1>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 20px;">
            <p style="margin:0 0 8px;color:#1a1a2e;font-size:16px;">Hola <strong>${escapeHtml(data.patientName)}</strong>,</p>
            <p style="margin:0;color:#555;font-size:14px;line-height:1.6;">${data.isRescheduled ? 'Tu cita médica ha sido <strong>reagendada</strong> a una nueva fecha y horario. A continuación encontrarás los detalles actualizados.' : 'Tu cita médica ha sido confirmada. A continuación encontrarás todos los detalles.'}</p>
          </td>
        </tr>

        <!-- Details card -->
        <tr>
          <td style="padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8ff;border:1px solid #dce8ff;border-radius:10px;overflow:hidden;">

              <!-- Date & time -->
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #dce8ff;background:#eef3ff;">
                  <p style="margin:0 0 3px;color:#2563eb;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Fecha y hora</p>
                  <p style="margin:0;color:#1a1a2e;font-size:18px;font-weight:700;text-transform:capitalize;">${formattedDate}</p>
                  <p style="margin:4px 0 0;color:#555;font-size:14px;">${escapeHtml(data.startTime)} – ${escapeHtml(data.endTime)} hrs</p>
                </td>
              </tr>

              <!-- Doctor -->
              <tr>
                <td style="padding:14px 24px;border-bottom:1px solid #dce8ff;">
                  <p style="margin:0 0 3px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Médico</p>
                  <p style="margin:0;color:#1a1a2e;font-size:14px;font-weight:600;">${escapeHtml(data.doctorName)}</p>
                  ${data.specialty ? `<p style="margin:3px 0 0;color:#666;font-size:13px;">${escapeHtml(data.specialty)}</p>` : ''}
                </td>
              </tr>

              ${serviceRow}
              ${visitRow}

              <!-- Clinic location -->
              ${data.clinicAddress ? `
              <tr>
                <td style="padding:14px 24px;border-bottom:1px solid #dce8ff;">
                  <p style="margin:0 0 3px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Consultorio</p>
                  ${data.clinicName ? `<p style="margin:0;color:#1a1a2e;font-size:14px;font-weight:500;">${escapeHtml(data.clinicName)}</p>` : ''}
                  <p style="margin:${data.clinicName ? '3px' : '0'} 0 0;color:#555;font-size:13px;">${escapeHtml(data.clinicAddress)}</p>
                  ${data.clinicPhone ? `<p style="margin:3px 0 0;color:#555;font-size:13px;">${escapeHtml(data.clinicPhone)}</p>` : ''}
                </td>
              </tr>` : ''}

              <!-- Mode -->
              <tr>
                <td style="padding:14px 24px;border-bottom:1px solid #dce8ff;">
                  <p style="margin:0 0 3px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Modalidad</p>
                  <p style="margin:0;color:#1a1a2e;font-size:14px;">${modeLabel}</p>
                </td>
              </tr>

              <!-- Price -->
              <tr>
                <td style="padding:14px 24px;border-bottom:1px solid #dce8ff;">
                  <p style="margin:0 0 3px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Precio</p>
                  <p style="margin:0;color:#1a1a2e;font-size:14px;font-weight:600;">${priceFormatted}</p>
                </td>
              </tr>

              <!-- Confirmation code -->
              <tr>
                <td style="padding:16px 24px;">
                  <p style="margin:0 0 6px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Código de confirmación</p>
                  <p style="margin:0;display:inline-block;background:#2563eb;color:#fff;font-size:18px;font-weight:700;letter-spacing:0.15em;padding:8px 16px;border-radius:6px;">${escapeHtml(data.confirmationCode)}</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        ${notesSection}

        <!-- Footer -->
        <tr>
          <td style="background:#f8faff;padding:24px 40px;border-top:1px solid #e5ecf5;text-align:center;">
            <p style="margin:0;color:#888;font-size:13px;">Si tienes alguna pregunta, responde este correo o contáctanos directamente.</p>
            <p style="margin:10px 0 0;color:#bbb;font-size:11px;">tusalud.pro · Plataforma de salud digital en México</p>
            <p style="margin:8px 0 0;font-size:11px;color:#bbb;">Tus datos son tratados conforme a nuestro <a href="https://tusalud.pro/privacidad" style="color:#93c5fd;text-decoration:none;">Aviso de Privacidad</a> · <a href="mailto:privacidad@tusalud.pro" style="color:#93c5fd;text-decoration:none;">privacidad@tusalud.pro</a></p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
