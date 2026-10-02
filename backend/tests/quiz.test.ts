import test from 'node:test';
import assert from 'node:assert/strict';
import { quizOptions } from '../src/lib/quiz';

test('quiz includes one correct definition and three distinct distractors, excluding other senses', () => {
  const word = { term: 'light', definition: 'Luce.', senses: [{ definition: 'Leggero.' }] };
  const candidates = [
    { term: 'light', definition: 'Illuminare.' },
    { term: 'glow', definition: ' luce! ' },
    { term: 'weightless', definition: 'LEGGERO' },
    { term: 'heavy', definition: 'Pesante.' },
    { term: 'hefty', definition: 'pesante!' },
    { term: 'bright', definition: 'Luminoso.' },
    { term: 'dark', definition: 'Buio.' },
  ];
  for (let attempt = 0; attempt < 20; attempt++) {
    assert.deepEqual(quizOptions(word, candidates).sort(), ['Luce.', 'Pesante.', 'Luminoso.', 'Buio.'].sort());
  }
});

test('quiz keeps the correct answer when fewer distractors are available', () => {
  assert.deepEqual(quizOptions({ term: 'light', definition: 'Luce.' }, []), ['Luce.']);
});
