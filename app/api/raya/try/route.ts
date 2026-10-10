import { NextResponse } from "next/server";
import { clientError } from "@/lib/observability/client-error";
import { buildRayaMessages } from "@/lib/raya/prompt";
import { rayaStream } from "@/lib/raya/llm";
import { checkStrictRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { DEFAULT_AI_MODE } from "@/lib/raya/modes";
import { GUEST_MESSAGE_MAX, GUEST_TURN_LIMIT, cleanGuestMessages, guestTurns } from "@/lib/raya/guest";
import { apiT, getServerLocale } from "@/lib/i18n/server";
import { conceptNamer } from "@/lib/kernel/concept-names-server";
import { wikiQuery, lookupWikipedia, referenceBlock } from "@/lib/raya/wikipedia";

export const maxDuration = 60;

/**
 * Guest turns per IP per day, across every visitor behind it. A school or a
 * mobile gateway puts many people behind one address, so this is set for a
 * room of curious visitors (a dozen of them using their full trial), not for
 * one — the per-visitor limit is GUEST_TURN_LIMIT, checked on the history.
 * Tune with RAYA_GUEST_TURNS_PER_IP_PER_DAY.
 */
const TURNS_PER_IP_PER_DAY = Number(process.env.RAYA_GUEST_TURNS_PER_IP_PER_DAY ?? "60");

/**
 * One Raya turn for a visitor with no account (see lib/raya/guest.ts).
 *
 * Stateless: the client sends the thread so far, the reply streams back, and
 * nothing is written anywhere. Same tutor as /api/raya/chat on the cheap tier,
 * with no learner profile, no documents and no persona — those come with an
 * account, and are what the sign-up wall offers.
 *
 * The per-visitor limit is read off the history the client sends, so a visitor
 * who clears their browser starts again. That is accepted: the per-IP ceiling
 * is what bounds the cost, and the trial is meant to be easy to reach.
 */
export async function POST(request: Request) {
  let body: { history?: unknown; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const content = (body.content ?? "").trim().slice(0, GUEST_MESSAGE_MAX);
  if (!content) {
    return NextResponse.json({ error: await apiT("api.emptyMessage") }, { status: 400 });
  }
  const history = cleanGuestMessages(body.history);
  if (guestTurns(history) >= GUEST_TURN_LIMIT) {
    return NextResponse.json(
      { code: "guest_limit", limit: GUEST_TURN_LIMIT, error: await apiT("api.guestLimit") },
      { status: 403 },
    );
  }

  // Fails CLOSED, unlike the per-user limits: nothing else stands between an
  // anonymous caller and a paid model. `next dev` sends no forwarding header,
  // so a local run is given an address rather than refused.
  const ip = clientIp(request) || (process.env.NODE_ENV === "production" ? "" : "127.0.0.1");
  const [burstOk, dayOk] = await Promise.all([
    checkStrictRateLimit("raya_guest", ip, 10, "1 minute"),
    checkStrictRateLimit("raya_guest_day", ip, TURNS_PER_IP_PER_DAY, "24 hours"),
  ]);
  if (!burstOk) {
    return NextResponse.json({ error: await apiT("api.chatTooFast") }, { status: 429 });
  }
  if (!dayOk) {
    return NextResponse.json(
      { code: "guest_limit", limit: GUEST_TURN_LIMIT, error: await apiT("api.guestLimit") },
      { status: 403 },
    );
  }

  const locale = await getServerLocale();
  const lookup = wikiQuery(content);
  const [reference, names] = await Promise.all([
    lookup ? lookupWikipedia(lookup, locale) : Promise.resolve([]),
    conceptNamer("en"),
  ]);

  try {
    const { model, stream: deltas } = await rayaStream(
      buildRayaMessages(
        [...history, { role: "user", content }],
        null,
        [],
        "",
        "",
        null,
        null,
        null,
        DEFAULT_AI_MODE,
        "fast",
        names,
        referenceBlock(reference, locale),
      ),
      "fast",
    );
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of deltas) controller.enqueue(encoder.encode(delta));
        } catch {
          // keep whatever streamed so far
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-raya-model": model,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: clientError(e, await apiT("api.llmError")) }, { status: 502 });
  }
}
