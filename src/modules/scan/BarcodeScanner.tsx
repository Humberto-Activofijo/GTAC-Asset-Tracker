import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, FlashlightOff, Loader2, ScanLine, ScanSearch } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createQrDecoder, type QrDecoder } from "./qrDecoder";

/**
 * Escáner GTAC: componente único de cámara reutilizado por todos los flujos
 * (identificación, alta de activos, entrada, salida e inventario).
 * Cada capacidad del teléfono se detecta antes de usarse y nunca es obligatoria.
 */

/** Formatos relevantes para etiquetas de activos. */
const WANTED_FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
];

/** ~20 intentos por segundo con detector nativo. */
const NATIVE_INTERVAL_MS = 50;
/** ZXing QR en modo normal: ~8 intentos por segundo. */
const ZXING_INTERVAL_MS = 125;
/** jsQR en modo normal (solo tras el retraso adaptativo): ~2 intentos por segundo. */
const JSQR_INTERVAL_MS = 500;
/** jsQR en modo Etiqueta pequeña (alta precisión): ~3 intentos por segundo. */
const JSQR_INTERVAL_SMALL_MS = 320;
/** Tiempo sin encontrar QR antes de activar el modo QR difícil. */
const HARD_MODE_AFTER_MS = 1000;
/** Si un intento pesado supera este tiempo, se espacian los siguientes. */
const SLOW_ATTEMPT_MS = 90;
/** Proporción del lado analizado en la zona central. */
const ROI_RATIO = 0.62;
const DEDUPE_MS = 2000;

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string; format?: string }[]>;
};

type DetectorCtor = {
  new (options?: { formats?: string[] }): DetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

type TrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
};

export type ScanEngine = "native" | "fallback";

export type ScanCapabilities = {
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
  focusModes: string[];
  width: number | null;
  height: number | null;
  requested: string;
};

