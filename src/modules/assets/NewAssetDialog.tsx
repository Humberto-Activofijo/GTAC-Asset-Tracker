import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image";
import { useSelectedSite } from "@/modules/sites/SelectedSiteContext";
import { ScanDialog } from "@/modules/scan/ScanDialog";
import { ASSET_CONDITIONS, CONDITION_LABEL, type AssetCondition } from "./queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Form = {
  assetNumber: string;
  serialNumber: string;
  model: string;
  condition: AssetCondition;
  siteId: string;
};

const EMPTY: Form = {
  assetNumber: "",
  serialNumber: "",
  model: "",
  condition: "ACTIVO",
  siteId: "",
};

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type === "image/png" ? "png" : "jpg";
}

export function NewAssetDialog({
  open,
  onOpenChange,
  initialAssetNumber = "",
  initialSiteId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAssetNumber?: string;
  initialSiteId?: string;
  onCreated?: (assetId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { sites, selectedSite } = useSelectedSite();
  const [form, setForm] = useState<Form>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // El ingeniero solo ve sus sitios asignados; el administrador, todos los activos.
  const selectableSites = useMemo(() => sites.filter((s) => s.active), [sites]);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY,
      assetNumber: initialAssetNumber,
      siteId: initialSiteId ?? selectedSite?.id ?? selectableSites[0]?.id ?? "",
    });
    setPhoto(null);
    setPhotoPreview(null);
  }, [open, selectedSite, selectableSites, initialAssetNumber, initialSiteId]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const assetNumber = form.assetNumber.trim();
      if (!assetNumber) throw new Error("El número de activo es obligatorio.");
      if (!form.siteId) throw new Error("Selecciona un sitio.");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");

      let photoPath: string | null = null;
      if (photo) {
        // Se comprime en el dispositivo para no subir imágenes de varios MB.
        const optimized = await compressImage(photo);
        const path = `${form.siteId}/${crypto.randomUUID()}.${extensionOf(optimized)}`;
        const { error: uploadError } = await supabase.storage
          .from("asset-photos")
          .upload(path, optimized, {
            contentType: optimized.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) {
          throw new Error(
            "No fue posible guardar la fotografía. Revisa que el sitio te esté asignado.",
          );
        }
        photoPath = path;
      }

      const { data, error } = await supabase
        .from("assets")
        .insert({
          asset_number: assetNumber,
          serial_number: form.serialNumber.trim() || null,
          model: form.model.trim() || null,
          condition: form.condition,
          status: "EN_SITIO" as const,
          current_site_id: form.siteId,
          photo_url: photoPath,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505")
          throw new Error("Ya existe un activo con ese número. Usa uno distinto.");
        if (error.code === "42501")
          throw new Error("No puedes dar de alta activos en un sitio que no tienes asignado.");
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success("Activo dado de alta correctamente.");
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      onOpenChange(false);
      if (data?.id) onCreated?.(data.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo activo</DialogTitle>
          <DialogDescription>
            El activo quedará registrado con estatus “En sitio”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asset-number">Número de activo / Código QR *</Label>
            <Input
              id="asset-number"
              value={form.assetNumber}
              onChange={(e) => setForm((f) => ({ ...f, assetNumber: e.target.value }))}
              placeholder="Ej. GTAC-000123"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serial">Número de serie</Label>
              <Input
                id="serial"
                value={form.serialNumber}
                onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Condición</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm((f) => ({ ...f, condition: v as AssetCondition }))}
              >
                <SelectTrigger>
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
              <Label>Sitio</Label>
              <Select
                value={form.siteId}
                onValueChange={(v) => setForm((f) => ({ ...f, siteId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un sitio" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {selectableSites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fotografía (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Tomar foto
              </Button>
              <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" />
                Subir desde galería
              </Button>
              {photo && (
                <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>
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
                alt="Vista previa de la fotografía del activo"
                className="mt-2 h-40 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || selectableSites.length === 0}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar activo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
