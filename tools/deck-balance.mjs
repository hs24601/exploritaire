#!/usr/bin/env node

/**
 * Deck balance simulator for CombatGolf tuning.
 *
 * Usage:
 *   npm run balance:deck
 *   node tools/deck-balance.mjs --samples 2000 --profile starter_v0 --foundation actor_party
 */

const DEFAULTS = {
  samples: 400,
  tableauCount: 7,
  tableauDepth: 4,
  profile: 'starter_v0',
  foundation: 'wild_single', // wild_single | actor_single | actor_party
  maxReportedRegroups: 4,
  supplyToRest: 2,
  beamWidth: 96,
  search: '',
  target: 0.6,
  targetStarter: 0.6,
  targetMid: 0.7,
  gateWindow: 0.03,
  top: 10,
  includeResourceScenarios: false,
  wildEveryN: 7,
  tableauSource: 'environment', // environment | player | hybrid
  playerSeedRatio: 0.35,
  environmentTheme: 'volcanic', // volcanic | wetlands | neutral
  abilityCharges: 0,
  abilityAp: 0,
  abilityApCost: 2,
};

const FOUNDATION_PRESETS = {
  wild_single: [0],
  actor_single: [2],
  actor_party: [2, 3],
  actor_triple: [2, 3, 4],
};

const PROFILES = {
  starter_v0: {
    id: 'starter_v0',
    deck: [
      { elements: ['A', 'E', 'W', 'F', 'D', 'L'], ranks: [3, 4, 5, 6, 7], copies: 1 },
    ],
  },
  starter_wide: {
    id: 'starter_wide',
    deck: [
      { elements: ['A', 'E', 'W', 'F', 'D', 'L'], ranks: [2, 3, 4, 5, 6, 7, 8], copies: 1 },
    ],
  },
  mid_v0: {
    id: 'mid_v0',
    deck: [
      { elements: ['A', 'E', 'W', 'F', 'D', 'L'], ranks: [3, 4, 5, 6, 7], copies: 1 },
      { elements: ['A', 'W', 'F'], ranks: [2, 8], copies: 1 },
      { elements: ['L', 'D'], ranks: [5, 6], copies: 1 },
    ],
  },
};

function parseArgs(argv) {
  const parsed = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    i += 1;
    if (key === 'samples') parsed.samples = Math.max(10, Number(value) || DEFAULTS.samples);
    if (key === 'tableau-count') parsed.tableauCount = Math.max(1, Number(value) || DEFAULTS.tableauCount);
    if (key === 'tableau-depth') parsed.tableauDepth = Math.max(1, Number(value) || DEFAULTS.tableauDepth);
    if (key === 'profile') parsed.profile = value;
    if (key === 'foundation') parsed.foundation = value;
    if (key === 'max-regroups') parsed.maxReportedRegroups = Math.max(0, Number(value) || DEFAULTS.maxReportedRegroups);
    if (key === 'supply-to-rest') parsed.supplyToRest = Math.max(1, Number(value) || DEFAULTS.supplyToRest);
    if (key === 'beam-width') parsed.beamWidth = Math.max(8, Number(value) || DEFAULTS.beamWidth);
    if (key === 'search') parsed.search = value;
    if (key === 'target') parsed.target = Math.max(0, Math.min(1, Number(value) || DEFAULTS.target));
    if (key === 'target-starter') parsed.targetStarter = Math.max(0, Math.min(1, Number(value) || DEFAULTS.targetStarter));
    if (key === 'target-mid') parsed.targetMid = Math.max(0, Math.min(1, Number(value) || DEFAULTS.targetMid));
    if (key === 'gate-window') parsed.gateWindow = Math.max(0, Math.min(0.5, Number(value) || DEFAULTS.gateWindow));
    if (key === 'top') parsed.top = Math.max(1, Number(value) || DEFAULTS.top);
    if (key === 'include-resource-scenarios') parsed.includeResourceScenarios = value === 'true';
    if (key === 'wild-every-n') parsed.wildEveryN = Math.max(1, Number(value) || DEFAULTS.wildEveryN);
    if (key === 'tableau-source') parsed.tableauSource = value;
    if (key === 'player-seed-ratio') parsed.playerSeedRatio = Math.max(0, Math.min(1, Number(value) || DEFAULTS.playerSeedRatio));
    if (key === 'environment-theme') parsed.environmentTheme = value;
    if (key === 'ability-charges') parsed.abilityCharges = Math.max(0, Number(value) || DEFAULTS.abilityCharges);
    if (key === 'ability-ap') parsed.abilityAp = Math.max(0, Number(value) || DEFAULTS.abilityAp);
    if (key === 'ability-ap-cost') parsed.abilityApCost = Math.max(1, Number(value) || DEFAULTS.abilityApCost);
  }
  return parsed;
}

