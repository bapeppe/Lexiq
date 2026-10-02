import "dotenv/config";
import mongoose from "mongoose";
import { Word } from "../models";
import { words } from "../data/words";
import catalog from "../data/catalog.json";

export async function seedWords() {
  const curated = new Set(words.map((word) => word.term));
  const operations = [
    ...words.map((word) => ({
      updateOne: {
        filter: { term: word.term },
        update: { $setOnInsert: { ...word, priority: 0 } },
        upsert: true,
      },
    })),
    ...catalog
      .filter((word) => !curated.has(word.term))
      .map((word) => ({
        updateOne: {
          filter: { term: word.term },
          update: { $setOnInsert: { ...word, collocations: [] } },
          upsert: true,
        },
      })),
  ];
  // Repeated startup imports preserve IDs, user progress and editorial corrections.
  for (let index = 0; index < operations.length; index += 500) {
    await Word.bulkWrite<Record<string, unknown>>(
      operations.slice(index, index + 500),
      { ordered: false },
    );
  }
  await Word.updateMany(
    { term: { $in: [...curated] } },
    { $set: { priority: 0 } },
  );
  for (const word of words) {
    const entry = catalog.find(
      (item) =>
        item.term === word.term &&
        item.partOfSpeech === word.partOfSpeech &&
        item.audioUrl,
    );
    if (entry)
      await Word.updateOne(
        { term: word.term, audioUrl: { $in: [null, ""] } },
        {
          $set: {
            audioUrl: entry.audioUrl,
            audioSourceUrl: entry.audioSourceUrl,
          },
        },
      );
  }
  await Word.createIndexes();
  console.log(`Catalogo disponibile: ${await Word.countDocuments()} parole.`);
}

if (require.main === module) {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/lexiq_db";
  mongoose
    .connect(uri)
    .then(seedWords)
    .catch((error) => {
      console.error("Importazione non riuscita:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
