import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { runTransitCheck } from "@/modules/alerts/queries";
import { Button } from "@/components/ui/button";

/** Revisión manual de tránsitos mayores a 48 horas (solo administradores). */
export function TransitCheckButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  async function handleClick() {
    setRunning(true);
    try {
      const r = await runTransitCheck();
      toast.success("Revisión completada", {
        description: `${r.assets_reviewed} activo(s) revisados · ${r.alerts_created} alerta(s) nueva(s) · ${r.alerts_existing} ya existente(s) · ${r.errors} error(es).`,
      });
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible ejecutar la revisión.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant={variant} onClick={() => void handleClick()} disabled={running}>
      {running ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Revisar tránsito +48h
    </Button>
  );
}
