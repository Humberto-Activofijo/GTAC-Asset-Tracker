import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, MapPin, MapPinOff, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image";
import { ASSET_CONDITIONS, CONDITION_LABEL, STATUS_LABEL, type AssetCondition } from "@/modules/assets/queries";
import type { ScanAsset } from "@/modules/assets/lookup";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ACTION_LABEL,
  getCurrentCoords,
  registerMovement,
  type Coords,
  type MovementAction,
  type RegisterMovementResult,
} from "./queries";

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type === "image/png" ? "png" : "jpg";
}

/** Advertencias y bloqueos calculados con el estado real del activo. */
export function movementWarning(
  action: MovementAction,
  asset: ScanAsset,
  siteId: string,
  siteName: string,
): { blocked: boolean; message: string | null } {
  const sameSite = asset.current_site_id === siteId;
  if (action === "SALIDA") {
    if (asset.status === "EN_TRANSITO")
      return {
        blocked: true,
        message: "El activo ya figura en tránsito. Registra primero su entrada.",
      };
    if (!sameSite)
      return {
        blocked: true,
        message: `El activo figura en ${asset.current_site_name}. La salida solo puede registrarse desde ese sitio.`,
      };
    return { blocked: false, message: null };
  }
  if (action === "ENTRADA") {
    if (asset.status === "EN_TRANSITO") return { blocked: false, message: null };
    if (!sameSite)
      return {
        blocked: false,
        message: `El activo figura actualmente en ${asset.current_site_name} y no existe una salida previa registrada. Puedes continuar: quedará marcado como omisión de protocolo.`,
      };
    return {
      blocked: false,
      message: `El activo ya figura en ${siteName}. Se registrará la entrada sin cambiar su ubicación.`,
    };
  }
  if (asset.status === "EN_TRANSITO")
    return {
      blocked: false,
      message:
        "El activo figura en tránsito. Al confirmar su presencia física quedará en este sitio y se marcará como omisión de protocolo.",
    };
  if (!sameSite)
    return {
      blocked: false,
      message: `El activo figura en ${asset.current_site_name}. Al confirmar su presencia física aquí se corregirá su ubicación y se marcará como omisión de protocolo.`,
    };
  return { blocked: false, message: null };
}

export function MovementDialog({
  open,
  onOpenChange,
  action,
  asset,
  siteId,
  siteName,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: MovementAction;
  asset: ScanAsset;
  siteId: string;
  siteName: string;
  onRegistered?: (result: RegisterMovementResult) => void;
}) {
  const queryClient = useQueryClient();
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords>(null);
  const [gpsChecked, setGpsChecked] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  // Un identificador por apertura del diálogo: el reintento no duplica el movimiento.
  const [operationId, setOperationId] = useState<string>("");

  const warning = useMemo(
    () => movementWarning(action, asset, siteId, siteName),
    [action, asset, siteId, siteName],
  );

  useEffect(() => {
    if (!open) return;
    setCondition(asset.condition);
    setNotes("");
    setPhoto(null);
    setCoords(null);
    setGpsChecked(false);
    setOperationId(crypto.randomUUID());
    void getCurrentCoords().then((c) => {
      setCoords(c);
      setGpsChecked(true);
    });
  }, [open, asset.condition]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const mutation = useMutation({
    mutationFn: async (): Promise<RegisterMovementResult> => {
      let photoPath: string | null = null;
      if (photo) {
        const optimized = await compressImage(photo);
        const path = `${siteId}/${crypto.randomUUID()}.${extensionOf(optimized)}`;
        const { error: uploadError } = await supabase.storage
          .from("asset-photos")
          .upload(path, optimized, {
            contentType: optimized.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError)
          throw new Error(
            "No fue posible guardar la evidencia. Revisa que el sitio te esté asignado.",
          );
        photoPath = path;
      }

      return registerMovement({
        assetId: asset.id,
        action,
        siteId,
        clientOperationId: operationId,
        condition,
        notes: notes.trim() || null,
        photoUrl: photoPath,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
    },
    onSuccess: (result) => {
      toast.success(
        result.duplicate
          ? "Este movimiento ya estaba registrado."
          : `${ACTION_LABEL[action]} registrada correctamente.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      onOpenChange(false);
      onRegistered?.(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar {ACTION_LABEL[action].toLowerCase()}</DialogTitle>
          <DialogDescription>Revisa el resumen antes de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
            <p>
              Activo: <span className="font-semibold">{asset.asset_number}</span>
            </p>
            <p>
              Ubicación actual: <span className="font-semibold">{asset.current_site_name}</span>{" "}
              ({STATUS_LABEL[asset.status] ?? asset.status})
            </p>
            <p>
              Sitio seleccionado: <span className="font-semibold">{siteName}</span>
            </p>
            <p>
              Condición actual:{" "}
              <span className="font-semibold">{CONDITION_LABEL[asset.condition]}</span>
            </p>
            <p>
              Acción: <span className="font-semibold">{ACTION_LABEL[action]}</span>
            </p>
          </div>

          {warning.message && (
            <p
              role="alert"
              className={`rounded-lg border px-4 py-3 text-sm ${
                warning.blocked
                  ? "border-destructive/40 text-destructive"
                  : "border-dashed border-border text-muted-foreground"
              }`}
            >
              {warning.message}
            </p>
          )}

          <div className="space-y-2">
            <Label>Condición física</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as AssetCondition)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONDITION_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-notes">Notas (opcional)</Label>
            <Textarea
              id="movement-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Evidencia fotográfica (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                Tomar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Subir foto
              </Button>
              {photo && (
                <Button type="button" variant="ghost" className="h-12" onClick={() => setPhoto(null)}>
                  <X className="mr-2 h-4 w-4" />
                  Quitar
                </Button>
              )}
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Vista previa de la evidencia"
                className="mt-2 h-40 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {coords ? (
              <>
                <MapPin className="h-3.5 w-3.5" />
                Ubicación GPS capturada.
              </>
            ) : (
              <>
                <MapPinOff className="h-3.5 w-3.5" />
                {gpsChecked
                  ? "El movimiento se registrará sin ubicación GPS."
                  : "Obteniendo ubicación…"}
              </>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="h-12"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || warning.blocked}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar {ACTION_LABEL[action].toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