function buildDeckFromProfile(profile) {
  const cards = [];
  let id = 0;
  for (const group of profile.deck) {
    for (const element of group.elements) {
      for (const rank of group.ranks) {
        const copies = group.copies ?? 1;
        for (let copy = 0; copy < copies; copy += 1) {
          cards.push({ id: `${profile.id}-${id++}`, rank, element });
        }
      }
    }
  }
  return cards;
}

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildEnvironmentDeck(theme = 'neutral') {
  const cards = [];
  let id = 0;
  const elemental = ['A', 'E', 'W', 'F', 'D', 'L'];
  const weightsByTheme = {
    neutral: { A: 1, E: 1, W: 1, F: 1, D: 1, L: 1, N: 0.4 },
    volcanic: { A: 0.7, E: 1.5, W: 0.4, F: 1.7, D: 1.1, L: 0.8, N: 0.3 },
    wetlands: { A: 0.8, E: 0.9, W: 1.8, F: 0.5, D: 0.8, L: 1.2, N: 0.4 },
  };
  const weights = weightsByTheme[theme] ?? weightsByTheme.neutral;

  for (const element of elemental) {
    for (let rank = 1; rank <= 13; rank += 1) {
      const copies = Math.max(1, Math.round(weights[element] * 2));
      for (let copy = 0; copy < copies; copy += 1) {
        cards.push({ id: `env-${theme}-${id++}`, rank, element });
      }
    }
  }
  for (let rank = 1; rank <= 13; rank += 1) {
    const neutralCopies = Math.max(0, Math.round((weights.N ?? 0.3) * 2));
    for (let copy = 0; copy < neutralCopies; copy += 1) {
      cards.push({ id: `env-${theme}-n-${id++}`, rank, element: 'N' });
    }
  }
  return cards;
}

function drawRandomCard(pool, fallbackPool) {
  const source = pool.length > 0 ? pool : fallbackPool;
  if (source.length === 0) throw new Error('Cannot draw card from empty pools');
  const idx = Math.floor(Math.random() * source.length);
  return source[idx];
}

function dealTableaus({
  playerDeck,
  environmentDeck,
  tableauCount,
  depth,
  tableauSource,
  playerSeedRatio,
}) {
  const playerShuffled = shuffle(playerDeck);
  const environmentShuffled = shuffle(environmentDeck);
  const tableaus = Array.from({ length: tableauCount }, () => []);
  const drawFromPlayer = () => playerShuffled.pop() ?? drawRandomCard(playerDeck, environmentDeck);
  const drawFromEnvironment = () => environmentShuffled.pop() ?? drawRandomCard(environmentDeck, playerDeck);

  for (let row = 0; row < depth; row += 1) {
    for (let t = 0; t < tableauCount; t += 1) {
      let card;
      if (tableauSource === 'player') {
        card = drawFromPlayer();
      } else if (tableauSource === 'hybrid') {
        card = Math.random() < playerSeedRatio ? drawFromPlayer() : drawFromEnvironment();
      } else {
        card = drawFromEnvironment();
      }
      tableaus[t].push(card);
    }
  }
  return tableaus;
}

