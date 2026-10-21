/** Legacy flat portraits originate in the dedicated Exploritaire-art repository. */
export const ACTOR_HOLO_ART: Readonly<Record<string, string>> = {
  banks: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/actors/banks-card-v5.png`,
  hero: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/actors/hero-card-v2.png`,
  mochi: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/actors/mochi-card-watercolor-v1.png`,
};

/** Approved layered watercolor artwork, bundled separately from legacy art sync. */
export const ACTOR_HOLO_LAYERS: Readonly<Record<string, { background: string; subject: string }>> = {
  [ACTOR_HOLO_ART.banks]: {
    background: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`,
    subject: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/banks-watercolor-v5.png`,
  },
  [ACTOR_HOLO_ART.hero]: {
    background: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`,
    subject: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-watercolor-v5-ordinary-day.png`,
  },
};
