# Envío de correos - ag_alumno

Proyecto Next.js (React, TypeScript, Tailwind) para enviar correos a los registros de la tabla **ag_alumno** de Supabase que tengan email, incluyendo su **código** en el mensaje.

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) con la tabla `ag_alumno`
- Cuenta en [Resend](https://resend.com) para enviar correos (plan gratuito disponible)

## Instalación

```bash
cd ag-alumno-email
npm install
```

## Configuración

1. Copia el archivo de ejemplo de variables de entorno:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edita `.env.local` y rellena:

   - **NEXT_PUBLIC_SUPABASE_URL**: URL de tu proyecto (Supabase → Settings → API).
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY**: clave anon/public (Supabase → Settings → API).
   - **RESEND_API_KEY**: API Key de Resend (Dashboard → API Keys).
   - **EMAIL_FROM**: correo remitente (debe estar verificado en Resend). Si no lo configuras, se usará `onboarding@resend.dev` solo para pruebas.

## Ejecución

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La página lista los registros de `ag_alumno` con email y permite enviar un correo a cada uno con su **código** en el asunto y en el cuerpo.

## Estructura

- `app/page.tsx`: listado desde Supabase y botón para enviar correos.
- `app/api/send-emails/route.ts`: API que recibe la lista de alumnos y envía un correo por cada uno vía Resend.
- `lib/supabase.ts`: cliente de Supabase.
- `types/database.ts`: tipo TypeScript para `ag_alumno`.
