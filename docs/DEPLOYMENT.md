# GTAC — Notas de despliegue y migración a infraestructura propia

## Estado actual (Fase 1)

- Frontend: React + TypeScript + Vite (TanStack Start / Router), organizado por módulos en `src/modules`.
- Backend inicial: Lovable Cloud (PostgreSQL gestionado + servicio de autenticación + funciones de servidor).
- Esquema: migraciones SQL versionadas en `supabase/migrations`, aplicadas en orden cronológico.

## Variables de entorno

Cliente (públicas, prefijo `VITE_`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Servidor (nunca en el frontend):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo para el alta administrativa de cuentas)

## Primer administrador (procedimiento seguro)

1. Crear la cuenta de correo del administrador desde el panel de usuarios del backend (o con la API de administración). No se permite registro público desde la aplicación.
2. Ejecutar una sola vez, directamente contra la base de datos:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@empresa.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

3. Verificar que el perfil exista y esté activo:

```sql
SELECT id, email, active FROM public.profiles WHERE email = 'admin@empresa.com';
```

La tabla `public.user_roles` no acepta escrituras desde la aplicación (solo lectura con RLS); el rol de administrador únicamente puede otorgarse desde la base de datos o con la llave de servicio. Ninguna ruta de la aplicación permite que un usuario se otorgue privilegios.

## Qué NO se migra automáticamente

Al mover el sistema a servidores propios hay que sustituir o reconfigurar explícitamente:

1. **Autenticación**. El servicio de identidad (usuarios, hashes de contraseña, tokens de recuperación, plantillas de correo, URLs de redirección permitidas y JWKS) es un componente independiente de PostgreSQL. Opciones: desplegar GoTrue/Supabase self-hosted (permite migrar el esquema `auth` tal cual) o sustituirlo por Keycloak/Authentik/una implementación propia. En este último caso hay que:
   - Migrar las cuentas y forzar un restablecimiento de contraseña (los hashes pueden no ser portables).
   - Reimplementar `auth.uid()` en las políticas RLS con el claim equivalente del nuevo emisor de tokens.
   - Reemplazar los llamados `supabase.auth.*` del frontend y el middleware `requireSupabaseAuth` del servidor.
2. **API de datos con RLS**. Las consultas del frontend usan PostgREST. En infraestructura propia hay que desplegar PostgREST (recomendado, mantiene el código igual) o sustituirlo por una capa de API propia. Las políticas RLS y los `GRANT` se migran con las migraciones SQL.
3. **Funciones de servidor**. `src/lib/admin.functions.ts` (alta de ingenieros y generación de enlaces) usa la API de administración de autenticación y la llave de servicio. Debe reapuntarse al nuevo proveedor de identidad. Se ejecuta en un runtime tipo Worker: al migrar a Node.js hay que revisar dependencias nativas.
4. **Correo saliente**. Los correos de recuperación de contraseña los envía hoy el servicio gestionado. En servidores propios se requiere un SMTP o proveedor transaccional configurado en el servicio de identidad.
5. **Almacenamiento de archivos**. No se usa en Fase 1. Cuando se agreguen fotos o documentos de activos habrá que desplegar un almacenamiento compatible (S3/MinIO o Supabase Storage self-hosted) y migrar los objetos y sus políticas.
6. **Extensiones y ajustes de PostgreSQL**. Requeridos: PostgreSQL 15 o superior con `pgcrypto` (`gen_random_uuid`). Si a futuro se usan tareas programadas o llamadas HTTP desde la base de datos, se necesitarán `pg_cron` y `pg_net`.
7. **Respaldos, monitoreo y TLS**. Hoy los cubre la plataforma; en servidores propios deben implementarse (respaldos automáticos, retención, certificados y observabilidad).

## Orden de migración recomendado

1. Levantar PostgreSQL y aplicar `supabase/migrations` en orden.
2. Desplegar el servicio de identidad y migrar/recrear las cuentas.
3. Desplegar PostgREST (o la API sustituta) y verificar RLS con cuentas de prueba de cada rol.
4. Construir el frontend (`npm run build`) apuntando a las nuevas variables de entorno.
5. Otorgar el rol de administrador inicial con el procedimiento descrito arriba.
