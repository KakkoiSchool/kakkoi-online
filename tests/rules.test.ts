import { expect, test } from 'bun:test';
import { actionWinner, elementMultiplier, type Action } from '../src/battle/rules.ts';

const ACTIONS: Action[] = ['strike', 'block', 'charge'];

test('the element cycle has no ties and no dominant element', () => {
  expect(elementMultiplier('water', 'fire')).toBe(2);
  expect(elementMultiplier('fire', 'earth')).toBe(2);
  expect(elementMultiplier('earth', 'water')).toBe(2);

  expect(elementMultiplier('fire', 'water')).toBe(0.5);
  expect(elementMultiplier('earth', 'fire')).toBe(0.5);
  expect(elementMultiplier('water', 'earth')).toBe(0.5);

  for (const e of ['fire', 'water', 'earth'] as const) {
    expect(elementMultiplier(e, e)).toBe(1);
  }
});

test('the action triangle is a proper cycle', () => {
  expect(actionWinner('strike', 'charge')).toBe(1);
  expect(actionWinner('charge', 'block')).toBe(1);
  expect(actionWinner('block', 'strike')).toBe(1);
});

test('the action triangle is antisymmetric, and mirrors tie', () => {
  for (const a of ACTIONS) {
    for (const b of ACTIONS) {
      if (a === b) expect(actionWinner(a, b)).toBe(0);
      else expect(actionWinner(a, b)).toBe(-actionWinner(b, a) as -1 | 1);
    }
  }
});
