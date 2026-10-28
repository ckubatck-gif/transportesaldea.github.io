# Gestión de mudanzas, transportes y repartos (PWA)

Aplicación web instalable (móvil y PC) para una sola persona: clientes, presupuestos, citas, agenda interactiva,
recordatorios de llamadas/eventos y un formulario público para recibir solicitudes fuera de horario.

- **Sin build**: HTML/CSS/JS puro. Solo el buzón de solicitudes usa funciones serverless de Vercel (`/api`).
- **Datos de la app**: se guardan en el navegador del dispositivo (`localStorage`). No hay cuentas ni login.
- **Solicitudes fuera de horario**: la página pública `/solicitar.html` las guarda **cifradas** (AES‑256‑GCM) en Vercel Blob;
  la app las descarga con la clave del buzón, las convierte en cliente + recordatorio de llamada y las borra del servidor.

## Puesta en marcha (Vercel)

1. Importa este repositorio como proyecto en Vercel (sin framework, sin comando de build).
2. En el proyecto: **Storage → Create → Blob** y conéctalo al proyecto. Eso crea `BLOB_READ_WRITE_TOKEN` automáticamente.
3. En **Settings → Environment Variables** crea `ADMIN_KEY`: una frase larga y aleatoria, **mínimo 16 caracteres**.
   Es la contraseña del buzón y además la semilla de cifrado: si la cambias, las solicitudes ya guardadas dejan de poder leerse.
4. Redespliega. Abre la app, ve a **Ajustes → Clave del buzón** e introduce la misma clave.
5. Edita `config.js` (nombre de empresa, teléfono, horario, IVA, responsable del tratamiento y enlace a la política de privacidad).

Si `ADMIN_KEY` o el almacén Blob no están configurados, la página pública lo dice y **no** finge que la solicitud se ha enviado.

## Qué hace y qué no

- Los recordatorios **solo se comprueban con la app abierta**. Si el sistema suspende la pestaña o la app está cerrada, el aviso no suena:
  al volver a abrirla aparece como vencido en «Hoy». Para alarmas con la app cerrada, usa **Exportar .ics** y súbelo a tu calendario del móvil.
- Los datos viven **en cada dispositivo**: no se sincronizan entre móvil y PC. Haz copias desde **Ajustes → Copia de seguridad → Exportar copia (.json)**.
  La copia no incluye la clave del buzón.
- No contesta llamadas ni mensajes por sí misma: "atención fuera de horario" = formulario + recordatorio de devolver la llamada.
- Festivos: solo los que pongas en `diasCerrados` de `config.js`.
- Arrastrar y soltar en la agenda funciona con ratón; en móvil se edita desde el diálogo de la cita.

## Privacidad y obligaciones legales (revisar)

El formulario público recoge datos personales. El texto informativo (RGPD art. 13) y la casilla de consentimiento incluidos son
**provisionales**: debes completar `responsable` y `politicaPrivacidadUrl` en `config.js` y revisarlos con tu asesor.
Las solicitudes pendientes se almacenan cifradas hasta que las importas; el límite es de 200 pendientes.
El IVA por defecto (21 %) y la validez de los presupuestos son valores de ejemplo: confírmalos con tu gestor.

## Estructura

| Ruta | Función |
| --- | --- |
| `index.html`, `main.js`, `views.js`, `core.js`, `styles.css` | La app |
| `config.js` | Datos de la empresa y horario |
| `solicitar.html`, `solicitar.js` | Formulario público |
| `api/solicitud.js` | Recibe solicitudes (público) |
| `api/solicitudes.js` | Lista/borra solicitudes (requiere `ADMIN_KEY`) |
| `lib/buzon.js`, `lib/store.js` | Validación, cifrado y acceso a Vercel Blob |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación como app y uso sin conexión |
