import type { CSSProperties } from 'react';

type District = {
  name: string;
  role: string;
  summary: string;
  status: 'online' | 'planned' | 'locked';
  reward: string;
};

type KinProfile = {
  name: string;
  title: string;
  verb: string;
  summary: string;
  district: string;
  mood: string;
  glow: string;
};

const districts: District[] = [
  {
    name: 'Rescue Burrows',
    role: 'Roster Growth',
    summary: 'Recovered creatures rest here, bond with the town, and become eligible for future run parties.',
    status: 'online',
    reward: 'Unlocks creature housing and rescue log progression.',
  },
  {
    name: 'Switchyard',
    role: 'Golf Tech',
    summary: 'Engineering district for route-bending kin. This is where lateral movement, charge storage, and stock-safe cheats get framed.',
    status: 'online',
    reward: 'Improves board-permission creatures like Jet and future route manipulators.',
  },
  {
    name: 'Glasshouse',
    role: 'Run Prep',
    summary: 'A calm prep lane for consumables, expedition meals, and biome-specific starting modifiers before a golf run.',
    status: 'planned',
    reward: 'Adds lightweight pre-run choices instead of a second combat game.',
  },
  {
    name: 'Sky Market',
    role: 'Town Economy',
    summary: 'Trades materials earned from golf clears into habitat upgrades, civic unlocks, and cosmetic warmth.',
    status: 'planned',
    reward: 'Turns score and rescues into visible city growth.',
  },
];

const kinProfiles: KinProfile[] = [
  {
    name: 'Jet',
    title: 'Route Electrician',
    verb: 'Rewire',
    summary: 'Moves tableau tops laterally, then leaves them Charged so future allied claims spike AP.',
    district: 'Switchyard',
    mood: 'Turns planning into stored tempo.',
    glow: 'rgba(108, 232, 255, 0.32)',
  },
  {
    name: 'Hero',
    title: 'Line Guardian',
    verb: 'Guard',
    summary: 'Absorbs pressure, taunts, and turns sacrifice into armor and wildcard stability.',
    district: 'Rescue Burrows',
    mood: 'Makes bad runs survivable without stealing focus from golf.',
    glow: 'rgba(240, 236, 205, 0.28)',
  },
  {
    name: 'Banks',
    title: 'Strike Chaser',
    verb: 'Swipe',
    summary: 'Exact AP breakpoints reward disciplined aggression and produce clean closeout pressure.',
    district: 'Sky Market',
    mood: 'Converts precise stops into momentum spikes.',
    glow: 'rgba(255, 175, 94, 0.28)',
  },
  {
    name: 'Mochi',
    title: 'Relay Sprinter',
    verb: 'Tap Out!',
    summary: 'Redistributes AP and keeps the party loop fluid when the board threatens to stall.',
    district: 'Glasshouse',
    mood: 'Smooths the run and protects pacing.',
    glow: 'rgba(193, 151, 255, 0.28)',
  },
];

const pillars = [
  {
    label: 'Priority 1',
    title: 'Golf First',
    body: 'Every creature power should feel like a permission or pressure inside golf solitaire, not a separate mini-game.',
  },
  {
    label: 'Priority 2',
    title: 'Creature Collection',
    body: 'Rescued kin should change how you read routes, recover mistakes, and value tableau states.',
  },
  {
    label: 'Priority 3',
    title: 'City Meta',
    body: 'Town growth should frame progression, show off the zoo, and feed new run options without replacing the board.',
  },
];

const rails = [
  {
    lane: 'Build Now',
    text: 'Golf runs, creature roster, rescue rewards, 3-5 town districts, and route-bending creature verbs.',
  },
  {
    lane: 'Later Maybe',
    text: 'Light expeditions, off-screen dungeon sorties, and menu-driven creature errands that return town resources.',
  },
  {
    lane: 'Do Not Lead With',
    text: 'A full autobattler with separate combat timing, dice grammar, AI balance, and dungeon roster simulation.',
  },
];

