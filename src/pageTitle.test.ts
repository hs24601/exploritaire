import { it, expect } from 'vitest';
import { pageTitle } from './pageTitle';
it('keeps the original title without query parameters',()=>expect(pageTitle('','Proto - Exploritaire')).toBe('Proto - Exploritaire'));
it('names combat scenarios from the live scenario catalog',()=>expect(pageTitle('?combatsbx&scenario=999','Proto - Exploritaire')).toBe('Dark Tyrant · Combat Sandbox · Exploritaire'));
it('includes all flags, values, unknown keys, and repeated entries',()=>expect(pageTitle('?kerusbx&element=ice&fx=low&customMode=a%20b&tag=one&tag=two','Exploritaire')).toBe('Keru Drafts · Element: ice · Effects: low · Custom Mode: a b · Tag: one · Tag: two · Exploritaire'));
it('supports unknown scenarios and non-Proto page names',()=>expect(pageTitle('?scenario=new&debug','Card Designer')).toBe('Scenario: new · Debug · Card Designer'));
