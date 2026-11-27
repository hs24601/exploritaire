/** Legacy flat portraits originate in the dedicated Exploritaire-art repository. */
export const ACTOR_HOLO_ART: Readonly<Record<string, string>> = {
  banks: `${import.meta.env.BASE_URL}assets/runtime/kin/banks/portraits/anatomical-claw-pounce/banks-card-v9.png`,
  hero: `${import.meta.env.BASE_URL}assets/runtime/kin/hero/portraits/flat-watercolor/hero-card-v2.png`,
  mochi: `${import.meta.env.BASE_URL}assets/runtime/kin/mochi/portraits/flat-watercolor/mochi-card-watercolor-v1.png`,
};

/** Approved layered watercolor artwork, bundled separately from legacy art sync. */
export const ACTOR_HOLO_LAYERS: Readonly<Record<string, { background: string; subject: string }>> = {
  [ACTOR_HOLO_ART.mochi]: {
    background: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`,
    subject: `${import.meta.env.BASE_URL}assets/runtime/kin/mochi/portraits/light-wash/mochi-watercolor-v3-light-washes.png`,
  },
  [ACTOR_HOLO_ART.banks]: {
    background: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`,
    subject: `${import.meta.env.BASE_URL}assets/runtime/kin/banks/portraits/anatomical-claw-pounce/banks-watercolor-v9.png`,
  },
  [ACTOR_HOLO_ART.hero]: {
    background: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`,
    subject: `${import.meta.env.BASE_URL}assets/runtime/kin/hero/portraits/organic-bobtail/hero-watercolor-v6-organic-bobtail.png`,
  },
};
