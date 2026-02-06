import { NextResponse } from "next/server";
import { Resend } from "resend";
import type { AgAlumno } from "@/types/database";

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

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

    const results: { email: string; codigo: number | null; ok: boolean; error?: string }[] = [];

    for (const alumno of alumnos) {
      const email = alumno.email?.trim();
      if (!email) continue;

      const codigo = alumno.codigo ?? null;
      const nombreCompleto = [alumno.nombre, alumno.ap_pat, alumno.ap_mat]
        .filter(Boolean)
        .join(" ")
        .trim() || "Alumno/a";

      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: `Tu código - ${codigo ?? "N/A"}`,
        html: `
          <p>Hola ${nombreCompleto},</p>
          <p>Tu código es: <strong>${codigo ?? "—"}</strong></p>
          <p>Saludos.</p>
        `,
      });

      results.push({
        email,
        codigo,
        ok: !error,
        error: error?.message,
      });
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      message: `Enviados ${okCount} de ${results.length} correos`,
      results,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al enviar correos" },
      { status: 500 }
    );
  }
}
