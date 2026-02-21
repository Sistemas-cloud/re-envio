import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { AgAlumno } from "@/types/database";

const EXPEDIENTE_URL = "https://winston93.edu.mx/agenda/inicio/nuevo.php";

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

function getNIng(a: AgAlumno): number | null {
  const raw = a.n_ing;
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isNaN(n) ? null : n;
}

/** URL base para imágenes del correo (debe ser la URL pública de la app). */
function getBaseUrl(): string {
  const url =
    process.env.EMAIL_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return url.replace(/\/$/, "");
}

/** Devuelve la ruta de la imagen según n_ing: 1,2 → citae.png; 3,4 → citaw.png. */
function getImagenCita(nIng: number | null): string | null {
  if (nIng === null) return null;
  if (nIng === 1 || nIng === 2) return "citae.png";
  if (nIng === 3 || nIng === 4) return "citaw.png";
  return null;
}

/** Formatea fecha para mostrar (f_exa puede ser YYYY-MM-DD o similar). */
function formatFecha(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "—";
  const d = new Date(s.trim());
  if (Number.isNaN(d.getTime())) return s.trim();
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Formatea hora para mostrar (h_exa). */
function formatHora(s: string | null | undefined): string {
  if (!s) return "—";
  const str = String(s).trim();
  if (!str) return "—";
  return str;
}

function buildEmailHtml(alumno: AgAlumno, codigo: number | null): string {
  const nombreCompleto =
    [alumno.nombre, alumno.ap_pat, alumno.ap_mat].filter(Boolean).join(" ").trim() || "Alumno/a";
  const nIng = getNIng(alumno);
  const imgName = getImagenCita(nIng);
  const baseUrl = getBaseUrl();
  const imgSrc = imgName && baseUrl ? `${baseUrl}/img/${imgName}` : null;
  const fechaExa = formatFecha(alumno.f_exa);
  const horaExa = formatHora(alumno.h_exa);
  const linkExpediente = codigo != null ? `${EXPEDIENTE_URL}?codigo=${encodeURIComponent(codigo)}` : EXPEDIENTE_URL;
  const nombreInstitucion = nIng === 3 || nIng === 4 ? "Instituto Winston Churchill" : "Instituto Educativo Winston";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cita y código - Instituto Educativo Winston</title>
</head>
<body style="margin:0; padding:0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; color: #334155;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px; box-sizing: border-box;">
    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 14px; color: #1e40af; line-height: 1.5;">
      <strong>Nota:</strong> Este correo es un reenvío para destinatarios a quienes es posible que no les haya llegado la información. Si ya recibió este correo con anterioridad o ya realizó su expediente inicial, puede hacer caso omiso de este mensaje.
    </div>

    <p style="font-size: 16px; line-height: 1.6;">Hola ${nombreCompleto},</p>

    ${imgSrc ? `<p style="margin: 16px 0;"><img src="${imgSrc}" alt="Cita examen de admisión" style="max-width: 100%; height: auto; display: block; border-radius: 8px;" /></p>` : ""}

    <div style="background: #fff; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Fecha del examen:</p>
      <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${fechaExa}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Hora del examen:</p>
      <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${horaExa}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Código para tu expediente inicial:</p>
      <p style="margin: 0; font-size: 20px; font-weight: 700; color: #4338ca; letter-spacing: 0.05em;">${codigo ?? "—"}</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; margin: 24px 0 16px 0;">Utiliza el enlace siguiente y tu código para llenar tu expediente inicial:</p>
    <p style="margin: 0 0 24px 0;">
      <a href="${linkExpediente}" style="display: inline-block; background: #4338ca; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px;">Llenar expediente inicial</a>
    </p>

    <p style="font-size: 14px; color: #64748b;">Saludos,<br />${nombreInstitucion}</p>
  </div>
</body>
</html>
`.trim();
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Faltan variables SMTP: SMTP_HOST, SMTP_USER, SMTP_PASS en .env.local"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alumnos } = body as { alumnos: AgAlumno[] };

    if (!alumnos?.length) {
      return NextResponse.json(
        { error: "No hay registros con email para enviar" },
        { status: 400 }
      );
    }

    const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "noreply@localhost";
    const transporter = getTransporter();
    /** Si está definido, todos los correos se envían a esta dirección (modo pruebas). */
    const testTo = process.env.EMAIL_TEST_TO?.trim() || null;
    /** Copia oculta (BCC): si está definido, se envía una copia a esta dirección en cada correo. */
    const bcc = process.env.EMAIL_BCC?.trim() || undefined;

    const results: { email: string; codigo: number | null; ok: boolean; error?: string }[] = [];

    for (const alumno of alumnos) {
      const email = alumno.email?.trim();
      if (!email) continue;

      const codigo = getCodigo(alumno);
      const nombreCompleto = [alumno.nombre, alumno.ap_pat, alumno.ap_mat]
        .filter(Boolean)
        .join(" ")
        .trim() || "Alumno/a";

      const toAddress = testTo ?? email;
      const subjectBase = `Cita examen de admisión - Código ${codigo ?? "N/A"} - Instituto Winston`;
      const subject = testTo ? `[PRUEBA - destinatario real: ${email}] ${subjectBase}` : subjectBase;

      const htmlBase = buildEmailHtml(alumno, codigo);
      const html = testTo
        ? `<div style="background: #fef3c7; color: #92400e; padding: 12px 16px; margin-bottom: 20px; border-radius: 8px; font-size: 14px;"><strong>Modo pruebas.</strong> Este correo estaba dirigido a: <strong>${email}</strong> (${nombreCompleto}).</div>${htmlBase}`
        : htmlBase;

      try {
        await transporter.sendMail({
          from,
          to: toAddress,
          ...(bcc && { bcc }),
          subject,
          html,
        });
        results.push({ email, codigo, ok: true });
      } catch (err) {
        results.push({
          email,
          codigo,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    const firstError = failed[0]?.error;

    let message: string;
    if (okCount === 0 && results.length > 0 && firstError) {
      message = `No se pudo enviar ningún correo. Error: ${firstError}`;
    } else if (failed.length > 0) {
      message = testTo
        ? `[Pruebas] Enviados ${okCount} de ${results.length} a ${testTo}. Fallos: ${failed.length}. ${firstError ? `Error: ${firstError}` : ""}`
        : `Enviados ${okCount} de ${results.length}. Fallos: ${failed.length}. ${firstError ? `Error: ${firstError}` : ""}`;
    } else {
      message = testTo
        ? `[Pruebas] Enviados ${okCount} de ${results.length} correos a ${testTo}`
        : `Enviados ${okCount} de ${results.length} correos`;
    }

    return NextResponse.json({
      message,
      results,
      error: okCount === 0 && results.length > 0 ? firstError : undefined,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Error al enviar correos";
    console.error("[send-emails]", e);
    return NextResponse.json(
      { error: errMsg, details: e instanceof Error ? e.stack : String(e) },
      { status: 500 }
    );
  }
}
