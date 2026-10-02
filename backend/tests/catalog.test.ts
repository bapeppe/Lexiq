import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalog } from "../src/catalog/import";
import { serializeWord } from "../src/http/service";

const entry = (word: string, gloss: string, extra = {}) => ({
  word,
  lang_code: "en",
  pos: "noun",
  senses: [{ glosses: [gloss] }],
  ...extra,
});
test("dictionary importer filters unusable entries and retains Italian senses without inventing content", () => {
  const normalized = normalizeCatalog([
    entry("apple", "mela"),
    entry("apple", "albero di mele"),
    entry("apples", "mele", {
      senses: [{ glosses: ["mele"], tags: ["form-of"] }],
    }),
    entry("Apple", "nome proprio"),
    entry("bad", "voce rara", { tags: ["rare"] }),
    entry("ciao", "saluto", { lang_code: "it" }),
    entry("missing", "definizione mancante"),
    entry("water", "acqua", {
      senses: [
        {
          glosses: ["acqua"],
          examples: [{ text: "May I have a glass of water?" }],
        },
      ],
    }),
  ]);
  assert.deepEqual(
    normalized.map((word) => word.term),
    ["water", "apple"],
  );
  const apple = normalized.find((word) => word.term === "apple")!;
  assert.equal(apple.senses.length, 2);
  assert.equal(apple.context, "");
  assert.equal(apple.ipa, "");
  assert.equal("level" in apple, false);
  assert.equal(
    normalized.find((word) => word.term === "water")!.context,
    "May I have a glass of water?",
  );
});
test("audio attached to a noun is not reused as verb audio", () => {
  const sound = {
    audio: "en-us-record-noun.ogg",
    mp3_url: "https://upload.wikimedia.org/record.mp3",
    ipa: "/ˈɹɛ.kɚd/",
  };
  const [noun] = normalizeCatalog([
    entry("record", "registrazione", { sounds: [sound] }),
  ]);
  const [verb] = normalizeCatalog([
    entry("record", "registrare", { pos: "verb", sounds: [sound] }),
  ]);
  assert.equal(noun!.audioUrl, sound.mp3_url);
  assert.equal(verb!.audioUrl, undefined);
  assert.equal(verb!.ipa, "");
  const [unsafe] = normalizeCatalog([
    entry("safe", "sicuro", {
      sounds: [{ ...sound, mp3_url: "https://untrusted.example/audio.mp3" }],
    }),
  ]);
  assert.equal(unsafe!.audioUrl, undefined);
});
test("serialized imported words expose attribution and omit empty examples", () => {
  const word = serializeWord({
    _id: "abc",
    term: "apple",
    source: "wiktionary",
    definition: "mela",
    context: "",
    collocations: [],
    senses: [],
  });
  assert.equal(word.sourceUrl, "https://it.wiktionary.org/wiki/apple");
  assert.equal(word.license, "CC BY-SA 4.0");
  assert.deepEqual(word.examples, []);
});
