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

## Fase 4 — pendiente

Movimientos (entrada/salida/tránsito), inventarios, alertas +48 h,
reportes, edición de activos desde la interfaz, carga masiva, correo y
sincronización offline.
