# Colocar el logotipo GTAC adjunto

## Objetivo
Reemplazar el recuadro negro "GT" por el logotipo oficial adjunto (`LOGOTIPOS_GTAC_2021_1COLOR.png`) en toda la app y usarlo como ícono de la pestaña del navegador.

## Cambios

1. **Subir el logo como recurso CDN**
   - Crear el puntero con `lovable-assets create --file /mnt/user-uploads/LOGOTIPOS_GTAC_2021_1COLOR.png` en `src/assets/gtac-logo.png.asset.json` (sin copiar el binario al repositorio).

2. **Actualizar el componente de marca `GtacBrand`** (`src/modules/layout/AppLayout.tsx`)
   - Sustituir el bloque negro "GT" por `<img>` del logo (alto ~40 px, ancho automático, `alt="GTAC"`).
   - El logo ya incluye el símbolo, la palabra GTAC® y el eslogan "La red que conecta a México", por lo que se mantiene visible junto al texto "GTAC CAT / Control de Activos y Trazabilidad" (el texto de la app se conserva).
   - Este componente se reutiliza automáticamente en: menú lateral, encabezado móvil, pantalla de acceso (`/auth`) y recuperación de contraseña (`/reset-password`).

3. **Favicon**
   - Generar `public/favicon.png` (64×64, centrado, sin deformar) a partir del logo con ImageMagick.
   - Actualizar `head().links` en `src/routes/__root.tsx` para apuntar a `/favicon.png`.
   - Eliminar el `public/favicon.ico` por defecto de la plantilla.

## Verificación
- Typecheck limpio.
- Revisión visual con Playwright del menú lateral y la pantalla de acceso mostrando el nuevo logo, y confirmación del favicon.

## Fuera de alcance
Sin cambios de funcionalidad, textos de marca, colores del tema ni navegación.