function isSequential(rankA, rankB) {
  const diff = Math.abs(rankA - rankB);
  return diff === 1 || diff === 12;
}

function canPlay(cardRank, foundationTopRank) {
  if (foundationTopRank === 0) return true;
  return isSequential(cardRank, foundationTopRank);
}

function keyForState(lengths, tops, wildCharges, abilityCharges, abilityAp) {
  return `${lengths.join(',')}|${tops.join(',')}|w${wildCharges}|a${abilityCharges}|p${abilityAp}`;
}

function scoreState(state, tableaus) {
  let playableNow = 0;
  for (let t = 0; t < state.lengths.length; t += 1) {
    const len = state.lengths[t];
    if (len <= 0) continue;
    const card = tableaus[t][len - 1];
    if (!card) continue;
    if (state.tops.some((top) => canPlay(card.rank, top))) playableNow += 1;
  }
  // Weighted for breadth + depth.
  return (state.moves * 100) + (playableNow * 3) + state.wildCharges + state.abilityCharges;
}

// Fast approximation of high-skill play. Exact DFS is too slow for tuning loops.
function solveMaxSequence(tableaus, foundationRanks, beamWidth, wildEveryN, abilityCharges, abilityAp, abilityApCost) {
  const totalCards = tableaus.reduce((sum, t) => sum + t.length, 0);
  const initial = {
    lengths: tableaus.map((t) => t.length),
    tops: [...foundationRanks],
    moves: 0,
    wildCharges: 0,
    abilityCharges,
    abilityAp,
  };

  let best = 0;
  let frontier = [initial];
  const seen = new Map([[keyForState(initial.lengths, initial.tops, initial.wildCharges, initial.abilityCharges, initial.abilityAp), 0]]);

  while (frontier.length > 0) {
    const nextByKey = new Map();

    for (const state of frontier) {
      if (state.moves > best) best = state.moves;
      if (best >= totalCards) return totalCards;

      for (let t = 0; t < state.lengths.length; t += 1) {
        const len = state.lengths[t];
        if (len <= 0) continue;
        const card = tableaus[t][len - 1];
        if (!card) continue;

        for (let f = 0; f < state.tops.length; f += 1) {
          for (const mode of ['normal', 'wild', 'ability']) {
            const legal = canPlay(card.rank, state.tops[f]);
            if (mode === 'normal' && !legal) continue;
            if (mode === 'wild' && (legal || state.wildCharges <= 0)) continue;
            if (mode === 'ability' && (legal || state.abilityCharges <= 0 || state.abilityAp < abilityApCost)) continue;

            const nextLengths = [...state.lengths];
            const nextTops = [...state.tops];
            nextLengths[t] -= 1;
            nextTops[f] = card.rank;
            const nextMoves = state.moves + 1;
            let nextWildCharges = state.wildCharges - (mode === 'wild' ? 1 : 0);
            let nextAbilityCharges = state.abilityCharges - (mode === 'ability' ? 1 : 0);
            let nextAbilityAp = state.abilityAp - (mode === 'ability' ? abilityApCost : 0);
            if (nextMoves % wildEveryN === 0) {
              nextWildCharges += 1;
            }
            const k = keyForState(nextLengths, nextTops, nextWildCharges, nextAbilityCharges, nextAbilityAp);

            const seenMoves = seen.get(k);
            if (seenMoves !== undefined && seenMoves >= nextMoves) continue;
            seen.set(k, nextMoves);

            const existing = nextByKey.get(k);
            if (!existing || existing.moves < nextMoves) {
              nextByKey.set(k, {
                lengths: nextLengths,
                tops: nextTops,
                moves: nextMoves,
                wildCharges: nextWildCharges,
                abilityCharges: nextAbilityCharges,
                abilityAp: nextAbilityAp,
              });
            }
          }
        }
      }
    }

    const nextStates = Array.from(nextByKey.values());
    nextStates.sort((a, b) => scoreState(b, tableaus) - scoreState(a, tableaus));
    frontier = nextStates.slice(0, beamWidth);
  }

  return best;
}

