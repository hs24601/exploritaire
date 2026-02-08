import type { Element, Token } from './types';
import { randomIdSuffix } from './constants';

export function createToken(element: Element, quantity = 1): Token {
  return {
    id: `token-${element}-${Date.now()}-${randomIdSuffix()}`,
    element,
    quantity,
  };
}

export function createInitialTokens(): Token[] {
  return [];
}
