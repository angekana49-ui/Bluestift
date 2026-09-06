/**
 * What a caller is told when something breaks on our side.
 *
 * The sibling of `report.ts`, which decides what WE keep. This decides what
 * THEY see, and the two answers are deliberately different: the log line gets
 * the constraint name and the stack, the response gets a sentence.
 *
 * Two reasons the raw message stopped travelling, and the second matters more
 * than the first:
 *
 *  - it describes our schema. A Postgres error names columns, constraints and
 *    policies. That is low-value intelligence when the migrations are public,
 *    but it is intelligence we had no reason to hand out, and the day something
 *    private ends up in an error message is not a day anyone notices.
 *
 *  - IT REACHED THE USER. Every client here renders `data.error` straight into
 *    the interface (`setError(data?.error ?? "Upload failed.")`), so a failed
 *    save was showing a child "duplicate key value violates unique constraint
 *    …". The fallback sentence those call sites already carry is the message
 *    that was meant to be seen; this makes the server send one too.
 *
 * In development the real message comes through, because the alternative is an
 * engineer staring at "something went wrong" with no way to find out what.
 */

/** Said when a route has nothing more specific to offer. */
export const GENERIC_FAILURE = "Something went wrong on our side. Try again.";

/**
 * The message for a 5xx response body.
 *
 * `fallback` is what production says — pass the wording the route already used
 * for this failure ("generation failed", "transcription error") so the caller's
 * experience is unchanged and only the leak is gone.
 */
export function clientError(err: unknown, fallback: string = GENERIC_FAILURE): string {
  if (process.env.NODE_ENV === "production") return fallback;

  const message =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : "";
  return message.trim() || fallback;
}
