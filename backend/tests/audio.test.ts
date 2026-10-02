import test from "node:test";
import assert from "node:assert/strict";
import { pronounce, stopPronunciation } from "../../frontend/src/lib/audio";

function setup(
  voices: { lang: string }[] = [
    { lang: "it-IT" },
    { lang: "en-US" },
    { lang: "en-GB" },
  ],
) {
  const spoken: any[] = [];
  const listeners = new Set<() => void>();
  const synthesis = {
    getVoices: () => voices,
    cancel() {},
    addEventListener(_event: string, listener: () => void) {
      listeners.add(listener);
      queueMicrotask(() => {
        voices = [{ lang: "en-GB" }];
        listener();
      });
    },
    removeEventListener(_event: string, listener: () => void) {
      listeners.delete(listener);
    },
    speak(utterance: any) {
      spoken.push(utterance);
      queueMicrotask(() => utterance.onend());
    },
  };
  (globalThis as any).window = { speechSynthesis: synthesis };
  (globalThis as any).SpeechSynthesisUtterance = class {
    constructor(public text: string) {}
  };
  return { spoken, listeners };
}
test("pronunciation explicitly chooses an English voice and disambiguates in context", async () => {
  const { spoken } = setup();
  await pronounce({
    word: "record",
    examples: ["Keep a record of your progress."],
  });
  assert.equal(spoken[0].voice.lang, "en-GB");
  assert.equal(spoken[0].lang, "en-GB");
  assert.equal(spoken[0].text, "Keep a record of your progress.");
});
test("pronunciation waits for asynchronous voices and removes its listener", async () => {
  const { spoken, listeners } = setup([]);
  await pronounce({ word: "apple", examples: [] });
  assert.equal(spoken[0].voice.lang, "en-GB");
  assert.equal(listeners.size, 0);
});
test("a recording is preferred and a failed recording falls back to an English voice", async () => {
  const { spoken } = setup();
  let fail = false;
  const played: string[] = [];
  (globalThis as any).Audio = class {
    onended?: () => void;
    constructor(public url: string) {}
    pause() {}
    play() {
      played.push(this.url);
      if (fail) return Promise.reject(new Error("unavailable"));
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    }
  };
  await pronounce({
    word: "apple",
    examples: [],
    audioUrl: "https://example.com/apple.mp3",
  });
  assert.equal(played.length, 1);
  assert.equal(spoken.length, 0);
  fail = true;
  await pronounce({
    word: "apple",
    examples: [],
    audioUrl: "https://example.com/apple.mp3",
  });
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].voice.lang, "en-GB");
});
test("a missing English voice is reported rather than using an Italian voice", async () => {
  setup([{ lang: "it-IT" }]);
  await assert.rejects(
    () => pronounce({ word: "apple", examples: [] }),
    /voce inglese/,
  );
  stopPronunciation();
});
