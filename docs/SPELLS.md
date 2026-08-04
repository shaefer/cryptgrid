# SPELLS.md — The Rune Tongue

Spellcasting in the Dungeon Master tradition: spells are **sequences of runes** selected from tiered banks. The *grammar* mechanic is genre heritage; every rune name, glyph, and word of lore below is original to Cryptgrid. **Never** use Dungeon Master's or Grimrock's rune names, symbols, or spell text.

## Grammar

A spell is: **POTENCY + ESSENCE [+ FORM] [+ ASPECT]**, spoken in that order.

- **Potency** (required, 1 of 6): how much power is committed. Scales effect magnitude *and* mana cost of every subsequent rune in the spell.
- **Essence** (required, 1 of 6): the element/nature of the magic.
- **Form** (optional, 1 of 6): the shape the magic takes. Omitted → the essence's default expression (e.g., bare `Lume` = light around the caster).
- **Aspect** (optional, 1 of 6): a modifier — targeting, duration, subtlety.

### The runes

| Tier | Runes (ascending) |
|---|---|
| **Potency** | `Eth` (ember) · `Kor` (spark) · `Vas` (surge) · `Dur` (storm) · `Mal` (cataclysm) · `Zeth` (world-word) |
| **Essence** | `Lume` (light) · `Ign` (fire) · `Krys` (frost) · `Vol` (storm/air) · `Vit` (life) · `Umbra` (shadow) |
| **Form** | `Dart` (bolt/missile) · `Orbis` (orb, bursts on impact) · `Vela` (veil/barrier on party) · `Sig` (sigil, touches tile ahead) · `Nim` (cloud filling a tile) · `Korpa` (imbue held item) |
| **Aspect** | `Sel` (self only) · `Omn` (whole party) · `Fara` (extended range) · `Lent` (extended duration) · `Sub` (subtle/quiet) · `Vera` (true/reveal) |

Glyphs: 24 simple angular SVG marks, generated ourselves (see ASSETS.md). Design language: single-stroke chisel cuts, like something scratched into stone.

## Casting flow (authentic DM feel)

1. Player clicks runes on the HUD rune panel (or keys `1–6`; the panel auto-advances Potency → Essence → Form → Aspect, `Backspace` removes last rune, `Esc` clears).
2. **Mana is deducted the moment each rune is pressed** (cost = rune base × potency multiplier). Not enough mana → rune won't light; the character grunts. This pay-as-you-compose tension is core DM DNA — keep it.
3. `Enter` (or clicking the glowing sequence) **invokes**. Valid sequence → spell resolves in the sim, `SpellCast` event fires. Invalid sequence → fizzle: runes flash and scatter, mana already spent is lost. (Per-spell mastery — usage-based skill that nudges success chance — is designed in STATS.md; M0.9 only tracks it, M0 stays deterministic. It starts affecting success in M1.)
4. Composed runes persist across other actions until invoked or cleared (you can walk while holding a half-formed spell — classic).

### Costs & scaling (initial tuning)

- Potency multipliers ×1/×2/×3/×5/×8/×12. Base rune costs: Potency 1, Essence 2, Form 2, Aspect 3 (× multiplier).
- Example: `Kor Ign Dart` = (1+2+2)×2 = **10 mana** firebolt at power 2.

## Spell registry

`packages/sim/src/spells/registry.ts` maps canonical sequences → effects; resolution matches longest-known suffix pattern (essence+form+aspect) with potency as the free scalar.

### Milestone 0 spells (implement these two)

| Sequence | Spell | Effect |
|---|---|---|
| `[Potency] Lume` | **Light** | Torchlight radius/intensity boost, duration = 30s × multiplier (sim ticks). Stacking refreshes. |
| `[Potency] Ign Dart` | **Firebolt** | Projectile entity: travels 1 tile per 2 ticks along caster facing, collides with wall/door (impact flash event); damage vs monsters when they exist = 5 × multiplier. |

### Near-term spell book (M1–M2, pre-designed so effects code can anticipate)

`[P] Vit Vela` Healmist (party regen veil) · `[P] Krys Dart` Frostbolt (slows) · `[P] Vol Orbis` Stormburst (AoE) · `[P] Umbra Vela` Shadowveil (monster aggro radius down) · `[P] Lume Vera` Truesight (reveals secret-switch variants with a shimmer — a *player-knowledge* spell, very Cryptgrid) · `[P] Ign Korpa` Flamebrand (imbue weapon) · `[P] Vit Sig` Mend (touch-heal one character).

## Lore hook (flavor for inscriptions)

The Rune Tongue is the vault-builders' language of command; the dungeon itself obeys it. Inscriptions on walls occasionally *contain* valid sequences — teaching spells environmentally instead of via menus. (Cheap content, huge delight. Use in vault01: an inscription that reads `"Kor Ign Dart drives back the dark."`)
