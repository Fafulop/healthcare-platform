"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { X, CalendarX2 } from "lucide-react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { authFetch } from "@/lib/auth-fetch";
import { usePermissions } from "@/lib/permissions-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";
const DISMISS_KEY = "gcal_token_banner_dismissed";

export function GoogleCalendarBanner() {
  const { doctorProfile } = useDoctorProfile();
  // Mounted globally for every dashboard visit, incl. members. The status
  // check (doctors/*/google-calendar/status) is OWNER_ONLY, and the banner's
  // action (re-authenticate GOOGLE) only makes sense for the owner — Calendar
  // sync is always attributed to the owner's tokens regardless of who acts
  // (§4 of 01-DISENO), so a member has nothing to re-authenticate here.
  // Previously degraded safely by ACCIDENT (the 403 body's shape happened to
  // short-circuit the "show banner" check) — hardened to an explicit skip
  // instead of relying on that (found during the §16 bug hunt, 2026-07-21).
  const { isOwner } = usePermissions();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState<"expired" | "missing" | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    if (!doctorProfile?.slug) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    authFetch(`${API_URL}/api/doctors/${doctorProfile.slug}/google-calendar/status`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.connected && !data.enabled) return; // never connected — no banner
        // Only show banner when the refresh token is gone — that's the only case
        // requiring true re-auth. Access token expiry is handled automatically by
        // resolveTokens() on the API side, so it never needs user action.
        if (!data.hasRefreshToken) {
          setReason(data.hasTokens ? "expired" : "missing");
          setShow(true);
        }
      })
      .catch(() => {}); // silent — don't break the dashboard on status failure
  }, [doctorProfile?.slug, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const message =
    reason === "missing"
      ? "Para que Google Calendar funcione necesitas volver a iniciar sesión con Google."
      : "Tu sesión de Google Calendar expiró. Vuelve a autenticarte para que la sincronización siga funcionando.";

  return (
    <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900">
      <div className="flex items-center gap-2">
        <CalendarX2 className="w-4 h-4 shrink-0 text-amber-600" />
        <span>{message}</span>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard/mi-perfil" })}
          className="ml-1 font-medium underline underline-offset-2 hover:text-amber-700"
        >
          Re-autenticarse
        </button>
      </div>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setShow(false);
        }}
        className="shrink-0 text-amber-500 hover:text-amber-700"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
