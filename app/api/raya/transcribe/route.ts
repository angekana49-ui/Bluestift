import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/raya/llm";
import { contentLengthExceeds, tooLarge, MAX_AUDIO_BYTES } from "@/lib/upload-limits";
import { resolveRayaEntitlements, gateFeature } from "@/lib/entitlements";

/**
 * Speech-to-text for voice messages (OpenAI Whisper served by Groq).
 * Client posts an audio Blob as multipart form field `audio`; returns the text.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Voice input is a Plus+ feature.
  const { ent, tier } = await resolveRayaEntitlements(user.id);
  const denied = gateFeature(ent.voiceInput, { feature: "voice_input", upgradeTo: "Plus", scope: "raya", userId: user.id, tier });
  if (denied) return denied;

  const oversized = contentLengthExceeds(request, MAX_AUDIO_BYTES);
  if (oversized) return oversized;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "no audio" }, { status: 400 });
  }
  const big = tooLarge(audio, MAX_AUDIO_BYTES);
  if (big) return big;
  const language = (form.get("language") as string | null) ?? undefined;

  try {
    const { text } = await transcribeAudio(audio, "audio.webm", language);
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "transcription error" },
      { status: 502 },
    );
  }
}
