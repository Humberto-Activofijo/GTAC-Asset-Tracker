# Envío de alertas por Outlook corporativo de GTAC

Nueva dirección: en lugar de pedirle a TI un registro de aplicación, conectamos
el buzón de Outlook corporativo tuyo directamente y las alertas salen desde ahí.
Solo necesitas autorizar el acceso una vez; no se toca DNS, ni SMTP, ni servidores.

## Opciones evaluadas

| Ruta | Quién interviene | Observaciones |
| --- | --- | --- |
| **Conectar tu Outlook (elegida)** | Solo tú: autorizas el acceso con tu cuenta Microsoft una vez. | Los correos salen de tu buzón corporativo (reputación de gtac.com.mx), sin solicitud a TI. |
| Registro de aplicación en Entra por TI | TI crea la app y entrega credenciales. | Plan B si más adelante quieres un buzón dedicado tipo `alertas@gtac.com.mx`. |
| Plataforma de correo externa con subdominio | TI configura DNS. | Descartada: pide más a TI y riesgo de spam en buzones corporativos. |

No existe un remitente "del sistema" genérico o gratuito: todo correo debe salir
de un dominio propio verificado. Con tu Outlook conectado ya se cumple, porque
el remitente es tu buzón @gtac.com.mx.

## Puntos a tener en cuenta con tu Outlook conectado

- El remitente será **tu buzón** (hcruz@gtac.com.mx), no un buzón dedicado. Si
  luego prefieres `alertas@gtac.com.mx`, TI solo tendría que habilitar ese
  buzón compartido y reconectamos con esa cuenta.
- Los envíos pueden quedar registrados en tus Elementos enviados.
- Si Microsoft exige aprobación del administrador para el permiso de envío en
  su tenant, TI solo tendría que aprobar esa autorización una vez; no crea
  nada ni entrega credenciales.
- La conexión se administra en Lovable; si en el futuro se revoca, bastaría
  reconectarla (la app avisará con estado *Correo fallido*).

## Qué haré al aprobar el plan

1. Abrir la tarjeta de conexión de Outlook para que inicies sesión con tu
   cuenta Microsoft corporativa y autorices el envío de correo.
2. Adaptar el envío de alertas en el servidor para usar esa conexión
   (endpoint de envío de Microsoft Graph ya existente, ahora autenticado con
   la conexión). Las credenciales permanecen solo en el servidor; nada toca el
   frontend ni el escáner, movimientos, alertas ni reglas de negocio.
3. Pedirte la lista de destinatarios (por ejemplo, tu correo y el de
   operaciones) y dejarla como configuración del servidor.
4. Enviar un correo de prueba real y confirmar que llega.
5. Verificar en **Alertas** que una alerta pasa de *Correo pendiente* a
   *Correo enviado* y que **Reintentar notificación** funciona.
6. Actualizar `docs/CORREO_ALERTAS.md` con la nueva forma de conexión.

## Notas

- Mientras la conexión no exista, nada se rompe: las alertas se siguen creando
  y quedan en estado *Correo pendiente*.
- No se envían recordatorios automáticos: la revisión de tránsito +48 h sigue
  siendo manual desde el botón de administrador.
- Sin cambios de diseño, sin migraciones de base de datos.
