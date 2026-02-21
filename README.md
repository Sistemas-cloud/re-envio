# Envío de correos - ag_alumno

Proyecto Next.js (React, TypeScript, Tailwind) para enviar correos a los registros de la tabla **ag_alumno** de Supabase que tengan email, incluyendo su **código** en el mensaje.

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) con la tabla `ag_alumno`
- Servidor SMTP para enviar correos (Gmail, Office 365, etc.) o [Nodemailer](https://nodemailer.com) con cualquier SMTP

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

   - **NEXT_PUBLIC_SUPABASE_URL** y **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase → Settings → API.
   - **SMTP_HOST**, **SMTP_PORT** (ej. 587), **SMTP_USER**, **SMTP_PASS**: credenciales de tu servidor SMTP.
   - **SMTP_SECURE**: `true` para puerto 465, `false` para 587.
   - **EMAIL_FROM**: remitente (ej. `"Sistemas <sistemas@tudominio.edu.mx>"`).
   - **EMAIL_BASE_URL** (opcional): URL pública de la app (ej. `https://tu-app.vercel.app`) para que las imágenes del correo (citae.png, citaw.png) se muestren correctamente. Si no se define, se intenta usar `NEXT_PUBLIC_APP_URL` o, en Vercel, la URL del despliegue.
   - **EMAIL_TEST_TO** (opcional): si lo defines (ej. `sistemas@tudominio.edu.mx`), **todos** los correos se envían a esa dirección en lugar del destinatario real. El asunto incluye `[PRUEBA - destinatario real: ...]` y el cuerpo un aviso. Útil para pruebas. Para envío real, quita o deja vacía esta variable.

## Ejecución

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La página lista los registros de `ag_alumno` con email y permite enviar un correo a cada uno con su **código** en el asunto y en el cuerpo.

## Errores frecuentes al enviar

- **Connection refused / timeout**: El puerto SMTP (25, 587 o 465) puede estar bloqueado por tu red o proveedor. Prueba desde el mismo servidor donde está el correo o usa **587** con `SMTP_SECURE=false` (STARTTLS).
- **Invalid login / Authentication failed**: Revisa `SMTP_USER` y `SMTP_PASS` en `.env.local`.
- **No se pudo enviar ningún correo**: La interfaz muestra el mensaje de error del servidor SMTP; revisa la consola del navegador (F12 → Red) para ver la respuesta completa de `/api/send-emails` si hace falta.

## Estructura

- `app/page.tsx`: listado desde Supabase y botón para enviar correos.
- `app/api/send-emails/route.ts`: API que recibe la lista de alumnos y envía un correo por cada uno vía Nodemailer (SMTP).
- `lib/supabase.ts`: cliente de Supabase.
- `types/database.ts`: tipo TypeScript para `ag_alumno`.
