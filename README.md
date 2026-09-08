# GTAC: Asset Tracker

GTAC — Trazabilidad de Activos | Fase 1

Quiero desarrollar una aplicación web empresarial llamada GTAC — Trazabilidad de Activos, para administrar y dar seguimiento a activos fijos distribuidos en sitios de telecomunicaciones en México.

Esta es la primera fase de un proyecto que posteriormente deberá poder desplegarse en servidores propios de la empresa. El proyecto ya está vinculado a GitHub.

Objetivo de esta fase

Construye únicamente una base funcional y segura con autenticación, usuarios, sitios, asignaciones y navegación. No implementes todavía escáner, movimientos, inventarios, alertas, reportes ni integraciones de correo. No generes datos ficticios de producción.

Arquitectura

Utiliza React, TypeScript y Vite para el frontend, y PostgreSQL para la base de datos. Puedes utilizar Supabase si es el backend disponible en Lovable, manteniendo el código y el esquema lo más portables posible.

Organiza el código por módulos y utiliza variables de entorno. No incluyas secretos en el frontend. Prepara migraciones SQL versionadas y documenta las dependencias necesarias para una futura migración a infraestructura propia.

Autenticación

Implementa correo electrónico + contraseña con un proveedor de autenticación real.

No permitir registro público libre.

Los administradores podrán provisionar cuentas posteriormente.

Login, cerrar sesión y recuperación segura de contraseña.

Validar que el perfil esté activo después de autenticar.

Nunca permitir acceso solamente por escribir un correo.

No utilizar contraseñas compartidas o predeterminadas.

No eliminar y recrear usuarios para restablecer contraseñas.

Roles y permisos

Existen dos roles: admin y engineer.

El administrador puede consultar y gestionar todos los sitios y perfiles. El ingeniero solo puede consultar sus sitios asignados.

Los permisos deben aplicarse en backend/base de datos mediante RLS o mecanismo equivalente, no únicamente ocultando elementos de la interfaz. El usuario no puede modificar su propio rol ni asignaciones.

Prepara un mecanismo seguro para crear el primer administrador, sin permitir que cualquier usuario se otorgue privilegios.

Base de datos

Crea estas tres tablas iniciales:

profiles

id UUID, relacionado con el usuario autenticado

email único

full_name

role: admin / engineer

active

created_at

updated_at

sites

id UUID

name

code opcional

active

latitude opcional

longitude opcional

created_at

updated_at

engineer_sites

id UUID

engineer_id

site_id

active

created_at

La relación ingeniero-sitio es muchos a muchos. Un ingeniero puede tener varios sitios y un sitio puede tener varios ingenieros. Evita asignaciones duplicadas.

Diseño visual

La aplicación debe parecerse al sistema GTAC existente:

Fondo blanco y diseño corporativo sobrio.

Sidebar izquierdo en escritorio.

Logo cuadrado negro con letras GT.

Nombre GTAC y subtítulo "Trazabilidad de Activos".

Menú con Inicio, Dashboard, Sitios, Activos, Ingenieros, Alertas, Reportes y Escanear.

Elemento activo con fondo negro y texto blanco.

Tarjetas blancas con bordes grises suaves.

Botones redondeados y tipografía legible.

Navegación adaptada a móvil.

Menú de usuario con nombre, rol, cambiar contraseña y cerrar sesión.

Las secciones que todavía no se implementan deben mostrar una pantalla clara de "Módulo en desarrollo", sin inventar funcionalidades.

Pantalla Inicio

Después de iniciar sesión, mostrar:

Saludo al usuario.

Indicador de conexión.

Selector horizontal de sitios asignados.

Sitio seleccionado actualmente.

Bloque de acciones rápidas preparado para futuras funciones.

Sección de Actividad reciente vacía, preparada para conectar los movimientos más adelante.

El sitio seleccionado debe conservarse durante la navegación y validarse contra los permisos del usuario.

Administración inicial

Crear una pantalla de Ingenieros que permita al administrador listar perfiles y consultar sus sitios asignados. Crear una pantalla de Sitios que permita listar, crear y editar sitios, así como asignar ingenieros.

No implementar todavía importación masiva ni creación masiva de cuentas. Eso se realizará en una fase posterior con el archivo real de correos y sitios.

Calidad

Interfaz responsive.

Estados de carga y errores claros.

Rutas protegidas.

No mostrar éxito si una operación falló.

No cargar grandes cantidades de datos innecesariamente.

Fechas almacenadas en UTC y mostradas en America/Mexico_City.

Código limpio y preparado para futuras fases.

Entrega

Antes de implementar, presenta un plan breve de la arquitectura y las tablas. Después construye solamente lo especificado.

Al finalizar, indícame:

Qué quedó implementado.

Qué quedó pendiente.

Qué migraciones se crearon.

Cómo se crea de forma segura el primer administrador.

Qué debo configurar para probar el login.

Qué dependencias debemos considerar para migrar a servidores propios.

No intentes implementar funcionalidades adicionales ni modificar la arquitectura sin explicarlo primero.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3e65f762-5e58-40bd-9cc5-77df7199817a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
