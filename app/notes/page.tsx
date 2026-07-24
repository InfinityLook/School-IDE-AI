"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SavedNote {
  id: string;
  title: string;
  transcript: string;
  aiNotes: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "school-ide-notes";

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function simulateTranscription(durationSeconds: number): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const samples = [
    "Dnes jsme probírali derivace a jejich aplikace v praktických úlohách. Učitel vysvětlil pravidlo řetězení a ukázal několik příkladů z maturitních testů. Na konci hodiny jsme dostali domácí úkol ze strany 45.",
    "Přednáška o fotosyntéze pokrývala světelné a temnostové fáze. Důležité je zapamatovat si role chloroplastů, ATP a NADPH. Příště budeme pokračovat buněčným dýcháním.",
    "V hodině programování jsme implementovali REST API v Node.js. Prošli jsme middleware, routing a práci s JSON daty. Projekt odevzdáváme do pátku.",
  ];

  const index = durationSeconds % samples.length;
  return samples[index];
}

async function simulateAiNotes(transcript: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const bullets = sentences.slice(0, 4).map((s) => `• ${s}.`);
  const summary = sentences[0] ?? transcript;

  return [
    "## Shrnutí",
    summary + (summary.endsWith(".") ? "" : "."),
    "",
    "## Klíčové body",
    ...bullets,
    "",
    "## Doporučení pro studium",
    "• Zopakuj si hlavní pojmy z hodiny",
    "• Vytvoř si vlastní příklady pro procvičení",
    "• Připrav si otázky na příští hodinu",
  ].join("\n");
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  );
}

