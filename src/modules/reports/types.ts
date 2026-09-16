/** Tipos compartidos entre la interfaz y las rutas de exportación. */

export type MovementReportFilters = {
  from?: string;
  to?: string;
  action?: string;
  siteId?: string;
  assetNumber?: string;
  condition?: string;
  userId?: string;
  omission?: "" | "yes" | "no";
};

export type InventoryReportFilters = {
  siteId?: string;
  condition?: string;
  status?: string;
  assetNumber?: string;
  serialNumber?: string;
  model?: string;
};

export type MovementReportRow = {
  row_id: string;
  occurred_at: string;
  asset_id: string;
  asset_number: string;
  serial_number: string | null;
  model: string | null;
  action: string;
  site_id: string | null;
  site_name: string | null;
  user_email: string | null;
  condition: string;
  resulting_status: string;
  notes: string | null;
  protocol_omission: boolean;
  has_gps: boolean;
  has_photo: boolean;
  latitude: number | null;
  longitude: number | null;
  total_count: number;
};

export type InventoryReportRow = {
  id: string;
  site_id: string;
  site_name: string;
  asset_number: string;
  serial_number: string | null;
  model: string | null;
  category: string | null;
  condition: string;
  status: string;
  last_movement_at: string | null;
  created_at: string;
  total_count: number;
};

/** Convierte los filtros de la interfaz a los parámetros de la función de base de datos. */
export function movementRpcParams(f: MovementReportFilters): Record<string, unknown> {
  return {
    _from: f.from ? `${f.from}T00:00:00-06:00` : null,
    _to: f.to ? `${f.to}T23:59:59-06:00` : null,
    _action: f.action || null,
    _site_id: f.siteId || null,
    _asset_number: f.assetNumber?.trim() || null,
    _condition: f.condition || null,
    _user_id: f.userId || null,
    _omission: f.omission === "yes" ? true : f.omission === "no" ? false : null,
  };
}

export function inventoryRpcParams(f: InventoryReportFilters): Record<string, unknown> {
  return {
    _site_id: f.siteId || null,
    _condition: f.condition || null,
    _status: f.status || null,
    _asset_number: f.assetNumber?.trim() || null,
    _serial_number: f.serialNumber?.trim() || null,
    _model: f.model?.trim() || null,
  };
}
