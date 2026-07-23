import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomsList } from "@/components/rooms-list";
import { RayaScaffold } from "@/components/raya/raya-scaffold";
import { SectionHeader } from "@/components/raya/section-header";
import { getPlanLabel } from "@/lib/billing";
import { initialsOf } from "@/lib/name";

export default async function RoomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_state, display_name, username, profile_picture_url")
    .eq("id", user.id)
    .single();
  if (!profile || profile.account_state === "onboarding_pending") {
    redirect("/onboarding");
  }
  const studentName = profile.display_name || profile.username || "";
  const studentPlan = await getPlanLabel({ userId: user.id });

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
  const { data: memberships } = await supabase
    .schema("learning")
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id);
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
        <SectionHeader title="Rooms" subtitle="Study in a group with RAYA in the room." />
        <RoomsList rooms={rooms ?? []} myRoomIds={myRoomIds} />
      </div>
    </RayaScaffold>
  );
}
