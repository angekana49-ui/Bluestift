"use client";

import { useCallback, useRef, useState } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { putBlob, getBlob, deleteBlob } from "@/lib/net/blob-store";

/** Where a failed recording waits. One slot: the last un-transcribed take. */
const PENDING_AUDIO_ID = "pending-voice";

/**
 * Record a short voice message, transcribe it via /api/raya/transcribe (Whisper
 * on Groq), and hand the text back. Shared by the solo chat and both room Raya
 * channels. Needs a secure context (HTTPS or localhost) + mic permission —
 * a refusal surfaces on `error` rather than throwing.
 *
 * A failed transcription KEEPS the recording (in memory and in IndexedDB, so it
 * survives a reload) and exposes `retry`/`discard`. Losing a spoken answer to a
 * dropped connection would be the worst kind of data loss: it can't be scrolled
 * back to and retyped, it's simply gone.
 */
export function useVoiceRecorder(onText: (text: string) => void | Promise<void>) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True while an un-transcribed recording is held for retry. */
  const [hasPending, setHasPending] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingRef = useRef<Blob | null>(null);

  const transcribe = useCallback(
    async (blob: Blob): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("audio", blob, "audio.webm");
        const res = await netFetch(
          "/api/raya/transcribe",
          { method: "POST", body: fd },
          { timeoutMs: 45_000 }, // audio upload + Whisper on a weak link
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.text) {
          setError(data?.error ? `Transcription: ${data.error}` : "Could not transcribe.");
          return false;
        }
        await onText(data.text as string);
        return true;
      } catch {
        setError("Could not transcribe — your recording is saved.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onText],
  );

  async function handleResult(blob: Blob) {
    const ok = await transcribe(blob);
    if (ok) {
      pendingRef.current = null;
      setHasPending(false);
      void deleteBlob(PENDING_AUDIO_ID);
      return;
    }
    // Hold the audio for a retry — in memory now, on disk for a reload.
    pendingRef.current = blob;
    setHasPending(true);
    void putBlob(PENDING_AUDIO_ID, blob, { kind: "voice" });
  }

  async function toggle() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        await handleResult(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
    }
  }

  /** Retry the held recording (falls back to the on-disk copy after a reload). */
  async function retry() {
    if (busy) return;
    const blob = pendingRef.current ?? (await getBlob(PENDING_AUDIO_ID))?.blob ?? null;
    if (!blob) {
      setHasPending(false);
      return;
    }
    pendingRef.current = blob;
    await handleResult(blob);
  }

  /** Drop the held recording — the student's explicit choice, never ours. */
  function discard() {
    pendingRef.current = null;
    setHasPending(false);
    setError(null);
    void deleteBlob(PENDING_AUDIO_ID);
  }

  return { recording, busy, error, hasPending, toggle, retry, discard };
}
