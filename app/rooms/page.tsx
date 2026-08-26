import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsAgeGate } from "@/lib/compliance/guard";
import { RoomsList } from "@/components/rooms-list";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { SectionHeader } from "@/components/raya/section-header";
import { getPlanLabel } from "@/lib/billing";
import { softValue } from "@/lib/page-data";
import { initialsOf } from "@/lib/name";
import { resolveRayaEntitlements } from "@/lib/entitlements";

export default async function RoomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Discover = public rooms only. "Your rooms" = every room I'm a member of,
  // whatever its visibility (so my private rooms still show up for me).
  type RoomRow = {
    id: string;
    name: string;
    subject: string | null;
    visibility: string;
    status: string;
    created_at: string;
  };
  const cols = "id, name, subject, visibility, status, created_at";

  // Wave 1: profile, memberships and the (soft) plan label together — the plan
  // label used to sit on its own serial round trip.
  const [{ data: profile }, { data: memberships }, studentPlan, { ent }] = await Promise.all([
    supabase
      .from("users")
      .select("account_state, display_name, username, profile_picture_url, birth_year, minor_consent_source, school_id")
      .eq("id", user.id)
      .single(),
    supabase.schema("learning").from("room_members").select("room_id").eq("user_id", user.id),
    softValue(getPlanLabel({ userId: user.id }), "User — Free"),
    // Rides this wave rather than a serial trip: the plan lookup is cached per
    // instance, so asking it here costs nothing the plan label wasn't paying.
    resolveRayaEntitlements(user.id),
  ]);
  // Onboarding covers both first-run setup and the age question, so an
  // account that predates the age gate is sent back for it too.
  if (!profile || profile.account_state === "onboarding_pending" || needsAgeGate(profile)) {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";
  const myRoomIds = (memberships ?? []).map((m) => m.room_id);

  const [{ data: publicRooms }, { data: myRooms }] = await Promise.all([
    supabase
      .schema("learning")
      .from("rooms")
      .select(cols)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(50),
    myRoomIds.length
      ? supabase.schema("learning").from("rooms").select(cols).in("id", myRoomIds)
      : Promise.resolve({ data: [] as RoomRow[] }),
  ]);

  // Merge unique (a public room I've joined would otherwise appear twice).
  const byId = new Map<string, RoomRow>();
  for (const r of [...((publicRooms as RoomRow[]) ?? []), ...((myRooms as RoomRow[]) ?? [])])
    byId.set(r.id, r);
  const rooms = [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <RayaScaffold active="rooms" studentName={studentName} studentInitials={initialsOf(studentName)} studentAvatarUrl={profile.profile_picture_url} studentPlan={studentPlan}>
      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", minWidth: 0 }}>
        <SectionHeader title="Rooms" subtitle="Study in a group with Raya in the room." />
        <RoomsList rooms={rooms ?? []} myRoomIds={myRoomIds} canChooseVisibility={ent.roomVisibilityChoice} />
      </div>
    </RayaScaffold>
  );
}
