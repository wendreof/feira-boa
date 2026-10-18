import test from 'node:test';
import assert from 'node:assert/strict';

import { showTransientStatus } from '../status-toast.js';

function makeElement() {
  const classes = new Set();
  return {
    textContent: '',
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
}

test('showTransientStatus shows the message and marks it visible', () => {
  const element = makeElement();

  showTransientStatus(element, 'Oferta compartilhada.', 0);

  assert.equal(element.textContent, 'Oferta compartilhada.');
  assert.equal(element.classList.contains('show'), true);
});

test('showTransientStatus clears the message after the timeout', async () => {
  const element = makeElement();

  showTransientStatus(element, 'Sua avaliação foi salva.', 10);
  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.equal(element.textContent, '');
  assert.equal(element.classList.contains('show'), false);
});
