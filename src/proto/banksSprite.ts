import { HERO_DIRECTIONAL_SPRITE, type DirectionalSpriteDefinition, type DirectionalFrame } from './directionalSprites';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from './heroSittingSprite';
import { HERO_WALKING_DIRECTIONAL_SPRITE } from './heroWalkingSprite';
import { HERO_COMBAT_POSES } from './heroCombatSprites';

export const BANKS_CHARACTER = {
  id:'banks', name:'Banks', animalType:'Cat',
  description:'A steady, protective gray tabby with pale green eyes, powerful shoulders and a long ringed tail.',
  baselineAbilities:['Bite','Scratch','Hunt','Stealth'],
} as const;

const sheets: Record<string,string> = {
  heroLow:'directions-low',heroHigh:'directions-high',
  heroSittingLow:'sitting-low',heroSittingHigh:'sitting-high',
  heroWalkingLow:'walking-low',heroWalkingHigh:'walking-high',
  heroFlinch:'flinch-atlas',heroDown:'down-atlas',
};
export const BANKS_SPRITE_ASSETS = Object.fromEntries(Object.entries(sheets).map(([key,sheet])=>[
  key.replace('hero','banks'),`runtime/characters/banks/rig/watercolor/v5/banks-${sheet}-watercolor-v5.png`,
]));

/** Banks uses the existing travel/combat registration and shared joint hierarchy.
 * Reskin complete painted bodies; do not assemble separately generated anatomy. */
function banksDefinition(template: DirectionalSpriteDefinition): DirectionalSpriteDefinition {
  const frame=(source:DirectionalFrame):DirectionalFrame=>({...source,
    source:source.source.replace('hero','banks'),
    parts:source.parts.map(part=>({...part})),
  });
  return {...template,id:template.id.replace('hero','banks'),overheadLengthScale:1,
    low:template.low.map(frame),high:template.high.map(frame),top:frame(template.top),
    lowOpposite:template.lowOpposite?.map(frame),highOpposite:template.highOpposite?.map(frame),
    animation:template.animation?{...template.animation,frames:template.animation.frames.map(banksDefinition)}:undefined,
  };
}
export const BANKS_DIRECTIONAL_SPRITE = banksDefinition(HERO_DIRECTIONAL_SPRITE);
// The standing atlas reserves more empty height around Banks's long horizontal
// body than the walking atlas. Compensate uniformly, keeping paws at ground zero;
// leave the independently registered overhead footprint unchanged.
for (const frame of [...BANKS_DIRECTIONAL_SPRITE.low, ...BANKS_DIRECTIONAL_SPRITE.high]) {
  frame.parts = frame.parts.map(part => ({...part,
    x:part.x*1.25, y:part.y*1.25, height:part.height*1.25,
  }));
}
export const BANKS_POSES = {
  sitting:banksDefinition(HERO_SITTING_DIRECTIONAL_SPRITE),
  walking:banksDefinition(HERO_WALKING_DIRECTIONAL_SPRITE),
  flinch:banksDefinition(HERO_COMBAT_POSES.flinch),
  down:banksDefinition(HERO_COMBAT_POSES.down),
};
