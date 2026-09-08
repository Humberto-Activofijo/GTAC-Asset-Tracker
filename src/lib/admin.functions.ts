import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const provisionSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(120),
  siteIds: z.array(z.string().uuid()).max(200).default([]),
  redirectTo: z.string().url(),
});

const linkSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url(),
});

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("No fue posible verificar los permisos.");
  if (!data) throw new Error("Solo un administrador puede realizar esta operación.");
}

/**
 * Alta individual de un ingeniero. Solo un administrador verificado en el servidor
 * puede ejecutarla. Nunca se define ni se devuelve una contraseña: se genera un
 * enlace de un solo uso para que la persona establezca la suya.
 */
export const provisionEngineer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => provisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError || !created?.user) {
      throw new Error(createError?.message ?? "No fue posible crear la cuenta.");
    }
    const userId = created.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, active: true })
      .eq("id", userId);
    if (profileError) throw new Error("La cuenta se creó pero el perfil no pudo actualizarse.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "engineer" });
    if (roleError) throw new Error("La cuenta se creó pero el rol no pudo asignarse.");

    if (data.siteIds.length > 0) {
      const { error: assignError } = await supabaseAdmin
        .from("engineer_sites")
        .upsert(
          data.siteIds.map((siteId) => ({ engineer_id: userId, site_id: siteId, active: true })),
          { onConflict: "engineer_id,site_id" },
        );
      if (assignError) throw new Error("La cuenta se creó pero los sitios no pudieron asignarse.");
    }

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: data.redirectTo },
    });
    if (linkError || !link?.properties?.action_link) {
      throw new Error(
        "La cuenta se creó, pero no se generó el enlace de contraseña. Genéralo de nuevo desde la lista de ingenieros.",
      );
    }

    return { userId, email, actionLink: link.properties.action_link };
  });

/** Regenera el enlace de un solo uso para establecer contraseña de una cuenta existente. */
export const createPasswordLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => linkSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email.trim().toLowerCase(),
      options: { redirectTo: data.redirectTo },
    });
    if (error || !link?.properties?.action_link) {
      throw new Error(error?.message ?? "No fue posible generar el enlace.");
    }
    return { actionLink: link.properties.action_link };
  });