function simulateScenario({
  playerDeck,
  environmentDeck,
  tableauSource,
  playerSeedRatio,
  tableauCount,
  tableauDepth,
  foundationRanks,
  samples,
  regroupBudget,
  beamWidth,
  wildEveryN,
  abilityCharges,
  abilityAp,
  abilityApCost,
}) {
  let fullClears = 0;
  let totalBestMoves = 0;
  const totalCards = tableauCount * tableauDepth;

  for (let sample = 0; sample < samples; sample += 1) {
    let attemptsLeft = Math.max(0, regroupBudget) + 1;
    let bestThisSample = 0;
    let cleared = false;

    while (attemptsLeft > 0) {
      const tableaus = dealTableaus({
        playerDeck,
        environmentDeck,
        tableauCount,
        depth: tableauDepth,
        tableauSource,
        playerSeedRatio,
      });
      const bestMoves = solveMaxSequence(
        tableaus,
        foundationRanks,
        beamWidth,
        wildEveryN,
        abilityCharges,
        abilityAp,
        abilityApCost
      );
      if (bestMoves > bestThisSample) bestThisSample = bestMoves;
      if (bestMoves >= totalCards) {
        cleared = true;
        break;
      }
      attemptsLeft -= 1;
    }

    totalBestMoves += bestThisSample;
    if (cleared) fullClears += 1;
  }

  return {
    clearRate: fullClears / samples,
    avgBestMoves: totalBestMoves / samples,
    avgBestMoveRatio: totalBestMoves / (samples * totalCards),
    totalCards,
  };
}

function percent(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function runProfile(profileId, options) {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);
  const playerDeck = buildDeckFromProfile(profile);
  const environmentDeck = buildEnvironmentDeck(options.environmentTheme);
  const foundationRanks = FOUNDATION_PRESETS[options.foundation];
  if (!foundationRanks) throw new Error(`Unknown foundation preset: ${options.foundation}`);

  const budgets = options.includeResourceScenarios
    ? Array.from({ length: options.maxReportedRegroups + 1 }, (_, i) => i)
    : [0];
  const supplyScenarios = options.includeResourceScenarios ? [0, 1, 2] : [0];

  const rows = [];
  for (const regroup of budgets) {
    for (const supplies of supplyScenarios) {
      const effectiveRegroups = regroup + (supplies * options.supplyToRest);
      const result = simulateScenario({
        playerDeck,
        environmentDeck,
        tableauSource: options.tableauSource,
        playerSeedRatio: options.playerSeedRatio,
        tableauCount: options.tableauCount,
        tableauDepth: options.tableauDepth,
        foundationRanks,
        samples: options.samples,
        regroupBudget: effectiveRegroups,
        beamWidth: options.beamWidth,
        wildEveryN: options.wildEveryN,
        abilityCharges: options.abilityCharges,
        abilityAp: options.abilityAp,
        abilityApCost: options.abilityApCost,
      });
      rows.push({
        profile: profileId,
        regroup,
        supplies,
        effectiveRegroups,
        clearRate: result.clearRate,
        avgBestMoves: result.avgBestMoves,
        avgBestMoveRatio: result.avgBestMoveRatio,
        totalCards: result.totalCards,
      });
    }
  }

  return {
    profile: profileId,
    deckSize: playerDeck.length,
    foundationPreset: options.foundation,
    foundationRanks,
    rows,
  };
}

