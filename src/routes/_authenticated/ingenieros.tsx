import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { currentUserQuery } from "@/modules/auth/queries";
import { assignmentsQuery, profilesQuery, rolesQuery, visibleSitesQuery } from "@/modules/sites/queries";
import { provisionEngineer, createPasswordLink } from "@/lib/admin.functions";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/ingenieros")({
  head: () => ({
    meta: [
      { title: "Ingenieros — GTAC" },
      { name: "description", content: "Perfiles de ingenieros y sus sitios asignados en GTAC." },
      { property: "og:title", content: "Ingenieros — GTAC" },
      {
        property: "og:description",
        content: "Perfiles de ingenieros y sus sitios asignados en GTAC.",
      },
    ],
  }),
  component: IngenierosPage,
});

function IngenierosPage() {
  const { data: user } = useSuspenseQuery(currentUserQuery);
  const isAdmin = user?.role === "admin";

  const profiles = useQuery({ ...profilesQuery, enabled: isAdmin });
  const roles = useQuery({ ...rolesQuery, enabled: isAdmin });
  const assignments = useQuery({ ...assignmentsQuery, enabled: isAdmin });
  const sites = useQuery({ ...visibleSitesQuery, enabled: isAdmin });

  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Ingenieros" />
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Solo un administrador puede consultar esta sección.
        </div>
      </>
    );
  }

  const loading =
    profiles.isPending || roles.isPending || assignments.isPending || sites.isPending;
  const error = profiles.error ?? roles.error ?? assignments.error ?? sites.error;

  const roleByUser = new Map((roles.data ?? []).map((r) => [r.user_id, r.role]));
  const siteNameById = new Map((sites.data ?? []).map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title="Ingenieros"
        description="Perfiles registrados y sus sitios asignados."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo ingeniero
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando perfiles…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          No fue posible cargar los perfiles. {(error as Error).message}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Correo</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Sitios asignados</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(profiles.data ?? []).map((profile) => {
                  const assigned = (assignments.data ?? [])
                    .filter((a) => a.engineer_id === profile.id && a.active)
                    .map((a) => siteNameById.get(a.site_id) ?? "—");
                  const role = roleByUser.get(profile.id);
                  return (
                    <tr key={profile.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {profile.full_name ?? "—"}
                        {!profile.active && (
                          <span className="ml-2 text-xs text-destructive">inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{profile.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {role === "admin" ? "Administrador" : role === "engineer" ? "Ingeniero" : "Sin rol"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {assigned.length > 0 ? assigned.join(", ") : "Sin sitios"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(profile.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <PasswordLinkButton email={profile.email} onLink={setLink} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <NewEngineerDialog
          siteOptions={(sites.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setCreating(false)}
          onLink={setLink}
        />
      )}

      <Dialog open={link !== null} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enlace para establecer contraseña</DialogTitle>
            <DialogDescription>
              Compártelo de forma segura con la persona. Es de un solo uso y caduca.
            </DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-lg bg-muted px-3 py-2 text-xs text-foreground">{link}</div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (link) await navigator.clipboard.writeText(link);
                toast.success("Enlace copiado.");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PasswordLinkButton({
  email,
  onLink,
}: {
  email: string;
  onLink: (link: string) => void;
}) {
  const createLink = useServerFn(createPasswordLink);
  const mutation = useMutation({
    mutationFn: async () =>
      createLink({
        data: { email, redirectTo: `${window.location.origin}/reset-password` },
      }),
    onSuccess: (result) => onLink(result.actionLink),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Enlace de contraseña
    </Button>
  );
}

function NewEngineerDialog({
  siteOptions,
  onClose,
  onLink,
}: {
  siteOptions: { id: string; name: string }[];
  onClose: () => void;
  onLink: (link: string) => void;
}) {
  const queryClient = useQueryClient();
  const provision = useServerFn(provisionEngineer);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [siteIds, setSiteIds] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () =>
      provision({
        data: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          siteIds,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["engineer-sites"] });
      toast.success("Cuenta creada.");
      onClose();
      onLink(result.actionLink);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ingeniero</DialogTitle>
          <DialogDescription>
            No se define ninguna contraseña: se genera un enlace para que la persona establezca la
            suya.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sitios asignados</Label>
            {siteOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay sitios registrados todavía. Puedes asignarlos después.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {siteOptions.map((site) => (
                  <label key={site.id} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={siteIds.includes(site.id)}
                      onCheckedChange={(checked) =>
                        setSiteIds((prev) =>
                          checked === true ? [...prev, site.id] : prev.filter((id) => id !== site.id),
                        )
                      }
                    />
                    {site.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={mutation.isPending || !email.trim() || !fullName.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