const statusTone: Record<District['status'], { label: string; style: CSSProperties }> = {
  online: {
    label: 'Online',
    style: {
      color: '#96ffd1',
      borderColor: 'rgba(150,255,209,0.35)',
      background: 'rgba(17,48,33,0.66)',
    },
  },
  planned: {
    label: 'Planned',
    style: {
      color: '#ffd98e',
      borderColor: 'rgba(255,217,142,0.3)',
      background: 'rgba(58,39,11,0.62)',
    },
  },
  locked: {
    label: 'Locked',
    style: {
      color: '#e2d7ff',
      borderColor: 'rgba(226,215,255,0.2)',
      background: 'rgba(31,23,52,0.6)',
    },
  },
};

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  color: '#f4efe4',
  background: [
    'radial-gradient(circle at top left, rgba(90, 55, 12, 0.16), transparent 28%)',
    'radial-gradient(circle at 82% 18%, rgba(60, 120, 112, 0.18), transparent 24%)',
    'linear-gradient(180deg, #0b0a09 0%, #12110f 38%, #171613 100%)',
  ].join(','),
  fontFamily: '"Sora", sans-serif',
};

const panelStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(18,16,14,0.94), rgba(12,11,9,0.9))',
  boxShadow: '0 20px 60px rgba(0,0,0,0.32)',
  backdropFilter: 'blur(12px)',
};

