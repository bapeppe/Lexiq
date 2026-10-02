export type Pronounceable = {
  word: string;
  examples: string[];
  audioUrl?: string;
};
let currentAudio: HTMLAudioElement | null = null;
let request = 0;
let finishAudio: (() => void) | null = null;

export function stopPronunciation() {
  request++;
  currentAudio?.pause();
  currentAudio = null;
  finishAudio?.();
  finishAudio = null;
  window.speechSynthesis?.cancel();
}
async function englishVoices() {
  const synthesis = window.speechSynthesis;
  let voices = synthesis.getVoices();
  if (!voices.length) {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        synthesis.removeEventListener("voiceschanged", done);
        resolve();
      };
      const timer = setTimeout(done, 1500);
      synthesis.addEventListener("voiceschanged", done);
    });
    voices = synthesis.getVoices();
  }
  return voices.filter((voice) => /^en(?:-|_)/i.test(voice.lang));
}
export async function pronounce(word: Pronounceable) {
  stopPronunciation();
  const token = request;
  if (word.audioUrl) {
    try {
      const audio = new Audio(word.audioUrl);
      currentAudio = audio;
      await new Promise<void>((resolve, reject) => {
        finishAudio = resolve;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio non disponibile"));
        void audio.play().catch(reject);
      });
      if (token === request) {
        currentAudio = null;
        finishAudio = null;
      }
      return;
    } catch {
      if (token !== request) return;
      currentAudio?.pause();
      currentAudio = null;
      finishAudio = null;
    }
  }
  if (!("speechSynthesis" in window))
    throw new Error("La pronuncia audio non è disponibile in questo browser.");
  const voices = await englishVoices();
  if (token !== request) return;
  const voice =
    voices.find((item) => /^en[-_]GB$/i.test(item.lang)) ||
    voices.find((item) => /^en[-_]US$/i.test(item.lang)) ||
    voices[0];
  if (!voice)
    throw new Error(
      "Non è disponibile una voce inglese. Abilita una voce inglese sul dispositivo per ascoltare questa parola.",
    );
  // Context helps the synthesizer disambiguate heteronyms such as “lead”.
  const ambiguous = new Set([
    "lead",
    "read",
    "record",
    "present",
    "wind",
    "tear",
    "bow",
    "close",
    "live",
    "object",
    "produce",
    "conduct",
    "refuse",
  ]);
  const text =
    ambiguous.has(word.word.toLowerCase()) && word.examples[0]
      ? word.examples[0]
      : word.word;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9;
  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted")
        resolve();
      else reject(new Error("Impossibile riprodurre la pronuncia. Riprova."));
    };
    window.speechSynthesis.speak(utterance);
  });
}
