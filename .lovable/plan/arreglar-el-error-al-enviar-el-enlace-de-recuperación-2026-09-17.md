# Arreglar el error al enviar el enlace de recuperación

## Qué encontré

- Los servidores de la app responden bien: el servicio de acceso contestó correctamente desde fuera del navegador y acepta peticiones desde la dirección del preview.
- El mensaje rojo que ves no viene del servidor: tu navegador no logró siquiera enviar la petición (falló tanto "Entrar" como "Enviar enlace" con el mismo fallo de red, con segundos de diferencia). Eso apunta a la conexión o a algo que bloquea la petición en tu equipo: red corporativa/VPN, antivirus, bloqueador de anuncios o la pestaña del preview con la sesión colgada.
- Además, la app muestra siempre el mismo texto genérico, así que un problema de conexión se ve igual que un correo inexistente o una contraseña equivocada. Eso hace imposible distinguir qué pasó.
- El proyecto no tiene dominio de correo propio configurado: los correos de recuperación salen con el remitente genérico, lo que en cuentas corporativas como gtac.com.mx suele terminar en correo no deseado o bloqueado por el filtro de la empresa.

## Qué haré

1. **Mensajes de error honestos** en la pantalla de acceso (entrar y recuperar):
   - Sin conexión / petición bloqueada: "No se pudo contactar al servidor. Revisa tu conexión, VPN o bloqueador y vuelve a intentar."
   - Demasiados intentos: aviso de esperar unos minutos.
   - Credenciales incorrectas o cuenta desactivada: como hoy.
   - Botón "Reintentar" cuando el fallo fue de red.
2. **Diagnóstico rápido en pantalla**: al fallar por red, un texto pequeño con la hora y el motivo técnico, para saber si es la red o el servidor.
3. **Ruta alterna sin depender del correo**: en el módulo Ingenieros ya existe la generación de un enlace de un solo uso por parte de un administrador. Lo dejaré también disponible para tu propia cuenta, de modo que puedas establecer contraseña aunque el correo no llegue.
4. **Verificación contigo**: probaré entrar y pedir enlace desde la app publicada (gtaccat.lovable.app) y te diré si el envío se registra correctamente del lado del servidor.

## Lo que necesitaré de ti

- Intentarlo una vez desde la app publicada en una pestaña nueva, y desde otra red (por ejemplo datos del celular), para confirmar que el bloqueo es de la red de la oficina.
- Si quieres que los correos lleguen de forma confiable a buzones @gtac.com.mx, hay que configurar un dominio de correo propio; dime si lo hacemos y con qué dominio.

## Detalles técnicos

- Archivos: `src/routes/auth.tsx` (manejo de `AuthRetryableFetchError` / `TypeError: Failed to fetch`, códigos `invalid_credentials`, `over_email_send_rate_limit`), `src/routes/reset-password.tsx` (ya corregido para mostrar el motivo real, p. ej. `same_password`).
- Sin cambios en base de datos, RLS, roles ni reglas de negocio.
- Comprobado: `/auth/v1/health` 200 y preflight CORS 204 con `access-control-allow-origin` del preview; el fallo es previo al servidor.
