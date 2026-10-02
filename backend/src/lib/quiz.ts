import { randomInt } from 'node:crypto';

type QuizWord = { term: string; definition: string; senses?: { definition?: string | null }[] };
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('it').replace(/[\p{P}\p{Z}\s]+/gu, ' ').trim();

export function quizOptions(word: QuizWord, candidates: QuizWord[]): string[] {
  const excluded = new Set([word.definition, ...(word.senses ?? []).map(sense => sense.definition ?? '')].map(normalize));
  const options = [word.definition];
  for (const candidate of candidates) {
    const definition = candidate.definition.trim();
    const key = normalize(definition);
    if (normalize(candidate.term) === normalize(word.term) || !key || excluded.has(key)) continue;
    excluded.add(key);
    options.push(definition);
    if (options.length === 4) break;
  }
  for (let index = options.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [options[index], options[other]] = [options[other]!, options[index]!];
  }
  return options;
}
