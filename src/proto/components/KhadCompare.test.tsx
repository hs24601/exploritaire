import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardJumboProvider } from './CardJumbo';
import { KhadCompare } from './KhadCompare';

describe('Khad Roots compare view', () => {
  it('renders the same rooted cards with both geometries, including a group link', () => {
    const html = renderToStaticMarkup(createElement(CardJumboProvider, null, createElement(KhadCompare)));
    expect(html.match(/data-khad-geometry="v1"/g)?.length).toBe(6);
    expect(html.match(/data-khad-geometry="v2"/g)?.length).toBe(12);
    expect(html.match(/class="khad-root-link"/g)?.length).toBe(3);
    expect(html).toContain('data-khad-value-clearance');
  });
});
