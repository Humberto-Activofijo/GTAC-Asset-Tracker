# GTAC — Notificación por correo de alertas (Fase 5.1)

## Alcance

- Sin cron ni revisión automática. El tránsito +48 h se revisa solo cuando un
  administrador pulsa **Revisar tránsito +48h**.
- Se envía correo únicamente por alertas nuevas creadas en esa ejecución.
- Las alertas de omisión de protocolo notifican inmediatamente después de
  confirmarse el movimiento, la actualización del activo y la alerta.

## Configuración requerida (la debe proporcionar TI)

Variables de entorno **solo del servidor** (nunca en el frontend):

| Variable | Descripción |
| --- | --- |
| `MS_GRAPH_TENANT_ID` | ID del directorio (tenant) de Microsoft Entra. |
| `MS_GRAPH_CLIENT_ID` | ID de la aplicación registrada en Entra. |
| `MS_GRAPH_CLIENT_SECRET` | Secreto de cliente de esa aplicación. |
| `ALERT_EMAIL_SENDER` | Buzón remitente corporativo (por ejemplo `alertas@empresa.com`). |
| `ALERT_EMAIL_RECIPIENTS` | Destinatarios separados por comas. |

La aplicación de Entra requiere el permiso de aplicación **Mail.Send** de
Microsoft Graph con consentimiento de administrador.

Mientras falte cualquiera de estas variables, las alertas siguen creándose y
consultándose normalmente; el correo queda en estado **Correo pendiente** con
el detalle de lo que falta.

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
