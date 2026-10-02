import { writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { CATALOG_URL, normalizeCatalog } from "../catalog/import";

async function download() {
  const response = await fetch(CATALOG_URL, {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw new Error(`Download non riuscito: ${response.status}`);
  const entries = (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const words = normalizeCatalog(entries);
  if (words.length < 1000)
    throw new Error(
      "Catalogo incompleto: il file esistente non è stato sostituito.",
    );
  const output = resolve(__dirname, "../../src/data/catalog.json");
  await writeFile(
    output + ".tmp",
    "[\n" +
      words.map((word) => "  " + JSON.stringify(word)).join(",\n") +
      "\n]\n",
  );
  await rename(output + ".tmp", output);
  console.log(
    `Catalogo aggiornato: ${words.length} parole con definizioni italiane.`,
  );
}
void download().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
