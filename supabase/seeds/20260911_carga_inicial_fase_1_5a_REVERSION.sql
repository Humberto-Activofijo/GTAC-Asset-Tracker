-- GTAC · Fase 1.5A — Reversión de la carga inicial (correo | sitio)
-- Revierte ÚNICAMENTE los registros marcados con source = 'carga_inicial_fase_1_5a'.
-- No toca autenticación, roles, profiles, engineer_sites ni los sitios de prueba.

BEGIN;

-- 1) Asignaciones pendientes creadas por esta carga
DELETE FROM public.pending_engineer_sites
WHERE source = 'carga_inicial_fase_1_5a';

-- 2) Ingenieros pendientes creados por esta carga
DELETE FROM public.pending_engineers
WHERE source = 'carga_inicial_fase_1_5a';

-- 3) Sitios creados por esta carga que NO tengan asignaciones reales ni pendientes
DELETE FROM public.sites s
WHERE s.source = 'carga_inicial_fase_1_5a'
  AND NOT EXISTS (SELECT 1 FROM public.engineer_sites es WHERE es.site_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.pending_engineer_sites pes WHERE pes.site_id = s.id);

COMMIT;
