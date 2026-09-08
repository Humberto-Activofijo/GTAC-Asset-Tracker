# GTAC — Trazabilidad de Activos · Fase 1

Base funcional y segura: autenticación real, roles, sitios, asignaciones y navegación. Sin activos, escáner, movimientos, inventarios, alertas, reportes ni correo de notificaciones.

## Backend (Lovable Cloud sobre PostgreSQL)

Se activa el backend integrado (PostgreSQL + autenticación gestionada). Todo el esquema queda en migraciones SQL versionadas, portables a un servidor propio.

### Tablas

- **profiles**: `id` (UUID, = usuario autenticado), `email` único, `full_name`, `active` (bool), `created_at`, `updated_at`.
- **user_roles**: `id`, `user_id`, `role` (`admin` | `engineer`), único por (user_id, role). El rol vive en tabla aparte por seguridad; nadie puede editar su propio rol.
- **sites**: `id`, `name`, `code` (opcional, único si existe), `active`, `latitude`, `longitude`, `created_at`, `updated_at`.
- **engineer_sites**: `id`, `engineer_id`, `site_id`, `active`, `created_at`, único por (engineer_id, site_id).

### Seguridad

- RLS activo en las cuatro tablas, con función `has_role(user_id, role)` de tipo security definer.
- Ingeniero: lee su propio perfil y solo los sitios que tiene asignados. No puede cambiar rol, `active` ni asignaciones.
- Admin: lee y gestiona perfiles, sitios y asignaciones.
- Sin registro público: la pantalla de acceso solo tiene inicio de sesión y recuperación de contraseña.
- Primer administrador: se otorga el rol por una sentencia SQL única ejecutada en la base de datos (no desde la aplicación) tras crear esa cuenta. Ninguna ruta de la app permite autoasignarse admin.
- Después de iniciar sesión se valida que el perfil esté activo; si no lo está, se cierra la sesión con mensaje claro.

### Alta individual de ingenieros (administrativa)

Operación de servidor protegida que solo ejecuta un administrador verificado en el servidor:

1. Crea la cuenta con correo y nombre, sin contraseña definida por el administrador (nunca se envían ni muestran contraseñas en texto plano).
2. Crea el perfil y asigna el rol `engineer`.
3. Permite asignar sus sitios en el mismo alta.
4. Genera y muestra al administrador un enlace de un solo uso para que la persona establezca su contraseña (misma pantalla de recuperación).

Sin importación masiva en esta fase.

## Pantallas

- **Acceso** (`/auth`): correo + contraseña, enlace de recuperación, y pantalla para definir la nueva contraseña.
- **Inicio**: saludo, indicador de conexión, selector horizontal de sitios asignados (la selección se conserva al navegar y se valida contra permisos), sitio actual, bloque de acciones rápidas preparado y "Actividad reciente" vacía.
- **Sitios**: listar, crear y editar sitios; asignar ingenieros. Solo administrador para escritura.
- **Ingenieros**: listado de perfiles con sus sitios asignados, alta individual y generación del enlace de contraseña (solo administrador).
- **Dashboard, Activos, Alertas, Reportes, Escanear**: pantalla "Módulo en desarrollo".

## Diseño

Fondo blanco, sidebar izquierdo en escritorio y navegación adaptada en móvil. Logo cuadrado negro con "GT", título GTAC y subtítulo "Trazabilidad de Activos". Elemento de menú activo en negro con texto blanco, tarjetas blancas con borde gris suave, botones redondeados. Menú de usuario con nombre, rol, cambiar contraseña y cerrar sesión.

## Calidad y pruebas

- Rutas protegidas, estados de carga y error explícitos, sin mensajes de éxito ante fallos, consultas acotadas, fechas guardadas en UTC y mostradas en horario de Ciudad de México.
- Pruebas de permisos reales con un administrador y dos ingenieros con sitios distintos: cada ingeniero solo ve sus sitios, el administrador ve todos, y ningún ingeniero puede cambiar su rol ni sus asignaciones. Solo se reportarán como aprobadas si realmente se ejecutan.

## Notas técnicas

- React + TypeScript + Vite (TanStack Router ya presente), módulos por dominio en `src/modules/*`.
- Claves públicas por variables de entorno; ningún secreto en el frontend.
- Migraciones SQL versionadas en `supabase/migrations`.
- `docs/DEPLOYMENT.md` documentará explícitamente qué NO se migra solo: servicio de autenticación (usuarios, contraseñas, correos de recuperación, plantillas y URLs de redirección), almacenamiento de archivos, funciones de servidor y sus variables/secretos, extensiones de PostgreSQL requeridas, y el orden de ejecución de migraciones.

## Entregable final

Al terminar se reporta: implementado, pendiente, migraciones creadas, cómo crear el primer administrador, qué configurar para probar el acceso, resultados de las pruebas de permisos y dependencias para servidores propios.
