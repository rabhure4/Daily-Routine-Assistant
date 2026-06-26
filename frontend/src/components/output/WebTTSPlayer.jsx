import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "daily-routine-assistant:tts";

export default function WebTTSPlayer({ text, compact = false }) {
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const synth = globalThis.speechSynthesis;
    if (!synth) return;
    setSupported(true);
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "{}");
      if (saved.voiceURI) setVoiceURI(saved.voiceURI);
      if (typeof saved.rate === "number") setRate(saved.rate);
    } catch {
      // Ignore malformed local storage.
    }

    function loadVoices() {
      setVoices(synth.getVoices());
    }

    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      synth.cancel();
      synth.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ voiceURI, rate }));
    } catch {
      // Ignore storage failures.
    }
  }, [voiceURI, rate]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === voiceURI) ?? null,
    [voices, voiceURI]
  );

  function speak() {
    if (!supported || !text.trim()) return;
    const synth = globalThis.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setPaused(false);
    };
    synth.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  }

  function togglePause() {
    const synth = globalThis.speechSynthesis;
    if (!synth || !speaking) return;
    if (paused) {
      synth.resume();
      setPaused(false);
    } else {
      synth.pause();
      setPaused(true);
    }
  }

  function stop() {
    globalThis.speechSynthesis?.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  if (!text) {
    return compact ? (
      <div className="w-full max-w-3xl rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs text-gray-600">
        Speech controls appear after a briefing.
      </div>
    ) : null;
  }

  if (!supported) {
    return (
      <div className={`${compact ? "w-full max-w-3xl rounded-lg px-3 py-2 text-xs" : "rounded-xl p-4 text-sm"} border border-border bg-surface text-gray-400`}>
        Browser speech is not available in this browser.
      </div>
    );
  }

  return (
    <div className={`${compact ? "w-full max-w-3xl rounded-lg px-2 py-1.5" : "rounded-xl p-4"} border border-border bg-surface`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button className={`${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} rounded-lg bg-accent font-medium text-white`} onClick={speak}>
          {speaking ? "Restart" : "Speak"}
        </button>
        <button className={`${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} rounded-lg border border-border text-gray-300`} onClick={togglePause} disabled={!speaking}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button className={`${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} rounded-lg border border-border text-gray-300`} onClick={stop} disabled={!speaking}>
          Stop
        </button>
        <select className={`input min-w-[260px] flex-[1_1_360px] ${compact ? "h-9 py-1 text-sm text-gray-100" : ""}`} value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)}>
          <option value="">Default voice</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Rate
          <input
            type="range"
            min="0.7"
            max="1.3"
            step="0.1"
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            className="w-24 accent-accent"
          />
        </label>
      </div>
    </div>
  );
}
