"use client";

import { useRef, useState } from "react";

/**
 * Record a short voice message, transcribe it via /api/raya/transcribe (Whisper
 * on Groq), and hand the text back. Shared by the solo chat and both room RAYA
 * channels. Needs a secure context (HTTPS or localhost) + mic permission —
 * a refusal surfaces on `error` rather than throwing.
 */
export function useVoiceRecorder(onText: (text: string) => void | Promise<void>) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setBusy(true);
        setError(null);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "audio.webm");
          const res = await fetch("/api/raya/transcribe", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok || !data.text) {
            setError(data?.error ? `Transcription: ${data.error}` : "Could not transcribe.");
            return;
          }
          await onText(data.text as string);
        } catch {
          setError("Could not transcribe.");
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
    }
  }

  return { recording, busy, error, toggle };
}
