/**
 * Times one streamed Raya reply, for `raya_response_received`.
 *
 * Started just before the model call, so it measures the provider, not our own
 * prompt building (that is a server metric, not a product one). Only numbers
 * leave here — how long, how much — never the reply itself.
 */
export function replyClock() {
  const startedAt = Date.now();
  let firstAt: number | null = null;
  return {
    /** Call on every streamed delta; only the first one is remembered. */
    tick() {
      if (firstAt === null) firstAt = Date.now();
    },
    /** The event's properties, once the stream has ended (or broken). */
    done(replyLength: number, interrupted: boolean) {
      return {
        latency_ms: Date.now() - startedAt,
        first_token_ms: firstAt === null ? null : firstAt - startedAt,
        response_length: replyLength,
        outcome: interrupted ? "interrupted" : replyLength === 0 ? "empty" : "complete",
      };
    },
  };
}
