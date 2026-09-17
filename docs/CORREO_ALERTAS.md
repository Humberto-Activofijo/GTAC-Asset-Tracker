# GTAC — Notificación por correo de alertas (Fase 5.1)

## Alcance

- Sin cron ni revisión automática. El tránsito +48 h se revisa solo cuando un
  administrador pulsa **Revisar tránsito +48h**.
- Se envía correo únicamente por alertas nuevas creadas en esa ejecución.
- Las alertas de omisión de protocolo notifican inmediatamente después de
  confirmarse el movimiento, la actualización del activo y la alerta.

## Proveedor de envío (configuración vigente)

El envío se resuelve en `src/lib/email/mailer.server.ts` con este orden:

1. **Cuenta de Gmail conectada** (actual): conector `google_mail` a través del
   connector gateway, remitente `alertas.gtac@gmail.com`. Requiere
   `GOOGLE_MAIL_API_KEY` (lo administra el conector), `LOVABLE_API_KEY`,
   `ALERT_EMAIL_SENDER` y `ALERT_EMAIL_RECIPIENTS`.
2. **Microsoft Graph / Outlook corporativo** (alternativa): se activa solo si no
   hay conexión de Gmail y existen `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`,
   `MS_GRAPH_CLIENT_SECRET`, `ALERT_EMAIL_SENDER` y `ALERT_EMAIL_RECIPIENTS`.
   La aplicación de Entra requiere el permiso de aplicación **Mail.Send** con
   consentimiento de administrador.

Todas son variables **solo del servidor**; nunca se exponen en el frontend.
Mientras falte cualquiera, las alertas siguen creándose y consultándose
normalmente; el correo queda en estado **Correo pendiente** con el detalle.

Límite práctico de Gmail: ~500 correos al día. El remitente es una cuenta
`@gmail.com`; para mejorar la imagen y la entrega conviene migrar al buzón
corporativo cuando TI apruebe el registro en Entra.

## Recuperación de contraseña

El correo de restablecimiento no usa el envío automático del backend: la ruta
pública `src/routes/api/public/password-reset.ts` genera el enlace de un solo
uso del lado del servidor y lo envía por el mismo proveedor de Gmail. Responde
siempre con el mismo mensaje exista o no la cuenta, y limita a 3 intentos por
correo cada 15 minutos.

## Estados de correo

- `PENDING`: aún no se envió (o falta configuración).
- `SENT`: enviado; no se vuelve a enviar nunca por esa alerta.
- `FAILED`: intento fallido; se guarda el error y permite reintento manual.

## Reintentar una notificación fallida

1. Entrar como administrador a **Alertas**.
2. Ubicar la alerta con estado *Correo pendiente* o *Correo fallido*.
3. Pulsar **Reintentar notificación**.
4. Si el envío funciona, el estado pasa a *Correo enviado* y se guarda la fecha.

Solo los administradores pueden ejecutar la revisión +48 h y reintentar envíos;
la validación ocurre en el servidor, no solo en la interfaz.
