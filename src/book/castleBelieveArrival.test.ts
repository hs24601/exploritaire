import {describe,it,expect} from 'vitest';
import {castleBookOpen,castlePortalNear,CASTLE_BELIEVE_SECONDS} from './castleBelieveArrival';
import {BOOK_MAGIC} from './bookMagic';

describe('physical book portal arrival',()=>{
  it('starts shut and opens fully before entering the Believe portal',()=>{
    expect(castleBookOpen(0)).toBe(0);expect(castleBookOpen(BOOK_MAGIC.opening)).toBe(0);
    expect(castleBookOpen((BOOK_MAGIC.opening+BOOK_MAGIC.opened)/2)).toBeCloseTo(.5);
    expect(castleBookOpen(BOOK_MAGIC.opened)).toBe(1);
    expect(CASTLE_BELIEVE_SECONDS).toBeGreaterThan(BOOK_MAGIC.opened);
  });
  it('preserves paper/letter depth precision while keeping the close portal in front of the near plane',()=>{
    expect(castlePortalNear(10)).toBe(.1);
    for(const distance of [8,2,.1,.01,.001]){expect(castlePortalNear(distance)).toBeGreaterThanOrEqual(distance*.01);expect(castlePortalNear(distance)).toBeLessThan(distance*.1);}
  });
});
