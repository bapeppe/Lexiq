export const CATALOG_URL =
  "https://kaikki.org/itwiktionary/Inglese/kaikki.org-dictionary-Inglese.jsonl";
const parts: Record<string, string> = {
  noun: "sostantivo",
  verb: "verbo",
  adj: "aggettivo",
  adv: "avverbio",
  pron: "pronome",
  prep: "preposizione",
  conj: "congiunzione",
  intj: "interiezione",
  article: "articolo",
  phrase: "espressione",
};
const excluded = new Set([
  "form-of",
  "no-gloss",
  "obsolete",
  "archaic",
  "rare",
  "vulgar",
  "offensive",
  "pejorative",
]);
// Everyday vocabulary comes first; no CEFR level is inferred from a dictionary.
const common = new Set(
  "able about above accept across act action active activity add adult after again age ago agree air allow almost alone along already also always animal answer any anyone anything appear area arm around arrive art ask at away baby back bad bag ball bank base be beautiful because become bed before begin behind believe below best better between big bird black blood blue boat body book both box boy break bring brother build bus business busy buy call can car care carry case cat catch cause change check child choose city class clean clear close clothes cold come common company complete cook cost could country course create cut dark daughter day dead deal dear decide deep develop die different difficult dinner direction discover do doctor dog door down draw dream drink drive during each early earth east easy eat education effect egg eight either else end energy enjoy enough enter environment even ever every everyone everything example expect experience explain eye face fact fall family far fast father fear feel few field fight fill final find fine finish fire first fish five floor flower fly follow food foot for forget form four free friend from front full future game garden get girl give glass go good government great green ground group grow hair half hand happen happy hard have he head health hear heart heavy help her here high him his history hold home hope hospital hot hour house how human idea if important in include increase industry information inside instead interest into job join just keep key kid kind know land language large last late later laugh law learn leave left leg less let letter life light like line listen little live local long look lose lot love low machine main make man many market may meal mean meet member memory message might minute miss moment money month more morning most mother move much music must name natural near need never new next nice night no north nothing now number of off offer office often old on once one only open or order other our out outside over own page paper parent part past pay people person phone picture place plan play please point police poor possible power present price probably problem public pull put question quick quite rain read ready real reason receive red remember rest result return rich right rise river road room run sad same save say school science sea second see seem sell send sense sentence serious serve service set seven several shall she ship shoe shop short should show side simple since sing sister sit six sleep small smile so some someone something sometimes son song soon sorry sound south speak special spend stand start state stay step still stop story street strong student study such summer sun sure table take talk teach team tell ten than thank that the their them then there these they thing think third this those though thought three through time to today together tomorrow too top total touch town train travel tree true try turn two under understand unit until up use useful usually value very view visit voice wait walk want warm watch water way we week well west what when where which while white who whole why wide will win window wish with within without woman wonder word work world would write wrong year yes yesterday yet you young your".split(
    " ",
  ),
);
export type CatalogWord = {
  term: string;
  partOfSpeech: string;
  definition: string;
  ipa: string;
  context: string;
  priority: number;
  source: string;
  audioUrl?: string;
  audioSourceUrl?: string;
  senses: { definition: string; partOfSpeech: string; context: string }[];
};
function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
export function normalizeCatalog(entries: Iterable<any>): CatalogWord[] {
  const result = new Map<string, CatalogWord>();
  for (const entry of entries) {
    const term = clean(entry.word);
    const partOfSpeech = parts[entry.pos];
    if (
      entry.lang_code !== "en" ||
      !partOfSpeech ||
      !/^[a-z]+(?:[ '-][a-z]+)*$/.test(term) ||
      term.length > 60
    )
      continue;
    if ((entry.tags || []).some((tag: string) => excluded.has(tag))) continue;
    const usable = (entry.senses || []).filter(
      (sense: any) =>
        !(sense.tags || []).some((tag: string) => excluded.has(tag)) &&
        !sense.form_of,
    );
    for (const sense of usable) {
      let definition = (sense.glosses || [])
        .map(clean)
        .filter(Boolean)
        .join("; ");
      // Some entries contain an English explanation followed by an Italian one.
      if (/\s[-–]\s/.test(definition) && /^(to |a |an |the )/i.test(definition))
        definition = definition
          .split(/\s[-–]\s/)
          .slice(1)
          .join(" — ");
      if (
        !definition ||
        definition.length > 800 ||
        /mancante|aggiungila|da tradurre|forma flessa|plurale di|participio|terza persona/i.test(
          definition,
        )
      )
        continue;
      const context = clean(
        (sense.examples || []).find((example: any) =>
          clean(example.text).toLowerCase().includes(term),
        )?.text,
      );
      const sounds = (entry.sounds || []).filter(
        (sound: any) =>
          !(/noun/i.test(sound.audio || "") && entry.pos !== "noun") &&
          !(/verb/i.test(sound.audio || "") && entry.pos !== "verb"),
      );
      const audio =
        sounds.find(
          (sound: any) => /(?:uk|gb)/i.test(sound.audio || "") && sound.mp3_url,
        ) || sounds.find((sound: any) => sound.mp3_url);
      const audioMatchesPart =
        audio &&
        !(/noun/i.test(audio.audio || "") && entry.pos !== "noun") &&
        !(/verb/i.test(audio.audio || "") && entry.pos !== "verb");
      const ipa = clean(
        (audioMatchesPart ? audio.ipa : undefined) ||
          sounds.find((sound: any) => sound.ipa)?.ipa,
      );
      const normalizedSense = { definition, partOfSpeech, context };
      const existing = result.get(term);
      if (existing) {
        if (
          existing.senses.length < 12 &&
          !existing.senses.some(
            (item) =>
              item.definition === definition &&
              item.partOfSpeech === partOfSpeech,
          )
        )
          existing.senses.push(normalizedSense);
      } else {
        result.set(term, {
          term,
          definition,
          partOfSpeech,
          context,
          ipa,
          priority: common.has(term) ? 10 : context ? 50 : 100,
          source: "wiktionary",
          senses: [normalizedSense],
          ...(audioMatchesPart &&
          /^https:\/\/upload\.wikimedia\.org\//.test(audio.mp3_url)
            ? {
                audioUrl: audio.mp3_url,
                audioSourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(audio.audio.replaceAll(" ", "_"))}`,
              }
            : {}),
        });
      }
    }
  }
  return [...result.values()].sort(
    (a, b) => a.priority - b.priority || a.term.localeCompare(b.term, "en"),
  );
}
