import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJson, rayaComplete } from "@/lib/raya/llm";
import type { Json } from "@/types/database.types";
import {
  resolveRayaEntitlements,
  gateFeature,
  gateQuota,
  startOfMonthIso,
} from "@/lib/entitlements";

const MAX_SOURCE_CHARS = 8000;
const SUPPORTED = new Set(["quiz", "summary", "flashcards", "mind_map"]);

/**
 * Tools generation. LLM-only tools: `quiz` (JSON MCQ), `summary` (prose),
 * `flashcards` (JSON Q/A pairs), `mind_map` (JSON topic tree) — all stored in
 * learning.tool_outputs. audio_summary / infographic need TTS / image gen and
 * are not wired yet.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    tool_type?: string;
    source_text?: string;
    title?: string;
    source_media_id?: string | null;
    /** One or more previously-uploaded docs to build the source from (reuse). */
    source_media_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const toolType = body.tool_type ?? "";
  if (!SUPPORTED.has(toolType)) {
    return NextResponse.json(
      { error: "This tool is coming soon. Available: quiz, summary." },
      { status: 400 },
    );
  }

  // Source = the stored extracted_text of the picked docs (so an already-uploaded
  // file can feed any tool without re-uploading) COMBINED with any inline text
  // passed for docs that weren't persisted. Multi-source is concatenated.
  const mediaIds = (body.source_media_ids ?? []).filter((s): s is string => typeof s === "string" && s.length > 0);
  const parts: string[] = [];
  if (mediaIds.length > 0) {
    const { data: media } = await supabase
      .schema("rag")
      .from("user_media")
      .select("id, title, extracted_text")
      .eq("user_id", user.id)
      .in("id", mediaIds);
    const byId = new Map((media ?? []).map((m) => [m.id, m]));
    for (const id of mediaIds) {
      const m = byId.get(id);
      if (m?.extracted_text) parts.push(`## ${m.title ?? "Document"}\n${m.extracted_text}`);
    }
  }
  const inline = (body.source_text ?? "").trim();
  if (inline) parts.push(inline);
  const source = parts.join("\n\n").trim().slice(0, MAX_SOURCE_CHARS);
  if (!source) {
    return NextResponse.json({ error: "empty source text" }, { status: 400 });
  }
  const primaryMediaId = body.source_media_id ?? mediaIds[0] ?? null;

  // --- Entitlements: feature availability + monthly generation quota ---------
  const { ent } = await resolveRayaEntitlements(user.id);
  // Mind map is a Plus+ generator; audio_summary/infographic (Max) aren't wired.
  if (toolType === "mind_map") {
    const denied = gateFeature(ent.mindMap, { feature: "mind_map", upgradeTo: "Plus", scope: "tools" });
    if (denied) return denied;
  }
  // Generations/month — derived from tool_outputs (no separate counter table).
  // Failed generations don't count: a LLM/parse failure shouldn't burn a credit.
  const { count: genUsed } = await supabase
    .schema("learning")
    .from("tool_outputs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "failed")
    .gte("created_at", startOfMonthIso());
  const overGen = gateQuota(genUsed ?? 0, ent.generationsPerMonth, {
    metric: "generations",
    period: "month",
    upgradeTo: "Plus",
    scope: "tools",
  });
  if (overGen) return overGen;

  // Create the tool_output (generating).
  const { data: created, error: insErr } = await supabase
    .schema("learning")
    .from("tool_outputs")
    .insert({
      user_id: user.id,
      source_media_id: primaryMediaId,
      tool_type: toolType,
      status: "generating",
      output_content: {},
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const id = created.id;

  try {
    let output: Json;

    if (toolType === "quiz") {
      const raw = await generateJson(
        "You are a quiz generator. From the study material, produce 8 multiple-choice questions in the SAME language as the material. Return a JSON object shaped exactly as: " +
          '{"questions":[{"question":"...","options":["a","b","c","d"],"correct_index":0,"explanation":"..."}]}',
        source,
      );
      const parsed = safeParseJson(raw);
      const questions = Array.isArray(parsed?.questions) ? parsed.questions : null;
      if (!questions) throw new Error("model did not return valid quiz JSON");
      output = { questions };
    } else if (toolType === "flashcards") {
      const raw = await generateJson(
        "You are a flashcard generator. From the study material, produce 10 flashcards in the SAME language as the material. Each card has a short front (a question or prompt) and a concise back (the answer). Return a JSON object shaped exactly as: " +
          '{"cards":[{"front":"...","back":"..."}]}',
        source,
      );
      const parsed = safeParseJson(raw);
      const cards = Array.isArray(parsed?.cards)
        ? (parsed.cards as unknown[]).filter(
            (c): c is { front: string; back: string } =>
              !!c && typeof (c as { front?: unknown }).front === "string" &&
              typeof (c as { back?: unknown }).back === "string",
          )
        : null;
      if (!cards || cards.length === 0) throw new Error("model did not return valid flashcard JSON");
      output = { cards };
    } else if (toolType === "mind_map") {
      const raw = await generateJson(
        "You are a mind-map generator. From the study material, produce a mind map in the SAME language as the material: a central title, and 4-7 main branches, each with 2-5 short child points. Keep every label concise (a few words). Return a JSON object shaped exactly as: " +
          '{"title":"...","branches":[{"label":"...","children":["...","..."]}]}',
        source,
      );
      const parsed = safeParseJson(raw);
      const title = typeof parsed?.title === "string" ? parsed.title : "";
      const branches = Array.isArray(parsed?.branches)
        ? (parsed.branches as unknown[])
            .filter((b): b is { label: string; children?: unknown } =>
              !!b && typeof (b as { label?: unknown }).label === "string")
            .map((b) => ({
              label: b.label,
              children: Array.isArray(b.children)
                ? (b.children as unknown[]).filter((c): c is string => typeof c === "string")
                : [],
            }))
        : null;
      if (!branches || branches.length === 0) throw new Error("model did not return valid mind-map JSON");
      output = { title, branches };
    } else {
      // summary
      const { text } = await rayaComplete([
        {
          role: "system",
          content:
            "You are a study assistant. Write a clear, well-structured summary of the material in ITS OWN language. Start with a one-line overview, then key points as bullet points (use '- '), then a short 'Key takeaways' section. Do not invent facts absent from the source.",
        },
        { role: "user", content: source },
      ]);
      const summary = text.trim();
      if (!summary) throw new Error("model returned an empty summary");
      output = { text: summary };
    }

    const { error: updErr } = await supabase
      .schema("learning")
      .from("tool_outputs")
      .update({ status: "done", output_content: output })
      .eq("id", id);
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ id, status: "done", tool_type: toolType, output_content: output });
  } catch (e) {
    const message = e instanceof Error ? e.message : "generation failed";
    await supabase
      .schema("learning")
      .from("tool_outputs")
      .update({ status: "failed", error_message: message })
      .eq("id", id);
    return NextResponse.json({ id, status: "failed", error: message }, { status: 502 });
  }
}

function safeParseJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
