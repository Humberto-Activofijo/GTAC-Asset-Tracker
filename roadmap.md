# GTAC

## Fase 1 — completada

- [x] Activar backend (PostgreSQL + auth)
- [x] Migración: profiles, user_roles, sites, engineer_sites + RLS + grants
- [x] Auth: login, recuperación, reset, validación de perfil activo
- [x] Layout GTAC (sidebar, menú usuario, móvil)
- [x] Inicio con selector de sitios
- [x] Sitios: listar/crear/editar/asignar ingenieros
- [x] Ingenieros: listar + alta individual + enlace de contraseña
- [x] docs/DEPLOYMENT.md
- [x] Pruebas de permisos (1 admin + 2 ingenieros) — 11/11 correctas

## Fase 1.5A — completada

- [x] Carga inicial por SQL de 80 ingenieros, 177 sitios y 203 asignaciones
- [x] Script de reversión

## Fase 2 — completada

- [x] Tabla assets + índices + RLS por sitio asignado
- [x] Bucket privado asset-photos + políticas
- [x] Alta de activo (Inicio y Activos), foto opcional
- [x] Catálogo con búsqueda, filtros y paginación del lado del servidor
- [x] Detalle de activo con sección Historial (vacía)
- [x] Actividad reciente en Inicio (altas)
- [x] Pruebas de permisos, duplicados, foto y zona horaria

## Fase 3 — completada

Escaneo QR/código de barras e identificación de activos en /escanear:
detección nativa (BarcodeDetector) con fallback ZXing, cámara trasera,
captura manual, ficha del activo identificado, alta desde código
inexistente y compresión de fotos en cliente (máx. 1600 px, ~JPEG 300 KB).

## Fase 4 — completada

Movimientos ENTRADA/SALIDA/INVENTARIO con tabla `movements`, estado
EN_TRANSITO, RPC transaccional `register_movement` (permiso por sitio,
idempotencia por client_operation_id, omisión de protocolo), acciones desde
Escanear, línea de tiempo del activo, actividad reciente combinada y
página /movimientos con filtros y paginación del lado del servidor.

## Fase 5 — completada

Alertas administrativas: tabla `alerts` (TRANSITO_48H / OMISION_PROTOCOLO,
OPEN / RESOLVED) con índices y restricción única por (tipo, movimiento);
trigger que crea la alerta de omisión dentro del registro del movimiento;
RPC idempotente `run_transit_48h_check`, `list_alerts`, `list_asset_alerts`,
`resolve_alert` y `alerts_dashboard`, todas restringidas a administradores;
pantalla /admin/alertas con pestañas y diálogo de resolución con notas
obligatorias; indicadores y botón de revisión en /dashboard; sección
"Alertas relacionadas" en la ficha del activo (solo admin).

## Fase 5.1 — completada

Notificación por correo de alertas mediante Microsoft Graph del lado del
servidor: columnas `email_status`, `email_sent_at`, `email_error` en `alerts`;
`run_transit_48h_check` devuelve los identificadores creados y solo se notifica
por esas alertas nuevas; correo inmediato al generarse una omisión de
protocolo; botón "Reintentar notificación" para administradores; sin cron ni
revisión automática. Configuración documentada en docs/CORREO_ALERTAS.md
(pendiente de credenciales reales de Microsoft 365).

## Fase 6 — completada

Dashboard administrativo con selector de periodo y cuatro gráficos, reportes de
movimientos e inventario con filtros y paginación del lado del servidor,
contadores y tabla de activos por sitio, y exportación real a .xlsx generada en
el servidor (`/api/reports/movements`, `/api/reports/inventory`) con recorrido
por cursor en bloques de 1,000 filas. Exportación exclusiva de administradores,
verificada en el servidor. Fechas almacenadas en UTC y mostradas en
America/Mexico_City.

## Pendiente

Credenciales Microsoft 365 para activar el envío real, tarea programada,
notificaciones push, reapertura de alertas, edición de activos desde la
interfaz, carga masiva y sincronización offline.
