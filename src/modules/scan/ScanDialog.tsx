import { useEffect, useState } from "react";
import { Camera, CameraOff } from "lucide-react";

import { BarcodeScanner, type ScanEngine } from "./BarcodeScanner";
import { normalizeCode } from "@/modules/assets/lookup";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Envoltura del escáner GTAC para capturar un código en un campo de formulario.
 * Solo existe un stream: la cámara se enciende al abrir y se libera al cerrar.
 */
export function ScanDialog({
  open,
  onOpenChange,
  title,
  description,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onCaptured: (code: string) => void;
}) {
  const [cameraOn, setCameraOn] = useState(false);
  const [engine, setEngine] = useState<ScanEngine | null>(null);

  useEffect(() => {
    setCameraOn(open);
    if (!open) setEngine(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <BarcodeScanner
          active={cameraOn}
          onEngineChange={setEngine}
          onDetected={(code) => {
            setCameraOn(false);
            onCaptured(normalizeCode(code));
            onOpenChange(false);
          }}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            className="h-14 text-base"
            onClick={() => setCameraOn((v) => !v)}
          >
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
            type="button"
            variant="outline"
            className="h-14 text-base"
            onClick={() => {
              setCameraOn(false);
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
        </div>

        {engine && (
          <p className="text-xs text-muted-foreground">
            Lectura {engine === "native" ? "nativa del dispositivo" : "por respaldo del navegador"}.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
