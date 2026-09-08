import { Construction } from "lucide-react";

import { PageHeader } from "./PageHeader";

export function ModuleInDevelopment({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Módulo en desarrollo</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Esta sección aún no está disponible. Se habilitará en una fase posterior del proyecto.
        </p>
      </div>
    </>
  );
}
