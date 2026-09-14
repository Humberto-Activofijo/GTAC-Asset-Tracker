import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Loader2, ScanLine } from "lucide-react";

import { cn } from "@/lib/utils";

/** Formatos solicitados a la detección nativa del dispositivo. */
const WANTED_FORMATS = [
  "qr_code",
  "code_128",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_39",
  "itf",
];

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string; format?: string }[]>;
};

type DetectorCtor = {
  new (options?: { formats?: string[] }): DetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

function getNativeDetector(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export type ScanEngine = "native" | "fallback";

export function BarcodeScanner({
  active,
  onDetected,
  onEngineChange,
}: {
  active: boolean;
  onDetected: (code: string) => void;
  onEngineChange?: (engine: ScanEngine | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingRef = useRef<{ stop: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const runRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hit, setHit] = useState(false);

  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;
  const engineRef = useRef(onEngineChange);
  engineRef.current = onEngineChange;

  /** Evita detecciones repetidas del mismo código durante 2 segundos. */
  const handleCode = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < 2000) return;
    lastRef.current = { code, at: now };
    try {
      navigator.vibrate?.(60);
    } catch {
      /* la vibración es opcional */
    }
    setHit(true);
    window.setTimeout(() => setHit(false), 900);
    detectedRef.current(code);
  }, []);

  /** Detiene el stream ANTES de cualquier desmontaje del video. */
  const stop = useCallback(() => {
    runRef.current += 1;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      zxingRef.current?.stop();
    } catch {
      /* ignorado */
    }
    zxingRef.current = null;
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        /* ignorado */
      }
      video.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    engineRef.current?.(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    const token = ++runRef.current;
    setMessage(null);
    setStatus("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (error) {
      const name = (error as { name?: string })?.name ?? "";
      const detail = (error as { message?: string })?.message ?? "";
      const denied = /permission|denied|denegad/i.test(detail);
      setMessage(
        denied || name === "NotAllowedError" || name === "SecurityError"
          ? "Permiso de cámara denegado. Actívalo en el navegador o usa la captura manual."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "No se encontró una cámara disponible. Usa la captura manual."
            : "No fue posible abrir la cámara. Usa la captura manual.",
      );
      setStatus("error");
      return;
    }

    if (token !== runRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus("idle");
      return;
    }
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    try {
      await video.play();
    } catch {
      /* algunos navegadores reproducen al montar */
    }
    if (token !== runRef.current) return;
    setStatus("scanning");

    const Detector = getNativeDetector();
    if (Detector) {
      let formats = WANTED_FORMATS;
      try {
        const supported = await Detector.getSupportedFormats?.();
        if (supported?.length) formats = WANTED_FORMATS.filter((f) => supported.includes(f));
      } catch {
        /* se usan los formatos por defecto */
      }
      let detector: DetectorLike;
      try {
        detector = new Detector(formats.length ? { formats } : undefined);
      } catch {
        detector = new Detector();
      }
      if (token !== runRef.current) return;
      engineRef.current?.("native");

      let busy = false;
      let lastTick = 0;
      const loop = (ts: number) => {
        if (token !== runRef.current) return;
        rafRef.current = requestAnimationFrame(loop);
        if (busy || ts - lastTick < 120) return;
        lastTick = ts;
        busy = true;
        detector
          .detect(video)
          .then((codes) => {
            if (token === runRef.current && codes?.[0]?.rawValue) handleCode(codes[0].rawValue);
          })
          .catch(() => undefined)
          .finally(() => {
            busy = false;
          });
      };
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Respaldo para navegadores sin detección nativa.
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (token !== runRef.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (token === runRef.current && result) handleCode(result.getText());
      });
      if (token !== runRef.current) {
        controls.stop();
        return;
      }
      zxingRef.current = controls;
      engineRef.current?.("fallback");
    } catch {
      setMessage("Este navegador no puede leer códigos. Usa la captura manual.");
      setStatus("error");
    }
  }, [handleCode]);

  useEffect(() => {
    if (active) void start();
    else stop();
    return () => stop();
  }, [active, start, stop]);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden rounded-xl border bg-muted sm:aspect-video",
          hit ? "border-foreground ring-4 ring-foreground/20" : "border-border",
        )}
      >
        {/* El elemento de video permanece montado: el stream se detiene antes de ocultarlo. */}
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className={cn("h-full w-full object-cover", active ? "opacity-100" : "opacity-0")}
        />

        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "h-48 w-48 rounded-xl border-4 transition-colors sm:h-56 sm:w-56",
                hit ? "border-foreground" : "border-background/80",
              )}
            />
          </div>
        )}

        {hit && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-foreground px-4 py-3 text-center text-sm font-semibold text-background">
            Código detectado
          </div>
        )}

        {!active && status !== "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ScanLine className="h-10 w-10" />
            <p className="px-6 text-center text-sm">Cámara apagada</p>
          </div>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 px-6 text-center">
            <CameraOff className="h-9 w-9 text-destructive" />
            <p className="text-sm text-foreground">{message}</p>
          </div>
        )}
      </div>

      {status === "error" && message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
