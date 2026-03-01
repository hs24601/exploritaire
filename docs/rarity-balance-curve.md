# Rarity Auto-Fill Balance Curve

This document describes the default value scaling used by card editor auto-fill (`AUTO-FILL CURVE`).

## Goals
1. Higher rarity should feel materially stronger.
2. Growth should be monotonic per rarity tier.
3. Control/non-damage effects should scale conservatively to avoid runaway combos.
4. Value growth should be capped to preserve room for rarity-specific extra effects.

## Base Multiplier by Rarity
- `common`: `1.0`
- `uncommon`: `1.5`
- `rare`: `2.1`
- `epic`: `2.9`
- `legendary`: `3.8`
- `mythic`: `4.8`

## Effect-Type Bias
- High-impact direct scaling (`damage`, `healing`) uses strong bias.
- Defensive/status/control categories use reduced bias.
- Example: `draw` and `stun` scale slower than `damage`.

## Cap Ratios
- Each effect type has a max growth ratio from common to prevent inflated high-tier numbers.
- Example caps:
  - `damage`: `4.8x`
  - `healing`: `4.2x`
  - `armor`: `3.7x`
  - `draw`: `2.2x`
  - `stun`: `2.0x`

## Expected Example (Damage 4 @ Common)
- `common`: `4`
- `uncommon`: `6`
- `rare`: `8`
- `epic`: `12`
- `legendary`: `15`
- `mythic`: `19`

Use this as a baseline, then add rarity-unique rows/effects to differentiate tiers without overloading raw power.
