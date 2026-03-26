"use client";

// 2026-03-26: Rediseño completo de UI/UX — mejor header, tarjetas de stats,
// filtros reorganizados, badges de nivel con color, notificaciones mejoradas.

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { AgAlumno } from "@/types/database";

function nombreCompleto(a: AgAlumno): string {
  return [a.nombre, a.ap_pat, a.ap_mat].filter(Boolean).join(" ").trim() || "—";
}

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

const NIVEL_COLORS: Record<number, string> = {
  1: "bg-pink-100 text-pink-700 border-pink-200",
  2: "bg-amber-100 text-amber-700 border-amber-200",
  3: "bg-blue-100 text-blue-700 border-blue-200",
  4: "bg-violet-100 text-violet-700 border-violet-200",
};

function getNivelLabel(a: AgAlumno): string {
  const raw = a.n_ing;
  if (raw === null || raw === undefined) return "—";
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (Number.isNaN(n)) return "—";
  return NIVEL_LABELS[n] ?? String(n);
}

function getNivelColor(a: AgAlumno): string {
  const raw = a.n_ing;
  if (raw === null || raw === undefined) return "bg-slate-100 text-slate-500 border-slate-200";
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return NIVEL_COLORS[n] ?? "bg-slate-100 text-slate-500 border-slate-200";
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
    allSelectableIds.size > 0 &&
    allSelectableIds.size === selectedIds.size &&
    [...allSelectableIds].every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const hasActiveFilters = !!(search || dateDesde || dateHasta || ciclo || nivel);

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
      const text = json.error
        ? `${json.message ?? ""} (${json.error})`
        : (json.message ?? "Correos enviados.");
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl shadow-lg px-12 py-10 border border-slate-100">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-slate-800 font-semibold">Cargando registros</p>
            <p className="text-slate-500 text-sm mt-0.5">Conectando con la base de datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Ícono de sobre */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              {/* 2026-03-26: Título actualizado a Re-envío */}
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                Re-envío de códigos por correo
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Busca, filtra y envía códigos de admisión a alumnos
              </p>
            </div>
          </div>
          {/* 2026-03-26: URL del proyecto en producción */}
          <a
            href="https://re-envio.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors font-medium self-start sm:self-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            re-envio.vercel.app
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* ── NOTIFICACIÓN ── */}
        {message && (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl text-sm border ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {message.type === "ok" ? (
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── TARJETAS DE ESTADÍSTICAS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total registros</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{alumnos.length.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Filtrados</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{filteredAlumnos.length.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Seleccionados</p>
            <p className="text-2xl font-bold text-violet-600 mt-1">{toSend.length.toLocaleString("es-MX")}</p>
          </div>
          <div className={`rounded-xl border shadow-sm p-4 transition-colors ${toSend.length > 0 ? "bg-indigo-600 border-indigo-700" : "bg-white border-slate-200"}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${toSend.length > 0 ? "text-indigo-200" : "text-slate-500"}`}>Listos para enviar</p>
            <p className={`text-2xl font-bold mt-1 ${toSend.length > 0 ? "text-white" : "text-slate-400"}`}>{toSend.length.toLocaleString("es-MX")}</p>
          </div>
        </div>

        {/* ── PANEL DE FILTROS ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              <span className="text-sm font-semibold text-slate-700">Filtros</span>
              {hasActiveFilters && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  activos
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setSearch(""); setDateDesde(""); setDateHasta(""); setCiclo(""); setNivel(""); }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Nivel */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nivel" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nivel</label>
              <select
                id="nivel"
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
              >
                <option value="">Todos los niveles</option>
                <option value="1">Maternal</option>
                <option value="2">Kinder</option>
                <option value="3">Primaria</option>
                <option value="4">Secundaria</option>
              </select>
            </div>

            {/* Ciclo */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ciclo" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Ciclo</label>
              <select
                id="ciclo"
                value={ciclo}
                onChange={(e) => setCiclo(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
              >
                <option value="">Todos los ciclos</option>
                <option value="22">22</option>
                <option value="23">23</option>
              </select>
            </div>

            {/* Búsqueda */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Nombre o correo electrónico..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Rango de fecha */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Rango de fecha de registro
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={dateDesde}
                  onChange={(e) => setDateDesde(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
                  title="Desde"
                />
                <span className="text-slate-400 text-sm font-medium">hasta</span>
                <input
                  type="date"
                  value={dateHasta}
                  onChange={(e) => setDateHasta(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
                  title="Hasta"
                />
              </div>
            </div>
          </div>

          {/* ── TABLA ── */}
          <div className="border-t border-slate-100 overflow-x-auto" style={{ maxHeight: "52vh", overflowY: "auto" }}>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 w-14 text-center">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 accent-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title={allSelected ? "Quitar todos" : "Seleccionar todos"}
                      />
                    </label>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-24">Código</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">Nivel</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">F. examen</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-24">H. examen</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlumnos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">
                          {alumnos.length === 0
                            ? "No hay registros con email."
                            : "Ningún resultado con los filtros actuales."}
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={() => { setSearch(""); setDateDesde(""); setDateHasta(""); setCiclo(""); setNivel(""); }}
                            className="text-indigo-600 text-xs hover:underline"
                          >
                            Limpiar filtros
                          </button>
                        )}
                      </div>
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
                        onClick={() => hasEmail && toggleSelect(a.idalum)}
                        className={`transition-colors cursor-pointer ${
                          checked
                            ? "bg-indigo-50 hover:bg-indigo-100/70"
                            : "hover:bg-slate-50"
                        } ${!hasEmail ? "opacity-60 cursor-default" : ""}`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!hasEmail}
                            onChange={() => toggleSelect(a.idalum)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 accent-indigo-600 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title={hasEmail ? "Incluir en el envío" : "Sin email"}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                            codigo && codigo > 0
                              ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}>
                            {codigo !== null && codigo > 0 ? codigo : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {nombreCompleto(a)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {a.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getNivelColor(a)}`}>
                            {getNivelLabel(a)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {formatFechaExa(a.f_exa)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {formatHoraExa(a.h_exa)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {a.alumno_registro
                            ? new Date(a.alumno_registro).toLocaleDateString("es-MX", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── PIE DE TABLA: ACCIONES ── */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {filteredAlumnos.length.toLocaleString("es-MX")}
                <span className="text-slate-400 font-normal">de {alumnos.length.toLocaleString("es-MX")}</span>
              </span>
              {someSelected && (
                <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 font-medium text-indigo-700 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {toSend.length} seleccionado{toSend.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSendEmails}
              disabled={sending || toSend.length === 0}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                toSend.length > 0 && !sending
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:scale-95"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Enviando…
                </>
              ) : toSend.length > 0 ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Enviar a {toSend.length} destinatario{toSend.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Selecciona destinatarios
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="mt-8 py-4 border-t border-slate-200">
        <p className="text-center text-xs text-slate-400">
          Sistema de re-envío de códigos · Institución Educativa ·{" "}
          <a href="https://re-envio.vercel.app" target="_blank" rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-600 transition-colors">
            re-envio.vercel.app
          </a>
        </p>
      </footer>
    </div>
  );
}
