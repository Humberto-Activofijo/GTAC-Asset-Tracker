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
        description: `Activos revisados: ${r.assets_reviewed} · Nuevas alertas: ${r.alerts_created} · Alertas existentes: ${r.alerts_existing} · Correos enviados: ${r.emails_sent} · Errores de correo: ${r.email_errors}`,
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
