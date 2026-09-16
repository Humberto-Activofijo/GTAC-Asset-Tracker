import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, CameraOff, Keyboard, Loader2, Plus, Search } from "lucide-react";

import { PageHeader } from "@/modules/layout/PageHeader";
import { useSelectedSite } from "@/modules/sites/SelectedSiteContext";
import { AssetSummaryCard } from "@/modules/assets/AssetSummaryCard";
import { NewAssetDialog } from "@/modules/assets/NewAssetDialog";
import { lookupAssetByCode, normalizeCode, type LookupResult } from "@/modules/assets/lookup";
import { BarcodeScanner, type ScanEngine } from "@/modules/scan/BarcodeScanner";
import { MovementDialog } from "@/modules/movements/MovementDialog";
import {
  ACTION_LABEL,
  MOVEMENT_ACTIONS,
  type MovementAction,
} from "@/modules/movements/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/escanear")({
  head: () => ({
    meta: [
      { title: "Escanear — GTAC Trazabilidad de Activos" },
      {
        name: "description",
        content: "Identifica activos por QR, código de barras o captura manual desde tu sitio.",
      },
      { property: "og:title", content: "Escanear — GTAC Trazabilidad de Activos" },
      {
        property: "og:description",
        content: "Identifica activos por QR, código de barras o captura manual desde tu sitio.",
      },
    ],
  }),
  component: ScanPage,
});

const TOUCH = "h-14 text-base";

function ScanPage() {
  const { sites, selectedSite, selectSite } = useSelectedSite();
  // La cámara se enciende al entrar: apuntar y detectar, sin pasos previos.
  const [cameraOn, setCameraOn] = useState(true);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [engine, setEngine] = useState<ScanEngine | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [movementAction, setMovementAction] = useState<MovementAction | null>(null);

  const lookup = useMutation({
    mutationFn: (code: string) => lookupAssetByCode(code),
    onSuccess: (data) => setResult(data),
  });

  // Al salir de la pantalla la cámara se apaga y el stream se libera.
  useEffect(() => () => setCameraOn(false), []);

  function handleCode(code: string) {
    setCameraOn(false);
    lookup.mutate(code);
  }

  function handleManualSearch() {
    const code = normalizeCode(manualValue);
    if (!code) return;
    lookup.mutate(code);
  }

  if (!selectedSite) {
    return (
      <>
        <PageHeader title="Escanear" description="Identificación de activos." />
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Selecciona un sitio</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {sites.length === 0
              ? "Todavía no tienes sitios asignados. Contacta al administrador."
              : "Antes de escanear debes elegir el sitio desde el que estás trabajando."}
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Escanear" description="Identifica un activo por QR, código de barras o manualmente." />

      <section className="rounded-xl border border-border bg-card p-5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Sitio seleccionado para la operación
        </Label>
        <Select value={selectedSite.id} onValueChange={selectSite}>
          <SelectTrigger className={`mt-2 ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {sites
              .filter((s) => s.active)
              .map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">
          Solo aparecen los sitios a los que tienes acceso.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-5">
        <BarcodeScanner active={cameraOn} onDetected={handleCode} onEngineChange={setEngine} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button className={TOUCH} onClick={() => setCameraOn((v) => !v)}>
            {cameraOn ? (
              <>
                <CameraOff className="mr-2 h-5 w-5" />
                Detener escáner
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Iniciar escáner
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className={TOUCH}
            onClick={() => {
              setCameraOn(false);
              setManualOpen((v) => !v);
            }}
          >
            <Keyboard className="mr-2 h-5 w-5" />
            Captura manual
          </Button>
        </div>

        {engine && (
          <p className="mt-3 text-xs text-muted-foreground">
            Lectura {engine === "native" ? "nativa del dispositivo" : "por respaldo del navegador"}.
          </p>
        )}

        {manualOpen && (
          <div className="mt-4 space-y-2 rounded-lg border border-border p-4">
            <Label htmlFor="manual-code" className="text-sm">
              Número de activo / QR / Serie
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="manual-code"
                className={TOUCH}
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSearch();
                }}
                placeholder="Ej. GTAC-000123"
                autoFocus
              />
              <Button className={TOUCH} onClick={handleManualSearch} disabled={lookup.isPending}>
                <Search className="mr-2 h-5 w-5" />
                Buscar
              </Button>
            </div>
          </div>
        )}
      </section>

      {lookup.isPending && (
        <div className="mt-4 flex items-center justify-center rounded-xl border border-border bg-card py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {lookup.isError && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-card p-5 text-sm text-destructive">
          No fue posible consultar el código. Intenta de nuevo.
        </p>
      )}

      {!lookup.isPending && result && (
        <div className="mt-4">
          {result.asset ? (
            <>
              <AssetSummaryCard
                asset={result.asset}
                siteName={selectedSite.name}
                canOpenDetail={sites.some((s) => s.id === result.asset?.current_site_id)}
              />
              {result.matchedBy === "serial_number" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Encontrado por número de serie.
                </p>
              )}

              <section className="mt-4 rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">Registrar movimiento</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {MOVEMENT_ACTIONS.map((a) => (
                    <Button
                      key={a}
                      variant={a === "SALIDA" ? "outline" : a === "INVENTARIO" ? "secondary" : "default"}
                      className={TOUCH}
                      onClick={() => setMovementAction(a)}
                    >
                      {ACTION_LABEL[a]}
                    </Button>
                  ))}
                </div>
              </section>

              {movementAction && (
                <MovementDialog
                  open
                  onOpenChange={(v) => {
                    if (!v) setMovementAction(null);
                  }}
                  action={movementAction}
                  asset={result.asset}
                  siteId={selectedSite.id}
                  siteName={selectedSite.name}
                  onRegistered={() => {
                    setMovementAction(null);
                    if (result.code) lookup.mutate(result.code);
                  }}
                />
              )}
            </>
          ) : (
            <section className="rounded-xl border border-border bg-card p-5 text-center">
              <h2 className="text-base font-semibold text-foreground">Activo no encontrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                El código <span className="font-mono text-foreground">{result.code}</span> no
                está registrado en ningún sitio.
              </p>
              <Button className={`mt-4 w-full sm:w-auto ${TOUCH}`} onClick={() => setCreating(true)}>
                <Plus className="mr-2 h-5 w-5" />
                Dar de alta este activo
              </Button>
            </section>
          )}
        </div>
      )}

      <NewAssetDialog
        open={creating}
        onOpenChange={setCreating}
        initialAssetNumber={result?.asset ? "" : (result?.code ?? "")}
        initialSiteId={selectedSite.id}
        onCreated={() => {
          if (result?.code) lookup.mutate(result.code);
        }}
      />
    </>
  );
}
