import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { currentUserQuery } from "@/modules/auth/queries";
import {
  assignmentsQuery,
  profilesQuery,
  rolesQuery,
  visibleSitesQuery,
  type Site,
} from "@/modules/sites/queries";
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

export const Route = createFileRoute("/_authenticated/sitios")({
  head: () => ({
    meta: [
      { title: "Sitios — GTAC" },
      { name: "description", content: "Consulta y administra los sitios de telecomunicaciones." },
      { property: "og:title", content: "Sitios — GTAC" },
      {
        property: "og:description",
        content: "Consulta y administra los sitios de telecomunicaciones.",
      },
    ],
  }),
  component: SitiosPage,
});

type SiteForm = {
  name: string;
  code: string;
  latitude: string;
  longitude: string;
  active: boolean;
};

const EMPTY_FORM: SiteForm = { name: "", code: "", latitude: "", longitude: "", active: true };

function SitiosPage() {
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(currentUserQuery);
  const isAdmin = user?.role === "admin";

  const sitesQ = useQuery(visibleSitesQuery);
  const [editing, setEditing] = useState<Site | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [assignSite, setAssignSite] = useState<Site | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() === "" ? null : form.code.trim(),
        latitude: form.latitude.trim() === "" ? null : Number(form.latitude),
        longitude: form.longitude.trim() === "" ? null : Number(form.longitude),
        active: form.active,
      };
      if (!payload.name) throw new Error("El nombre es obligatorio.");
      if (payload.latitude !== null && Number.isNaN(payload.latitude))
        throw new Error("La latitud no es un número válido.");
      if (payload.longitude !== null && Number.isNaN(payload.longitude))
        throw new Error("La longitud no es un número válido.");

      if (editing) {
        const { error } = await supabase.from("sites").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sites").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Sitio actualizado." : "Sitio creado.");
      setEditing(null);
      setCreating(false);
      setForm(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Sitios"
        description={
          isAdmin ? "Administra los sitios y sus ingenieros asignados." : "Sitios que tienes asignados."
        }
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setForm(EMPTY_FORM);
                setEditing(null);
                setCreating(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo sitio
            </Button>
          ) : null
        }
      />

      {sitesQ.isPending && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando sitios…
        </div>
      )}

      {sitesQ.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          No fue posible cargar los sitios. {(sitesQ.error as Error).message}
        </div>
      )}

      {sitesQ.data && sitesQ.data.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No hay sitios visibles para tu cuenta.
        </div>
      )}

      {sitesQ.data && sitesQ.data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Actualizado</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {sitesQ.data.map((site) => (
                  <tr key={site.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{site.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{site.code ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {site.active ? "Activo" : "Inactivo"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(site.updated_at)}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(site);
                            setCreating(false);
                            setForm({
                              name: site.name,
                              code: site.code ?? "",
                              latitude: site.latitude?.toString() ?? "",
                              longitude: site.longitude?.toString() ?? "",
                              active: site.active,
                            });
                          }}
                        >
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setAssignSite(site)}>
                          Ingenieros
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar sitio" : "Nuevo sitio"}</DialogTitle>
            <DialogDescription>Los campos de ubicación son opcionales.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitud</Label>
                <Input
                  id="lat"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitud</Label>
                <Input
                  id="lng"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
              />
              Sitio activo
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && assignSite && (
        <AssignEngineersDialog site={assignSite} onClose={() => setAssignSite(null)} />
      )}
    </>
  );
}

function AssignEngineersDialog({ site, onClose }: { site: Site; onClose: () => void }) {
  const queryClient = useQueryClient();
  const profiles = useQuery(profilesQuery);
  const roles = useQuery(rolesQuery);
  const assignments = useQuery(assignmentsQuery);

  const engineerIds = new Set(
    (roles.data ?? []).filter((r) => r.role === "engineer").map((r) => r.user_id),
  );
  const engineers = (profiles.data ?? []).filter((p) => engineerIds.has(p.id));
  const assignedIds = new Set(
    (assignments.data ?? []).filter((a) => a.site_id === site.id && a.active).map((a) => a.engineer_id),
  );

  const toggleMutation = useMutation({
    mutationFn: async ({ engineerId, assign }: { engineerId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase
          .from("engineer_sites")
          .upsert(
            { engineer_id: engineerId, site_id: site.id, active: true },
            { onConflict: "engineer_id,site_id" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("engineer_sites")
          .delete()
          .eq("engineer_id", engineerId)
          .eq("site_id", site.id);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["engineer-sites"] });
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Asignaciones actualizadas.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loading = profiles.isPending || roles.isPending || assignments.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ingenieros en {site.name}</DialogTitle>
          <DialogDescription>Selecciona quién puede consultar este sitio.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : engineers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ingenieros registrados.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {engineers.map((engineer) => (
              <label
                key={engineer.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={assignedIds.has(engineer.id)}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ engineerId: engineer.id, assign: checked === true })
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {engineer.full_name ?? engineer.email}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {engineer.email}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
