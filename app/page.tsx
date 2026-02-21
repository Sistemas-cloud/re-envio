"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { AgAlumno } from "@/types/database";

function nombreCompleto(a: AgAlumno): string {
  return [a.nombre, a.ap_pat, a.ap_mat].filter(Boolean).join(" ").trim() || "—";
}

/** Obtiene YYYY-MM-DD de alumno_registro (cualquier formato parseable). */
function dateOnlyFromRegistro(s: string | null | undefined): string | null {
  if (s == null) return null;
  const str = typeof s === "string" ? s.trim() : String(s);
  if (!str) return null;
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1]!;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Valor a mostrar para la columna codigo (Supabase puede devolver number o string; probamos codigo y Codigo). */
function getCodigo(a: AgAlumno): number | null {
  const row = a as Record<string, unknown>;
  const raw = row.codigo ?? row.Codigo;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** n_ing: 1 = maternal, 2 = kinder, 3 = primaria, 4 = secundaria */
const NIVEL_LABELS: Record<number, string> = {
  1: "Maternal",
  2: "Kinder",
  3: "Primaria",
  4: "Secundaria",
};

function getNivelLabel(a: AgAlumno): string {
  const raw = a.n_ing;
  if (raw === null || raw === undefined) return "—";
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (Number.isNaN(n)) return "—";
  return NIVEL_LABELS[n] ?? String(n);
}

function formatFechaExa(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "—";
  const d = new Date(s.trim());
  if (Number.isNaN(d.getTime())) return s.trim();
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatHoraExa(s: string | null | undefined): string {
  if (!s) return "—";
  return String(s).trim() || "—";
}

export default function Home() {
  const [alumnos, setAlumnos] = useState<AgAlumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [dateDesde, setDateDesde] = useState("");
  const [dateHasta, setDateHasta] = useState("");
  const [ciclo, setCiclo] = useState<string>("");
  const [nivel, setNivel] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const pageSize = 1000;
        let from = 0;
        const all: AgAlumno[] = [];
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("ag_alumno")
            .select("*")
            .not("email", "is", null)
            .range(from, from + pageSize - 1);

          if (error) throw error;
          const page = (data as AgAlumno[]) ?? [];
          all.push(...page);
          hasMore = page.length === pageSize;
          from += pageSize;
        }
        setAlumnos(all);
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

  const filteredAlumnos = useMemo(() => {
    let list = alumnos;
    if (nivel) {
      const nIngVal = parseInt(nivel, 10);
      if (!Number.isNaN(nIngVal)) {
        list = list.filter((a) => {
          const raw = a.n_ing;
          if (raw === null || raw === undefined) return false;
          const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
          return n === nIngVal;
        });
      }
    }
    if (ciclo) {
      const cicloNum = Number(ciclo);
      const cicloStr = ciclo.trim();
      list = list.filter((a) => {
        const row = a as Record<string, unknown>;
        const raw = row.ciclo ?? a.ciclo;
        if (raw === null || raw === undefined) return false;
        const s = String(raw).trim();
        const n = Number(raw);
        if (s === cicloStr) return true;
        if (Number.isNaN(cicloNum)) return false;
        if (n === cicloNum) return true;
        if (cicloNum === 22 && n === 2022) return true;
        if (cicloNum === 23 && n === 2023) return true;
        return false;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const nombre = nombreCompleto(a).toLowerCase();
        const email = (a.email ?? "").toLowerCase();
        return nombre.includes(q) || email.includes(q);
      });
    }
    if (dateDesde || dateHasta) {
      const desde = dateDesde.trim();
      const hasta = dateHasta.trim();
      list = list.filter((a) => {
        const row = a as Record<string, unknown>;
        const reg = (row.alumno_registro ?? row.alumnoRegistro ?? a.alumno_registro) as string | null | undefined;
        const only = dateOnlyFromRegistro(reg);
        if (!only) return false;
        if (desde && only < desde) return false;
        if (hasta && only > hasta) return false;
        return true;
      });
    }
    return list;
  }, [alumnos, nivel, ciclo, search, dateDesde, dateHasta]);

  const toSend = useMemo(() => {
    const withEmail = filteredAlumnos.filter((a) => a.email?.trim());
    if (selectedIds.size === 0) return [];
    return withEmail.filter((a) => selectedIds.has(a.idalum));
  }, [filteredAlumnos, selectedIds]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const withEmail = filteredAlumnos.filter((a) => a.email?.trim()).map((a) => a.idalum);
      setSelectedIds(new Set(withEmail));
    } else {
      setSelectedIds(new Set());
    }
  }

  const allSelectableIds = useMemo(
    () => new Set(filteredAlumnos.filter((a) => a.email?.trim()).map((a) => a.idalum)),
    [filteredAlumnos]
  );
  const allSelected =
    allSelectableIds.size > 0 && allSelectableIds.size === selectedIds.size && [...allSelectableIds].every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  async function handleSendEmails() {
    if (toSend.length === 0) {
      setMessage({
        type: "error",
        text: someSelected
          ? "Ninguno de los seleccionados tiene email válido."
          : "Selecciona al menos una persona para enviar el correo.",
      });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumnos: toSend }),
      });
      const json = await res.json();
      if (!res.ok) {
        const errText = json.error ?? json.message ?? "Error al enviar";
        throw new Error(errText);
      }
      const text = json.error ? `${json.message ?? ""} (${json.error})` : (json.message ?? "Correos enviados.");
      setMessage({ type: json.error ? "error" : "ok", text });
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-sm">Cargando registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Envío de códigos por correo
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Busca y filtra alumnos con email y envía su código por correo.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {message && (
          <div
            className={`mb-4 p-4 rounded-xl text-sm font-medium ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Barra de búsqueda y filtros */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="nivel" className="text-slate-600 text-sm font-medium whitespace-nowrap">
                  Nivel:
                </label>
                <select
                  id="nivel"
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                >
                  <option value="">Todos</option>
                  <option value="1">Maternal</option>
                  <option value="2">Kinder</option>
                  <option value="3">Primaria</option>
                  <option value="4">Secundaria</option>
                </select>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="ciclo" className="text-slate-600 text-sm font-medium whitespace-nowrap">
                  Ciclo:
                </label>
                <select
                  id="ciclo"
                  value={ciclo}
                  onChange={(e) => setCiclo(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                >
                  <option value="">Todos</option>
                  <option value="22">22</option>
                  <option value="23">23</option>
                </select>
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-slate-500 text-xs font-medium hidden sm:inline">alumno_registro:</span>
                <input
                  type="date"
                  value={dateDesde}
                  onChange={(e) => setDateDesde(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  title="Desde (alumno_registro)"
                />
                <span className="text-slate-400 text-sm">—</span>
                <input
                  type="date"
                  value={dateHasta}
                  onChange={(e) => setDateHasta(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  title="Hasta (alumno_registro)"
                />
                {(dateDesde || dateHasta || search || ciclo || nivel) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setDateDesde("");
                      setDateHasta("");
                      setCiclo("");
                      setNivel("");
                    }}
                    className="px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-2">
              Filtros: <strong>Nivel</strong> (n_ing), <strong>Ciclo</strong>, <strong>alumno_registro</strong> (fecha).
            </p>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        title={allSelected ? "Quitar todos" : "Seleccionar todos"}
                      />
                      <span className="text-slate-500 text-xs font-medium sr-only sm:not-sr-only">Enviar</span>
                    </label>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 w-24" title="Columna codigo">
                    Código <span className="font-normal text-slate-400 text-xs">(codigo)</span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Nombre</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 w-24" title="Nivel de ingreso">
                    Nivel <span className="font-normal text-slate-400 text-xs">(n_ing)</span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 w-26" title="Fecha de examen">
                    F. examen <span className="font-normal text-slate-400 text-xs">(f_exa)</span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 w-20" title="Hora de examen">
                    H. examen <span className="font-normal text-slate-400 text-xs">(h_exa)</span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 w-28" title="Columna alumno_registro">
                    Registro <span className="font-normal text-slate-400 text-xs">(alumno_registro)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAlumnos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      {alumnos.length === 0
                        ? "No hay registros con email."
                        : "Ningún resultado con los filtros actuales."}
                    </td>
                  </tr>
                ) : (
                  filteredAlumnos.map((a) => {
                    const codigo = getCodigo(a);
                    const hasEmail = Boolean(a.email?.trim());
                    const checked = selectedIds.has(a.idalum);
                    return (
                    <tr
                      key={a.idalum}
                      className={`border-b border-slate-100 transition-colors ${checked ? "bg-indigo-50/70" : "hover:bg-indigo-50/50"}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!hasEmail}
                            onChange={() => toggleSelect(a.idalum)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={hasEmail ? "Incluir en el envío" : "Sin email"}
                          />
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-mono font-semibold">
                          {codigo !== null ? codigo : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {nombreCompleto(a)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.email ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700 text-xs font-medium">
                        {getNivelLabel(a)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {formatFechaExa(a.f_exa)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {formatHoraExa(a.h_exa)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {a.alumno_registro
                          ? new Date(a.alumno_registro).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ); })
                )}
              </tbody>
            </table>
          </div>

          {/* Pie: total y envío */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-slate-600 text-sm">
              <span className="font-medium text-slate-800">
                {filteredAlumnos.length} de {alumnos.length}
              </span>
              registro(s) con email
              {(search || dateDesde || dateHasta || ciclo || nivel) && (
                <span className="text-slate-400">(filtrados)</span>
              )}
              {someSelected && (
                <span className="font-medium text-indigo-600">
                  · {toSend.length} seleccionado(s) para envío
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSendEmails}
              disabled={sending || toSend.length === 0}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-sm"
            >
              {sending ? "Enviando…" : toSend.length > 0 ? `Enviar a ${toSend.length} seleccionado(s)` : "Selecciona destinatarios"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
