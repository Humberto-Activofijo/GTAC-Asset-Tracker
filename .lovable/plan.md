# Envío de alertas por Outlook corporativo de GTAC

El envío de correo ya está programado en la aplicación. Falta únicamente que TI
entregue los datos de la cuenta corporativa y que los guardemos de forma segura
en el servidor. Abajo está la lista exacta para pedirla a TI.

## Sobre tu pregunta: ¿un correo "del sistema" sin pedir nada a TI?

No existe un remitente genérico o gratuito disponible: cualquier correo que la
aplicación envíe debe salir de un dominio propio y verificado. Las dos rutas
posibles son:

| Ruta | Qué se pide a TI | Riesgo |
| --- | --- | --- |
| **Outlook corporativo (recomendada, este plan)** | Registro de aplicación en Entra con `Mail.Send`. No se toca DNS ni servidores de correo. | Ninguno relevante; los correos salen del dominio gtac.com.mx con reputación corporativa. |
| **Plataforma de correo externa con subdominio** (p. ej. `alertas.gtac.com.mx` delegado al servicio de envío) | Que TI agregue registros DNS (delegación de subdominio) en el proveedor que administra gtac.com.mx. | Configurar DNS una vez; los buzones @gtac.com.mx podrían marcar como spam un remitente que no es un buzón corporativo real. |

En ambas rutas interviene TI; la de Outlook corporativo es la que menos pide
(no toca DNS ni requiere hosting de correo) y la que mejor llega a buzones
@gtac.com.mx, porque los correos salen exactamente igual que un correo enviado
por ese buzón. Por eso se mantiene como plan.



## Lo que hay que pedir a TI

**1. Registro de aplicación en Microsoft Entra (Azure AD)**

Pedir a TI que cree un registro de aplicación (por ejemplo "GTAC CAT - Alertas")
y entregue estos tres datos:

| Dato | Cómo lo nombra TI |
| --- | --- |
| ID de directorio (tenant) | Directory (tenant) ID |
| ID de aplicación | Application (client) ID |
| Secreto de cliente | Client secret (valor, no el ID) — anotar fecha de vencimiento |

**2. Permiso**

La aplicación necesita el permiso **de aplicación** `Mail.Send` de Microsoft Graph,
con **consentimiento del administrador** otorgado. No sirve el permiso "delegado".

Recomendado: pedir a TI que limite ese permiso al buzón remitente mediante una
política de acceso a aplicaciones (Application Access Policy), para que la
aplicación no pueda enviar desde cualquier buzón de la organización.

**3. Buzón remitente**

Una cuenta o buzón compartido con licencia de Exchange Online desde el cual
saldrán las alertas, por ejemplo `alertas@gtac.com.mx`.

**4. Destinatarios**

La lista de correos que deben recibir las alertas (uno o varios, separados por
comas), por ejemplo el correo del área de operaciones.

**5. Red / salida a internet**

Confirmar que TI no bloquea la salida hacia:
- `login.microsoftonline.com`
- `graph.microsoft.com`

## Dominios y direcciones involucradas

- `login.microsoftonline.com` — autenticación de la aplicación.
- `graph.microsoft.com` — envío del correo.
- `gtac.com.mx` — dominio del buzón remitente y de los destinatarios.

No se requiere abrir puertos ni configurar SMTP, ni tocar los registros DNS de
`gtac.com.mx`: el envío usa la API de Microsoft 365 con la propia cuenta
corporativa, así que los correos salen con la reputación del dominio de GTAC.

## Qué haré cuando TI entregue los datos

1. Guardar los cinco valores como secretos del servidor (nunca en el frontend):
   `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`,
   `ALERT_EMAIL_SENDER`, `ALERT_EMAIL_RECIPIENTS`.
2. Enviar un correo de prueba real desde el servidor y confirmar que llega al
   buzón destino.
3. Verificar en **Alertas** que una alerta pasa de *Correo pendiente* a
   *Correo enviado*, y que **Reintentar notificación** funciona.
4. Dejar en `docs/CORREO_ALERTAS.md` la lista anterior como formato de solicitud
   a TI, con la nota de renovar el secreto antes de su vencimiento.

## Notas

- Mientras falten los datos, nada se rompe: las alertas se siguen creando y se
  quedan en estado *Correo pendiente*.
- El secreto de cliente caduca (normalmente entre 6 y 24 meses). Conviene pedir
  a TI la fecha de vencimiento y agendar su renovación.
- No se envían recordatorios automáticos: la revisión de tránsito +48 h sigue
  siendo manual desde el botón de administrador.
