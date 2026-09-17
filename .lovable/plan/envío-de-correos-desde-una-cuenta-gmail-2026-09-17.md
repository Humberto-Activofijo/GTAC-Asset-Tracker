# Envío de correos desde una cuenta Gmail

Sí se puede. En lugar de pedirle a TI que apruebe la aplicación en Microsoft, se crea una cuenta de Gmail para la aplicación (por ejemplo `alertas.gtac@gmail.com`), se autoriza una sola vez desde Lovable y desde ahí salen tanto las alertas como los correos de restablecimiento de contraseña.

## Lo que hay que saber antes de decidir

- El remitente visible será la cuenta de Gmail, no `@gtac.com.mx`. Funciona, pero se ve menos formal y algunos correos pueden caer en "No deseados" las primeras veces (se corrige marcándolos como "No es spam" o agregando al remitente a contactos).
- Límite de Gmail: unos 500 correos por día. Muy por encima del volumen de alertas esperado.
- Si más adelante TI aprueba el buzón corporativo, se cambia el remitente sin rehacer la aplicación.
- La cuenta de Gmail debe tener verificación en dos pasos y su contraseña resguardada; quien tenga acceso a ese buzón verá las alertas enviadas.

## Alternativas, por si prefieres otra

1. **Gmail de la aplicación** (esta propuesta): sin intervención de TI, listo el mismo día.
2. **Buzón corporativo de Outlook**: TI aprueba una sola vez el permiso de envío; mejor imagen y entrega. Es el plan anterior y sigue disponible.
3. **Dominio de correo propio verificado** (por ejemplo `alertas.gtac.com.mx`): requiere que TI agregue registros en el DNS del dominio.

## Qué se va a hacer

1. Crear (tú) la cuenta de Gmail para la aplicación y autorizarla en la tarjeta de conexión que abriré.
2. Cambiar el envío de alertas para que salga por esa cuenta, conservando los estados actuales: Correo pendiente / enviado / fallido y el botón "Reintentar notificación".
3. Hacer que el correo de restablecimiento de contraseña salga también por esa cuenta, con el texto y la imagen de GTAC CAT, en lugar del correo automático actual que no está llegando.
4. Definir contigo la lista de destinatarios de las alertas y guardarla como configuración del servidor.
5. Enviar un correo de prueba real de cada tipo (una alerta y un restablecimiento) y confirmar que llegan y que el enlace de contraseña funciona.
6. Actualizar la documentación interna de correo.

## Detalles técnicos

- Conector `google_mail` (Gmail API vía connector gateway, alcance `gmail.send`); credenciales solo en el servidor.
- Nuevo `src/lib/email/gmail.server.ts` con la misma interfaz `EmailOutcome` que `graph.server.ts`, y un selector en `sendAlertEmail`: usa Gmail si la conexión está presente, Microsoft Graph si están las variables `MS_GRAPH_*`, y devuelve `PENDING` si no hay ninguna. Así no se pierde el trabajo hecho para Outlook.
- Mensaje RFC 2822 codificado en base64url con cabeceras `Subject`/nombre en RFC 2047 (acentos), `Content-Type: text/html; charset=UTF-8`.
- Restablecimiento de contraseña: ruta pública `src/routes/api/public/password-reset.ts` que (a) limita intentos por correo, (b) genera el enlace de recuperación con la API administrativa de Supabase en el servidor, (c) lo envía por Gmail, y (d) responde siempre igual exista o no la cuenta, para no revelar usuarios. `src/routes/auth.tsx` llama a esta ruta en lugar de `resetPasswordForEmail`; se conservan los mensajes de error en español ya implementados.
- Sin migraciones, sin cambios de diseño, sin tocar escáner, movimientos, RLS ni reglas de negocio. Fechas en los correos en horario de Ciudad de México.