function printReport(report, options) {
  console.log('Deck Balance Monte Carlo');
  console.log(`Profile: ${report.profile} | Deck size: ${report.deckSize}`);
  console.log(`Foundations: ${report.foundationPreset} [${report.foundationRanks.join(', ')}]`);
  console.log(`Tableau: ${options.tableauCount}x${options.tableauDepth} | Samples: ${options.samples}`);
  if (options.includeResourceScenarios) {
    console.log(`Supply conversion: 1 supply => +${options.supplyToRest} short-rest charges`);
  } else {
    console.log('Resource scenarios: OFF (baseline-only tuning)');
  }
  console.log(`Tableau source: ${options.tableauSource} | Player seed ratio: ${options.playerSeedRatio.toFixed(2)} | Environment theme: ${options.environmentTheme}`);
  console.log(`Solver: beam search (width=${options.beamWidth})`);
  console.log(`Wild cadence: +1 wild-hand charge every ${options.wildEveryN} plays`);
  console.log(`Ability budget: charges=${options.abilityCharges}, AP=${options.abilityAp}, AP cost=${options.abilityApCost}`);
  console.log('');
  console.log('regroup | supplies | effective regroup | clear% | avg best cards | avg best%');
  for (const row of report.rows) {
    console.log(
      `${String(row.regroup).padStart(7)} | ${String(row.supplies).padStart(8)} | ${String(row.effectiveRegroups).padStart(16)} | ${percent(row.clearRate).padStart(6)} | ${row.avgBestMoves.toFixed(2).padStart(14)} | ${percent(row.avgBestMoveRatio).padStart(9)}`
    );
  }
}

function createSearchProfile(rangeMin, rangeMax, copies, includeNeutral) {
  const elements = includeNeutral
    ? ['A', 'E', 'W', 'F', 'D', 'L', 'N']
    : ['A', 'E', 'W', 'F', 'D', 'L'];
  const ranks = [];
  for (let rank = rangeMin; rank <= rangeMax; rank += 1) {
    ranks.push(rank);
  }
  return {
    id: `search_r${rangeMin}-${rangeMax}_c${copies}_${includeNeutral ? 'n1' : 'n0'}`,
    deck: [{ elements, ranks, copies }],
  };
}

function generateStarterSearchProfiles() {
  const profiles = [];
  for (let minRank = 1; minRank <= 9; minRank += 1) {
    for (let maxRank = minRank + 3; maxRank <= Math.min(13, minRank + 7); maxRank += 1) {
      for (const copies of [1, 2]) {
        for (const includeNeutral of [false, true]) {
          profiles.push(createSearchProfile(minRank, maxRank, copies, includeNeutral));
        }
      }
    }
  }
  return profiles;
}

function createMidPackageProfile(packageId, elements, ranks, copies = 1) {
  return {
    id: packageId,
    deck: [{ elements, ranks, copies }],
  };
}

function generateMidPackageProfiles() {
  const packages = [];
  const elementalOnly = ['A', 'E', 'W', 'F', 'D', 'L'];
  const focuses = [
    ['A', 'W', 'F'],
    ['E', 'D', 'L'],
    elementalOnly,
  ];
  const rankBands = [
    [2, 8],
    [1, 2, 8, 9],
    [2, 3, 8, 9],
    [3, 8, 9, 10],
  ];
  let id = 0;
  for (const focus of focuses) {
    for (const ranks of rankBands) {
      for (const copies of [1, 2]) {
        packages.push(createMidPackageProfile(`mid_pkg_${id++}`, focus, ranks, copies));
      }
    }
  }
  return packages;
}

function mergeProfiles(baseProfile, addProfile) {
  return {
    id: `${baseProfile.id}__${addProfile.id}`,
    deck: [...baseProfile.deck, ...addProfile.deck],
  };
}