export default function NotesPage() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [lastRecordingDuration, setLastRecordingDuration] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<SavedNote>>({});

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedNotes(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedNotes));
  }, [savedNotes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioUrl]);

  const clearRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setLastRecordingDuration(0);
  }, [audioUrl]);

  const startRecording = async () => {
    setMicError(null);
    clearRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      setMicError(
        "Nepodařilo se získat přístup k mikrofonu. Zkontroluj oprávnění prohlížeče."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setLastRecordingDuration(recordingTime);
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const processRecording = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    try {
      const result = await simulateTranscription(lastRecordingDuration || recordingTime);
      setTranscript(result);
      if (!noteTitle) {
        setNoteTitle(`Poznámka ${formatDate(new Date().toISOString())}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAiNotes = async () => {
    if (!transcript.trim()) return;
    setIsGeneratingNotes(true);
    try {
      const result = await simulateAiNotes(transcript);
      setAiNotes(result);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const saveNote = () => {
    if (!transcript.trim()) return;

    const now = new Date().toISOString();
    const newNote: SavedNote = {
      id: crypto.randomUUID(),
      title: noteTitle.trim() || `Poznámka ${formatDate(now)}`,
      transcript,
      aiNotes,
      createdAt: now,
      updatedAt: now,
    };

    setSavedNotes((prev) => [newNote, ...prev]);
    setNoteTitle("");
    setTranscript("");
    setAiNotes("");
    clearRecording();
  };

  const deleteNote = (id: string) => {
    setSavedNotes((prev) => prev.filter((note) => note.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDraft({});
    }
  };

  const startEditing = (note: SavedNote) => {
    setEditingId(note.id);
    setEditDraft({
      title: note.title,
      transcript: note.transcript,
      aiNotes: note.aiNotes,
    });
  };

  const saveEdit = (id: string) => {
    setSavedNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? {
              ...note,
              title: editDraft.title?.trim() || note.title,
              transcript: editDraft.transcript ?? note.transcript,
              aiNotes: editDraft.aiNotes ?? note.aiNotes,
              updatedAt: new Date().toISOString(),
            }
          : note
      )
    );
    setEditingId(null);
    setEditDraft({});
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Poznámky & AI Přepis
        </h1>
        <p className="mt-2 text-zinc-400">
          Nahraj audio z hodiny, nech si ho přepsat a vygeneruj studijní poznámky
          pomocí AI.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recording card */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-xl shadow-black/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <MicIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Nahrávání audia</h2>
              <p className="text-sm text-zinc-500">Web Audio API / MediaRecorder</p>
            </div>
          </div>

          <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-10">
            {isRecording && (
              <div className="mb-6 flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <span className="font-mono text-2xl font-semibold text-red-400">
                  {formatTime(recordingTime)}
                </span>
                <span className="text-sm text-zinc-500">Nahrávám…</span>
              </div>
            )}

            {!isRecording && !audioUrl && (
              <p className="mb-6 text-center text-sm text-zinc-500">
                Stiskni tlačítko pro spuštění nahrávání z mikrofonu.
              </p>
            )}

            {!isRecording && audioUrl && (
              <div className="mb-6 w-full space-y-3">
                <p className="text-center text-sm text-zinc-400">
                  Nahrávka hotova ({formatTime(lastRecordingDuration)})
                </p>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full"
                />
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
                >
                  <MicIcon className="h-4 w-4" />
                  Spustit nahrávání
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-600"
                >
                  Zastavit nahrávání
                </button>
              )}

              {audioBlob && !isRecording && (
                <>
                  <button
                    type="button"
                    onClick={processRecording}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessing ? "Zpracovávám…" : "Odeslat ke zpracování"}
                  </button>
                  <button
                    type="button"
                    onClick={clearRecording}
                    className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Smazat nahrávku
                  </button>
                </>
              )}
            </div>

            {micError && (
              <p className="mt-4 text-center text-sm text-red-400">{micError}</p>
            )}
          </div>
        </section>

        {/* Transcript & AI card */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-xl shadow-black/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Přepis & AI poznámky</h2>
              <p className="text-sm text-zinc-500">Transkripce a studijní shrnutí</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="note-title"
                className="mb-1.5 block text-sm font-medium text-zinc-400"
              >
                Název poznámky
              </label>
              <input
                id="note-title"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Např. Matematika – derivace"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="transcript"
                className="mb-1.5 block text-sm font-medium text-zinc-400"
              >
                Přepis (transkripce)
              </label>
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={5}
                placeholder="Přepis se zobrazí po odeslání nahrávky ke zpracování, nebo ho můžeš napsat ručně…"
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={generateAiNotes}
              disabled={!transcript.trim() || isGeneratingNotes}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SparklesIcon className="h-4 w-4" />
              {isGeneratingNotes
                ? "Generuji poznámky…"
                : "Generovat AI poznámky"}
            </button>

            {aiNotes && (
              <div>
                <label
                  htmlFor="ai-notes"
                  className="mb-1.5 block text-sm font-medium text-zinc-400"
                >
                  AI poznámky
                </label>
                <textarea
                  id="ai-notes"
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-sm leading-relaxed text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={saveNote}
              disabled={!transcript.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Uložit poznámku
            </button>
          </div>
        </section>
      </div>

      {/* Saved notes */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-xl shadow-black/20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Uložené poznámky</h2>
            <p className="text-sm text-zinc-500">
              {savedNotes.length === 0
                ? "Zatím nemáš žádné uložené poznámky."
                : `${savedNotes.length} ${savedNotes.length === 1 ? "poznámka" : savedNotes.length < 5 ? "poznámky" : "poznámek"}`}
            </p>
          </div>
        </div>

        {savedNotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">
            Nahraj audio nebo napiš přepis ručně a ulož si první poznámku.
          </div>
        ) : (
          <ul className="space-y-4">
            {savedNotes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700"
              >
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editDraft.title ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <textarea
                      value={editDraft.transcript ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          transcript: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
                    />
                    <textarea
                      value={editDraft.aiNotes ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          aiNotes: e.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(note.id)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                      >
                        Uložit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft({});
                        }}
                        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                      >
                        Zrušit
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-white">{note.title}</h3>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatDate(note.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(note)}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-950/50"
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-zinc-400">
                      {note.transcript}
                    </p>
                    {note.aiNotes && (
                      <pre className="mt-3 max-h-32 overflow-hidden whitespace-pre-wrap rounded-lg bg-zinc-950/80 p-3 text-xs text-zinc-500">
                        {note.aiNotes}
                      </pre>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
