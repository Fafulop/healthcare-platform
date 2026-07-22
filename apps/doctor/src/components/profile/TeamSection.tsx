"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, UserPlus, Trash2, Mail, ShieldCheck, X } from "lucide-react";
import { PERMISSION_KEYS, INVITE_DEFAULTS, type PermissionKey } from "@healthcare/database";
import { PERMISSION_LABELS } from "@healthcare/database";

interface MemberRow {
  id: string;
  status: "ACTIVE" | "REVOKED";
  permissions: Partial<Record<PermissionKey, boolean>>;
  createdAt: string;
  user: { id: string; email: string; name: string | null; image: string | null };
}

interface InviteRow {
  id: string;
  email: string;
  permissions: Partial<Record<PermissionKey, boolean>>;
  createdAt: string;
  expiresAt: string;
}

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}

function PermissionToggles({
  value,
  onChange,
  disabled,
}: {
  value: Partial<Record<PermissionKey, boolean>>;
  onChange: (key: PermissionKey, v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
      {PERMISSION_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value[key] === true}
            disabled={disabled}
            onChange={(e) => onChange(key, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {PERMISSION_LABELS[key]}
        </label>
      ))}
    </div>
  );
}

export default function TeamSection() {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerms, setInvitePerms] = useState<Partial<Record<PermissionKey, boolean>>>(INVITE_DEFAULTS);
  const [inviting, setInviting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPerms, setEditingPerms] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, i] = await Promise.all([
        api("/api/team/members"),
        api("/api/team/invites"),
      ]);
      setMembers(m.data);
      setInvites(i.data);
    } catch (e: any) {
      setError(e.message || "No se pudo cargar el equipo");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendInvite = async () => {
    setInviting(true);
    setError(null);
    try {
      await api("/api/team/invites", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, permissions: invitePerms }),
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInvitePerms(INVITE_DEFAULTS);
      await load();
    } catch (e: any) {
      setError(e.message || "No se pudo enviar la invitación");
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      await api(`/api/team/invites/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message || "No se pudo revocar la invitación");
    }
  };

  const startEdit = (m: MemberRow) => {
    setEditingId(m.id);
    setEditingPerms(m.permissions ?? {});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/team/members/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: editingPerms }),
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const revokeMember = async (id: string) => {
    try {
      await api(`/api/team/members/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message || "No se pudo revocar el acceso");
    }
  };

  if (members === null || invites === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando equipo...
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.status === "ACTIVE");
  // 1-helper rule (03-PLAN §3.3): the single slot is taken by one active member
  // OR one pending invite. Courtesy only — the server enforces it (invites POST).
  const slotFull = activeMembers.length > 0 || invites.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Equipo</h2>
          <p className="text-sm text-gray-500 mt-1">
            Invita a tu asistente o staff a tu portal y decide qué secciones puede ver.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          disabled={slotFull}
          title={slotFull ? "Solo se permite un asistente; revoca o cancela el actual para cambiarlo" : undefined}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
        >
          <UserPlus className="w-4 h-4" /> Invitar
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Active members */}
      <div className="space-y-3">
        {activeMembers.length === 0 && (
          <p className="text-sm text-gray-400">Nadie más tiene acceso a tu portal todavía.</p>
        )}
        {activeMembers.map((m) => (
          <div key={m.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {m.user.image ? (
                  <img src={m.user.image} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.user.name || m.user.email}</p>
                  <p className="text-xs text-gray-500 truncate">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => (editingId === m.id ? setEditingId(null) : startEdit(m))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  {editingId === m.id ? "Cerrar" : "Editar permisos"}
                </button>
                <button
                  onClick={() => revokeMember(m.id)}
                  title="Revocar acceso"
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {editingId === m.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <PermissionToggles
                  value={editingPerms}
                  onChange={(key, v) => setEditingPerms((p) => ({ ...p, [key]: v }))}
                />
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Invitaciones pendientes</h3>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 min-w-0 text-sm text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{inv.email}</span>
                </div>
                <button
                  onClick={() => revokeInvite(inv.id)}
                  className="text-xs font-medium text-gray-500 hover:text-red-600 flex-shrink-0"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite dialog */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Invitar a tu equipo</h3>
              <button onClick={() => setInviteOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="email"
              placeholder="correo@gmail.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Acceso inicial (puedes cambiarlo después)</p>
              <PermissionToggles value={invitePerms} onChange={(key, v) => setInvitePerms((p) => ({ ...p, [key]: v }))} />
            </div>
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail}
              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {inviting ? "Enviando..." : "Enviar invitación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