function getNativeDetector(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export function BarcodeScanner({
  active,
  onDetected,
  onEngineChange,
  onCapabilities,
}: {
  active: boolean;
  onDetected: (code: string) => void;
  onEngineChange?: (engine: ScanEngine | null) => void;
  onCapabilities?: (caps: ScanCapabilities | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrRef = useRef<QrDecoder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingRef = useRef<{ stop: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const runRef = useRef(0);
  /** >0 cuando la decodificación está pausada (controles de cámara, pestaña oculta, detección). */
  const pauseRef = useRef(0);
  const frameCbRef = useRef<number | null>(null);
  /** Métricas de rendimiento (frecuencias reales y coste medio por intento). */
  const metricsRef = useRef({ zxing: 0, jsqr: 0, jsqrMs: 0, hardSince: 0, since: 0 });


  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hit, setHit] = useState(false);
  const [caps, setCaps] = useState<ScanCapabilities | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [smallLabel, setSmallLabel] = useState(false);
  const smallLabelRef = useRef(false);
  smallLabelRef.current = smallLabel;
  const [diag, setDiag] = useState<{
    native: boolean;
    nativeQr: boolean;
    qrRoute: "zxing" | "nativa" | "no disponible";
    zxingHit: boolean;
    fallbackReady: boolean;
    frame: string;
    crop: string;
    resolution: string;
    mode: string;
    rates: string;
  } | null>(null);

  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;
  const engineRef = useRef(onEngineChange);
  engineRef.current = onEngineChange;
  const capsCbRef = useRef(onCapabilities);
  capsCbRef.current = onCapabilities;

  /** Evita detecciones repetidas del mismo código durante 2 segundos. */
  const handleCode = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < DEDUPE_MS) return;
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

  /** Aplica una restricción opcional sin romper la cámara si no existe. */
  const applyTrack = useCallback(async (constraint: MediaTrackConstraintSet) => {
    const track = trackRef.current;
    if (!track) return false;
    try {
      await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Limpieza explícita: timers, tracks, ZXing y referencias. */
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
    trackRef.current = null;
    canvasRef.current = null;
    fullCanvasRef.current = null;
    try {
      qrRef.current?.reset();
    } catch {
      /* ignorado */
    }
    qrRef.current = null;
    setDiag(null);
    setTorchOn(false);
    setZoom(null);
    setCaps(null);
    capsCbRef.current?.(null);
    engineRef.current?.(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    const token = ++runRef.current;
    setMessage(null);
    setStatus("starting");

    const requested = "1920×1080 (ideal)";
    let stream: MediaStream;
    try {
      // Solo restricciones "ideal": el navegador elige la mejor resolución posible.
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
    const track = stream.getVideoTracks()[0] ?? null;
    trackRef.current = track;

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
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

    // Capacidades reales del teléfono.
    let capabilities: TrackCapabilities = {};
    try {
      capabilities = (track?.getCapabilities?.() ?? {}) as TrackCapabilities;
    } catch {
      capabilities = {};
    }
    const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings;
    const focusModes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
    const zoomCap = capabilities.zoom
      ? {
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step && capabilities.zoom.step > 0 ? capabilities.zoom.step : 0.1,
        }
      : null;
    const detected: ScanCapabilities = {
      torch: capabilities.torch === true,
      zoom: zoomCap && zoomCap.max > zoomCap.min ? zoomCap : null,
      focusModes,
      width: settings.width ?? null,
      height: settings.height ?? null,
      requested,
    };
    setCaps(detected);
    capsCbRef.current?.(detected);
    if (detected.zoom) setZoom(settings.zoom ?? detected.zoom.min);

    // Autofocus: continuo si existe, de lo contrario disparo único; si no, el del sistema.
    if (focusModes.includes("continuous")) {
      await applyTrack({ focusMode: "continuous" } as MediaTrackConstraintSet);
    } else if (focusModes.includes("single-shot")) {
      await applyTrack({ focusMode: "single-shot" } as MediaTrackConstraintSet);
    }
    if (token !== runRef.current) return;

    // Recorte central a resolución real: conserva el detalle de etiquetas pequeñas.
    const cropCenter = (max = 1200): HTMLCanvasElement | null => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const side = Math.round(Math.min(vw, vh) * ROI_RATIO);
      const out = Math.min(side, max);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, out, out);
      return canvas;
    };

    // Frame completo con resolución suficiente para QR medianos y grandes.
    const fullFrame = (max = 1280): HTMLCanvasElement | null => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const scale = Math.min(1, max / Math.max(vw, vh));
      const canvas = fullCanvasRef.current ?? document.createElement("canvas");
      fullCanvasRef.current = canvas;
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    // Ruta QR dedicada (ZXing solo con formato QR_CODE) sobre el mismo stream.
    const qr = await createQrDecoder();
    if (token !== runRef.current) return;
    qrRef.current = qr;

    const Detector = getNativeDetector();
    let nativeQrSupported = false;
    if (Detector) {
      let formats = WANTED_FORMATS;
      try {
        const supported = await Detector.getSupportedFormats?.();
        if (supported?.length) {
          nativeQrSupported = supported.includes("qr_code");
          const usable = WANTED_FORMATS.filter((f) => supported.includes(f));
          if (usable.length) formats = usable;
        }
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
      setDiag({
        native: true,
        nativeQr: nativeQrSupported,
        qrRoute: qr ? "zxing" : nativeQrSupported ? "nativa" : "no disponible",
        zxingHit: false,
        fallbackReady: qr?.fallbackReady ?? false,
        frame: "—",
        crop: "—",
        resolution: `${video.videoWidth || settings.width || 0}×${video.videoHeight || settings.height || 0}`,
      });

      let busy = false;
      let lastTick = 0;
      let turn = 0;
      let lastFallbackAt = 0;
      let lastDiagKey = "";

      /**
       * Ruta 1 ZXing QR (~10/s). Si falla, ruta 2 jsQR (~4/s) sobre el recuadro
       * central a resolución alta y, si procede, el frame completo.
       */
      const runQrPipeline = (ts: number): string | null => {
        if (!qr) return null;
        const center = cropCenter();
        const full = smallLabelRef.current ? null : fullFrame();

        let zxingHit: string | null = null;
        if (center) zxingHit = qr.decodeZxing(center);
        if (!zxingHit && full) zxingHit = qr.decodeZxing(full);

        let fallbackHit: string | null = null;
        const fallbackDue = qr.fallbackReady && ts - lastFallbackAt >= 250;
        if (!zxingHit && fallbackDue) {
          lastFallbackAt = ts;
          if (center) fallbackHit = qr.decodeFallback(center);
          if (!fallbackHit && full) fallbackHit = qr.decodeFallback(full);
        }

        if (import.meta.env.DEV) {
          const key = [
            zxingHit ? "si" : "no",
            qr.fallbackReady ? "si" : "no",
            full ? `${full.width}×${full.height}` : `${video.videoWidth}×${video.videoHeight}`,
            center ? `${center.width}×${center.height}` : "—",
          ].join("|");
          if (key !== lastDiagKey) {
            lastDiagKey = key;
            setDiag((d) =>
              d
                ? {
                    ...d,
                    zxingHit: zxingHit !== null,
                    fallbackReady: qr.fallbackReady,
                    frame: key.split("|")[2] ?? "",
                    crop: key.split("|")[3] ?? "",
                  }
                : d,
            );
          }
        }

        return zxingHit ?? fallbackHit;
      };

      const loop = (ts: number) => {
        if (token !== runRef.current) return;
        rafRef.current = requestAnimationFrame(loop);
        if (busy || ts - lastTick < NATIVE_INTERVAL_MS) return;
        lastTick = ts;
        turn += 1;

        // Ciclos alternados sobre el MISMO video: QR dedicado y códigos de barras nativos.
        if (qr && turn % 2 === 0) {
          const hit = runQrPipeline(ts);
          if (hit) handleCode(hit);
          return;
        }

        busy = true;
        const useCenter = smallLabelRef.current || turn % 4 === 1;
        const source: CanvasImageSource = (useCenter ? cropCenter() : null) ?? video;
        detector
          .detect(source)
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


    // Respaldo para navegadores sin detección nativa (mantiene la resolución del video).
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (token !== runRef.current) return;
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 80 });
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (token === runRef.current && result) handleCode(result.getText());
      });
      if (token !== runRef.current) {
        controls.stop();
        return;
      }
      zxingRef.current = controls;
      engineRef.current?.("fallback");
      setDiag({
        native: false,
        nativeQr: false,
        qrRoute: "zxing",
        zxingHit: false,
        fallbackReady: qr?.fallbackReady ?? false,
        frame: "—",
        crop: "—",
        resolution: `${video.videoWidth || settings.width || 0}×${video.videoHeight || settings.height || 0}`,
      });

      // Refuerzo jsQR (~4/s) sobre el mismo video para QR impresos difíciles.
      if (qr?.fallbackReady) {
        let lastFb = 0;
        const fbLoop = (ts: number) => {
          if (token !== runRef.current) return;
          rafRef.current = requestAnimationFrame(fbLoop);
          if (ts - lastFb < 250) return;
          lastFb = ts;
          const center = cropCenter();
          const full = smallLabelRef.current ? null : fullFrame();
          if (import.meta.env.DEV) {
            const frame = full
              ? `${full.width}×${full.height}`
              : `${video.videoWidth}×${video.videoHeight}`;
            const crop = center ? `${center.width}×${center.height}` : "—";
            setDiag((d) => (d && (d.frame !== frame || d.crop !== crop) ? { ...d, frame, crop } : d));
          }
          const hit =
            (center ? qr.decodeFallback(center) : null) ??
            (full ? qr.decodeFallback(full) : null);
          if (hit) handleCode(hit);
        };
        rafRef.current = requestAnimationFrame(fbLoop);
      }
    } catch {
      setMessage("Este navegador no puede leer códigos. Usa la captura manual.");
      setStatus("error");
    }
  }, [applyTrack, handleCode]);

  useEffect(() => {
    if (active) void start();
    else stop();
    return () => stop();
  }, [active, start, stop]);

  const applyZoom = useCallback(
    async (value: number) => {
      if (!caps?.zoom) return;
      const next = Math.min(caps.zoom.max, Math.max(caps.zoom.min, value));
      const ok = await applyTrack({ zoom: next } as MediaTrackConstraintSet);
      if (ok) setZoom(next);
    },
    [applyTrack, caps],
  );

  const toggleTorch = useCallback(async () => {
    if (!caps?.torch) return;
    const next = !torchOn;
    const ok = await applyTrack({ torch: next } as MediaTrackConstraintSet);
    if (ok) setTorchOn(next);
  }, [applyTrack, caps, torchOn]);

  /** Modo etiqueta pequeña: enfoque, zoom disponible y zona central. */
  const toggleSmallLabel = useCallback(async () => {
    const next = !smallLabel;
    setSmallLabel(next);
    if (!next) {
      if (caps?.zoom) await applyZoom(caps.zoom.min);
      return;
    }
    if (caps?.focusModes.includes("continuous")) {
      await applyTrack({ focusMode: "continuous" } as MediaTrackConstraintSet);
    }
    if (caps?.zoom) {
      // Nunca por encima del máximo de hardware.
      await applyZoom(Math.min(caps.zoom.max, caps.zoom.min * 2 || 2));
    }
  }, [applyTrack, applyZoom, caps, smallLabel]);

  const zoomPresets = caps?.zoom
    ? [1, 2, 3]
        .map((m) => (caps.zoom!.min || 1) * m)
        .filter((v) => v >= caps.zoom!.min && v <= caps.zoom!.max)
    : [];

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
                "h-52 w-52 rounded-xl border-4 transition-colors sm:h-60 sm:w-60",
                hit ? "border-foreground" : "border-background/80",
              )}
            />
          </div>
        )}

        {status === "scanning" && smallLabel && (
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-background/85 px-4 py-2 text-center text-sm font-medium text-foreground">
            Acerca la cámara hasta que el código ocupe el recuadro.
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

      {status === "scanning" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={smallLabel ? "default" : "outline"}
            className="h-14 flex-1 text-base sm:flex-none"
            onClick={() => void toggleSmallLabel()}
          >
            <ScanSearch className="mr-2 h-5 w-5" />
            Etiqueta pequeña
          </Button>

          {caps?.torch && (
            <Button
              type="button"
              variant={torchOn ? "default" : "outline"}
              className="h-14 flex-1 text-base sm:flex-none"
              onClick={() => void toggleTorch()}
            >
              {torchOn ? (
                <FlashlightOff className="mr-2 h-5 w-5" />
              ) : (
                <Flashlight className="mr-2 h-5 w-5" />
              )}
              {torchOn ? "Apagar luz" : "Encender luz"}
            </Button>
          )}

          {zoomPresets.map((value, i) => (
            <Button
              key={value}
              type="button"
              variant={zoom !== null && Math.abs(zoom - value) < 0.05 ? "default" : "outline"}
              className="h-14 min-w-14 text-base"
              onClick={() => void applyZoom(value)}
            >
              {i + 1}×
            </Button>
          ))}
        </div>
      )}

      {status === "scanning" && caps?.zoom && (
        <label className="block text-xs text-muted-foreground">
          Zoom de cámara
          <input
            type="range"
            className="mt-1 h-10 w-full"
            min={caps.zoom.min}
            max={caps.zoom.max}
            step={caps.zoom.step}
            value={zoom ?? caps.zoom.min}
            onChange={(e) => void applyZoom(Number(e.target.value))}
          />
        </label>
      )}

      {/* Diagnóstico temporal: solo visible en desarrollo. */}
      {import.meta.env.DEV && diag && (
        <div
          data-testid="scan-diagnostics"
          className="rounded-lg border border-dashed border-border p-3 font-mono text-xs text-muted-foreground"
        >
          <p>detector nativo activo: {diag.native ? "sí" : "no"}</p>
          <p>QR nativo soportado: {diag.nativeQr ? "sí" : "no"}</p>
          <p>ruta QR activa: {diag.qrRoute}</p>
          <p>QR ZXing: {diag.zxingHit ? "detectado" : "no"}</p>
          <p>QR fallback: {diag.fallbackReady ? "jsQR activo" : "no disponible"}</p>
          <p>frame analizado: {diag.frame}</p>
          <p>recorte central: {diag.crop}</p>
          <p>resolución del stream: {diag.resolution}</p>
        </div>
      )}

      {status === "error" && message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