function runStarterSearch(options) {
  const profiles = generateStarterSearchProfiles();
  const environmentDeck = buildEnvironmentDeck(options.environmentTheme);
  const foundationRanks = FOUNDATION_PRESETS[options.foundation];
  if (!foundationRanks) throw new Error(`Unknown foundation preset: ${options.foundation}`);
  const requiredCards = options.tableauCount * options.tableauDepth;

  const results = [];
  for (const profile of profiles) {
    const deck = buildDeckFromProfile(profile);
    if (deck.length < requiredCards) continue;
    const baseline = simulateScenario({
      playerDeck: deck,
      environmentDeck,
      tableauSource: options.tableauSource,
      playerSeedRatio: options.playerSeedRatio,
      tableauCount: options.tableauCount,
      tableauDepth: options.tableauDepth,
      foundationRanks,
      samples: options.samples,
      regroupBudget: 0,
      beamWidth: options.beamWidth,
      wildEveryN: options.wildEveryN,
      abilityCharges: options.abilityCharges,
      abilityAp: options.abilityAp,
      abilityApCost: options.abilityApCost,
    });
    const score = Math.abs(baseline.clearRate - options.target);
    results.push({
      profileId: profile.id,
      deckSize: deck.length,
      clearRate: baseline.clearRate,
      avgBestMoves: baseline.avgBestMoves,
      avgBestMoveRatio: baseline.avgBestMoveRatio,
      score,
    });
  }

  results.sort((a, b) => a.score - b.score);
  const top = results.slice(0, options.top);

  console.log('Starter Deck Search');
  console.log(`Target clear rate: ${percent(options.target)} (regroup=0, supplies=0)`);
  console.log(`Foundations: ${options.foundation} [${foundationRanks.join(', ')}]`);
  console.log(`Tableau: ${options.tableauCount}x${options.tableauDepth} | Samples: ${options.samples}`);
  console.log(`Tableau source: ${options.tableauSource} | Player seed ratio: ${options.playerSeedRatio.toFixed(2)} | Environment theme: ${options.environmentTheme}`);
  console.log(`Solver: beam search (width=${options.beamWidth})`);
  console.log(`Wild cadence: +1 wild-hand charge every ${options.wildEveryN} plays`);
  console.log(`Ability budget: charges=${options.abilityCharges}, AP=${options.abilityAp}, AP cost=${options.abilityApCost}`);
  console.log('');
  console.log('rank | profile | deck | clear% | avg best cards | avg best% | delta');
  top.forEach((entry, index) => {
    const delta = entry.clearRate - options.target;
    const deltaLabel = `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
    console.log(
      `${String(index + 1).padStart(4)} | ${entry.profileId.padEnd(24)} | ${String(entry.deckSize).padStart(4)} | ${percent(entry.clearRate).padStart(6)} | ${entry.avgBestMoves.toFixed(2).padStart(14)} | ${percent(entry.avgBestMoveRatio).padStart(9)} | ${deltaLabel.padStart(7)}`
    );
  });
}

function runDualTargetSearch(options) {
  const starterProfiles = generateStarterSearchProfiles();
  const midPackages = generateMidPackageProfiles();
  const environmentDeck = buildEnvironmentDeck(options.environmentTheme);
  const foundationRanks = FOUNDATION_PRESETS[options.foundation];
  if (!foundationRanks) throw new Error(`Unknown foundation preset: ${options.foundation}`);
  const requiredCards = options.tableauCount * options.tableauDepth;
  const starterEvalCache = new Map();

  const candidates = [];

  for (const starter of starterProfiles) {
    const starterDeck = buildDeckFromProfile(starter);
    if (starterDeck.length < requiredCards) continue;
    const starterBaseline = simulateScenario({
      playerDeck: starterDeck,
      environmentDeck,
      tableauSource: options.tableauSource,
      playerSeedRatio: options.playerSeedRatio,
      tableauCount: options.tableauCount,
      tableauDepth: options.tableauDepth,
      foundationRanks,
      samples: options.samples,
      regroupBudget: 0,
      beamWidth: options.beamWidth,
      wildEveryN: options.wildEveryN,
      abilityCharges: options.abilityCharges,
      abilityAp: options.abilityAp,
      abilityApCost: options.abilityApCost,
    });
    starterEvalCache.set(starter.id, starterBaseline);

    for (const pkg of midPackages) {
      const midProfile = mergeProfiles(starter, pkg);
      const midDeck = buildDeckFromProfile(midProfile);
      if (midDeck.length < requiredCards) continue;
      const midBaseline = simulateScenario({
        playerDeck: midDeck,
        environmentDeck,
        tableauSource: options.tableauSource,
        playerSeedRatio: options.playerSeedRatio,
        tableauCount: options.tableauCount,
        tableauDepth: options.tableauDepth,
        foundationRanks,
        samples: options.samples,
        regroupBudget: 0,
        beamWidth: options.beamWidth,
        wildEveryN: options.wildEveryN,
        abilityCharges: options.abilityCharges,
        abilityAp: options.abilityAp,
        abilityApCost: options.abilityApCost,
      });

      const starterDelta = Math.abs(starterBaseline.clearRate - options.targetStarter);
      const midDelta = Math.abs(midBaseline.clearRate - options.targetMid);
      const score = (starterDelta * 1.1) + (midDelta * 1.0);
      const passesStarter = starterDelta <= options.gateWindow;
      const passesMid = midDelta <= options.gateWindow;

      candidates.push({
        starterId: starter.id,
        packageId: pkg.id,
        starterDeckSize: starterDeck.length,
        midDeckSize: midDeck.length,
        starterClear: starterBaseline.clearRate,
        midClear: midBaseline.clearRate,
        starterDelta,
        midDelta,
        score,
        passes: passesStarter && passesMid,
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  const top = candidates.slice(0, options.top);
  const passCount = candidates.filter((entry) => entry.passes).length;

  console.log('Dual Target Search');
  console.log(`Targets: starter ${percent(options.targetStarter)}, mid ${percent(options.targetMid)} at regroup=0,supplies=0`);
  console.log(`Gate window: +/-${(options.gateWindow * 100).toFixed(1)}%`);
  console.log(`Foundations: ${options.foundation} [${foundationRanks.join(', ')}]`);
  console.log(`Tableau: ${options.tableauCount}x${options.tableauDepth} | Samples: ${options.samples}`);
  console.log(`Tableau source: ${options.tableauSource} | Player seed ratio: ${options.playerSeedRatio.toFixed(2)} | Environment theme: ${options.environmentTheme}`);
  console.log(`Solver: beam search (width=${options.beamWidth})`);
  console.log(`Wild cadence: +1 wild-hand charge every ${options.wildEveryN} plays`);
  console.log(`Ability budget: charges=${options.abilityCharges}, AP=${options.abilityAp}, AP cost=${options.abilityApCost}`);
  console.log(`Total pair candidates: ${candidates.length} | Gate passes: ${passCount}`);
  console.log('');
  console.log('rank | starter | package | sDeck | mDeck | starter% | mid% | sDelta | mDelta | pass');
  top.forEach((entry, index) => {
    console.log(
      `${String(index + 1).padStart(4)} | ${entry.starterId.padEnd(20)} | ${entry.packageId.padEnd(11)} | ${String(entry.starterDeckSize).padStart(5)} | ${String(entry.midDeckSize).padStart(5)} | ${percent(entry.starterClear).padStart(8)} | ${percent(entry.midClear).padStart(6)} | ${(entry.starterDelta * 100).toFixed(1).padStart(6)}% | ${(entry.midDelta * 100).toFixed(1).padStart(6)}% | ${entry.passes ? 'PASS' : 'FAIL'}`
    );
  });
}

function main() {
  const options = parseArgs(process.argv);
  if (options.search === 'starter') {
    runStarterSearch(options);
    return;
  }
  if (options.search === 'dual') {
    runDualTargetSearch(options);
    return;
  }
  const report = runProfile(options.profile, options);
  printReport(report, options);
  console.log('');
  console.log('Targets: starter ~60% @ regroup=0,supplies=0 and mid ~70% @ regroup=0,supplies=0');
}

main();