export const CityHub = () => (
  <div style={shellStyle}>
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-70"
      style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.1))',
      }}
    />

    <main className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-4 pb-10 pt-5 md:px-6 md:pb-14 md:pt-7">
      <section
        className="overflow-hidden rounded-[30px] border px-5 py-5 md:px-8 md:py-8"
        style={{
          ...panelStyle,
          borderColor: 'rgba(245, 216, 145, 0.16)',
          background: [
            'radial-gradient(circle at 14% 22%, rgba(166, 125, 42, 0.17), transparent 28%)',
            'radial-gradient(circle at 86% 24%, rgba(105, 183, 170, 0.16), transparent 24%)',
            'linear-gradient(135deg, rgba(24,19,15,0.98), rgba(17,16,13,0.94))',
          ].join(','),
        }}
      >
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1.25fr_0.9fr] lg:items-end">
          <div className="max-w-[760px]">
            <div
              className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.32em]"
              style={{
                fontFamily: '"IBM Plex Sans Condensed", sans-serif',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#b8d3cb',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              City Vertical Slice
            </div>
            <h1
              className="mt-4 text-[38px] font-black uppercase leading-[0.95] tracking-[0.04em] md:text-[72px]"
              style={{
                fontFamily: '"IBM Plex Sans Condensed", sans-serif',
                textShadow: '0 10px 34px rgba(0,0,0,0.34)',
              }}
            >
              Build The Town
              <br />
              That Feeds Golf
            </h1>
            <p className="mt-5 max-w-[58ch] text-sm leading-7 text-[#d7d1c5] md:text-[15px]">
              Exploritaire works best when golf stays central. The city is here to frame rescues, house the zoo, and unlock new
              route-bending creature verbs without drifting into a second main game.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="/golf.html"
                className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #f0d07b, #d98d39)',
                  color: '#1b1208',
                  boxShadow: '0 16px 30px rgba(217,141,57,0.24)',
                }}
              >
                Launch Golf Run
              </a>
              <a
                href="/world.html"
                className="inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition-colors hover:bg-white/10"
                style={{
                  borderColor: 'rgba(255,255,255,0.14)',
                  color: '#efe8da',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                Visit World Slice
              </a>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-[24px] border px-4 py-4"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(8,8,8,0.38)',
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#d1aa68]">{pillar.label}</div>
                <div
                  className="mt-2 text-[22px] font-black uppercase leading-none"
                  style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
                >
                  {pillar.title}
                </div>
                <p className="mt-3 text-sm leading-6 text-[#cfc8ba]">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#8ed8c5]">District Plan</div>
              <h2
                className="mt-2 text-[32px] font-black uppercase leading-none"
                style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
              >
                Cozy Meta, Not Scope Trap
              </h2>
            </div>
            <div className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#f4cf8e]" style={{ borderColor: 'rgba(244,207,142,0.2)' }}>
              4 Districts
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {districts.map((district) => {
              const tone = statusTone[district.status];
              return (
                <article
                  key={district.name}
                  className="rounded-[22px] border p-4"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.26em] text-[#8fb3aa]">{district.role}</div>
                      <h3
                        className="mt-2 text-[24px] font-black uppercase leading-none"
                        style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
                      >
                        {district.name}
                      </h3>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em]" style={tone.style}>
                      {tone.label}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#d4cdbf]">{district.summary}</p>
                  <div className="mt-4 rounded-[16px] border px-3 py-3 text-sm leading-6 text-[#f3e5b5]" style={{ borderColor: 'rgba(243,229,181,0.12)', background: 'rgba(62,47,19,0.18)' }}>
                    {district.reward}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#8ed8c5]">Prudent Rail</div>
          <h2
            className="mt-2 text-[32px] font-black uppercase leading-none"
            style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
          >
            What To Build
          </h2>
          <div className="mt-5 space-y-4">
            {rails.map((rail) => (
              <div
                key={rail.lane}
                className="rounded-[20px] border px-4 py-4"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#d8ae6d]">{rail.lane}</div>
                <p className="mt-2 text-sm leading-6 text-[#d3cbbe]">{rail.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[22px] border p-4" style={{ borderColor: 'rgba(104, 228, 216, 0.16)', background: 'linear-gradient(180deg, rgba(10,20,20,0.8), rgba(8,12,12,0.74))' }}>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#8ed8c5]">Core Loop</div>
            <div
              className="mt-3 text-[24px] font-black uppercase leading-none"
              style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
            >
              Run, Rescue, Return, Rebuild
            </div>
            <p className="mt-3 text-sm leading-6 text-[#d4cdbf]">
              Each successful golf run should return creatures, materials, or civic unlocks. The city then feeds back into future
              runs through new habitats, roster slots, and route-changing creature permissions.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#8ed8c5]">Founding Roster</div>
              <h2
                className="mt-2 text-[32px] font-black uppercase leading-none"
                style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
              >
                Creatures As Golf Verbs
              </h2>
            </div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#b6ab98]">Not Stat Sticks</div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {kinProfiles.map((kin) => (
              <article
                key={kin.name}
                className="relative overflow-hidden rounded-[24px] border p-4"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-24"
                  style={{
                    background: `radial-gradient(circle at 20% 20%, ${kin.glow}, transparent 55%)`,
                  }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#9fbeb4]">{kin.title}</div>
                      <h3
                        className="mt-2 text-[28px] font-black uppercase leading-none"
                        style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
                      >
                        {kin.name}
                      </h3>
                    </div>
                    <div className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#f1cf8b]" style={{ borderColor: 'rgba(241,207,139,0.18)', background: 'rgba(55,38,11,0.36)' }}>
                      {kin.verb}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#d4cdbf]">{kin.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#87d0c1]" style={{ borderColor: 'rgba(135,208,193,0.18)' }}>
                      {kin.district}
                    </span>
                    <span className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#d8d0c6]" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      {kin.mood}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#8ed8c5]">Run Board Thesis</div>
          <h2
            className="mt-2 text-[32px] font-black uppercase leading-none"
            style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
          >
            One Game, Four Loops
          </h2>

          <div className="mt-5 space-y-3">
            {[
              'Run Loop: play golf, use creature permissions, rescue kin, earn materials.',
              'Roster Loop: choose a compact party that changes how the tableau is solved.',
              'Town Loop: spend rewards on habitats, prep buildings, and civic upgrades.',
              'Collection Loop: every rescued creature unlocks a new style of route manipulation.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[18px] border px-4 py-3 text-sm leading-6 text-[#d5cfc4]"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[22px] border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#d8ae6d]">Vertical Slice Goal</div>
            <p className="mt-3 text-sm leading-6 text-[#d4cdbf]">
              Ship one coherent path: enter town, inspect rescued kin, choose a party, launch a golf run, and return with visible
              city growth. That is enough to prove the entire product direction.
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>
);
