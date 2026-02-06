"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AgAlumno } from "@/types/database";

export default function Home() {
  const [alumnos, setAlumnos] = useState<AgAlumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("ag_alumno")
          .select("*")
          .not("email", "is", null);

        if (error) throw error;
        setAlumnos((data as AgAlumno[]) ?? []);
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Error al cargar datos",
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSendEmails() {
    const withEmail = alumnos.filter((a) => a.email?.trim());
    if (!withEmail.length) {
      setMessage({ type: "error", text: "No hay registros con email." });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumnos: withEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al enviar");
      setMessage({ type: "ok", text: json.message ?? "Correos enviados." });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Error al enviar correos",
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <p className="text-zinc-600">Cargando registros...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-zinc-800 mb-2">
          Envío de códigos por correo
        </h1>
        <p className="text-zinc-600 text-sm mb-6">
          Registros de <strong>ag_alumno</strong> con email. Se enviará un correo con el código a cada uno.
        </p>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "ok"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200">
                <tr>
                  <th className="p-3 font-medium text-zinc-700">Código</th>
                  <th className="p-3 font-medium text-zinc-700">Nombre</th>
                  <th className="p-3 font-medium text-zinc-700">Email</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-zinc-500">
                      No hay registros con email.
                    </td>
                  </tr>
                ) : (
                  alumnos.map((a) => (
                    <tr
                      key={a.idalum}
                      className="border-b border-zinc-100 hover:bg-zinc-50"
                    >
                      <td className="p-3 font-mono">{a.codigo ?? "—"}</td>
                      <td className="p-3">
                        {[a.nombre, a.ap_pat, a.ap_mat].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="p-3 text-zinc-600">{a.email ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center">
            <span className="text-zinc-600 text-sm">
              {alumnos.length} registro(s) con email
            </span>
            <button
              type="button"
              onClick={handleSendEmails}
              disabled={sending || alumnos.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              {sending ? "Enviando…" : "Enviar correos con código"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
