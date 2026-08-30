# PackWise

A cross-platform app (iOS/Android/web from one Expo + Expo Router codebase)
that tells you exactly how to pack your car. Pick your car, pick what you're
bringing, and it works out a step-by-step, illustrated loading plan — not
just "does the volume fit," but "does the shape fit, and will the trunk
actually close."

## Why this is more than a volume calculator

- **Real trunk geometry, not a box.** Each car's cargo area is modeled as a
  set of cuboid regions (`src/data/cars.ts`), which lets it represent wheel
  arches that pinch the floor, a liftgate that slopes down toward the
  opening, and — critically — the **closed-lid height**, so a plan that
  "fits" also actually lets you shut the trunk.
- **Items aren't all boxes either.** A folded stroller or a standing golf
  bag gets modeled as a compound shape (multiple offset sub-boxes), not a
  single bounding box (`src/data/items.ts`).
- **Body-style-aware accessibility.** A sedan's trunk lid opens from the
  top, so "can I reach this without unpacking?" depends on what's stacked
  *above* it. A hatchback/SUV/minivan opens from the rear, so it depends on
  what's *between it and the tailgate*. The packer (`src/core/packer.ts`)
  models both.
- **Rear visibility as a real, optional constraint.** For body styles where
  the cargo area is open to the back window, you can ask the planner to
  keep the stack below the driver's sightline — and choose whether it's
  allowed to block it anyway if that's the only way everything fits.
- **Compressible items squeeze last.** Soft bags (duffels, backpacks) are
  tried at full size first, then progressively compressed to fill leftover
  gaps, the way you'd actually jam a duffel into a gap by hand.
- **Custom items with a photo-assisted measurer.** Don't see your exact
  suitcase in the library? Add it with manual dimensions, or use the photo
  tool: tap two points on a part whose length you already know, type that
  length in, then tap two more points on the part you want measured — the
  ratio of on-screen pixel distances gives the real length, no camera
  calibration needed. Saved custom items persist locally and show up again
  next time.

## Architecture

```
src/core/        Pure TypeScript packing engine (no React/RN imports) —
                  types, geometry helpers, the placement heuristic,
                  instruction text, and the SVG-illustration geometry.
                  Covered by src/core/__tests__ (vitest).
src/data/        Seed car and item libraries.
src/state/       Session state (React context) + AsyncStorage persistence
                  for user-saved custom items.
src/components/  Shared UI: the trunk illustration renderer (react-native-svg)
                  and the photo-measurement tool.
app/             Expo Router screens: car select -> item picker -> add a
                  custom item -> preferences -> illustrated result.
```

The packing algorithm (`src/core/packer.ts`) is a heuristic 3D placer:
items are loaded in an order that puts large rigid pieces first (as a
stable base) and anything you marked "keep accessible" last, so it
naturally ends up near the opening/top. Candidate positions come from both
already-placed item edges and the cavity's own region boundaries (so the
very first item placed doesn't get stuck trying only the trunk's outer
corner). Every candidate is checked against the closed-lid height at every
sampled point of its footprint, not just a single ceiling number.

## Data honesty

Car trunk-region breakdowns are engineering approximations built from
published cargo-volume/opening specs and typical body-style geometry — not
an official manufacturer CAD export. Each car and item carries a
`sourceNote` explaining what it's based on. Real trims vary; that's exactly
why saving your own measured items exists.

## Running it

```bash
npm install
npm run web        # web (also serves as the website)
npm start           # Expo dev server — scan the QR with Expo Go for iOS/Android
npm test             # packing-engine unit tests (vitest)
npm run typecheck   # tsc --noEmit
npm run build:web   # static web export (./dist)
```

If your network blocks Expo's telemetry/update-check calls, run with
`EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1` set.

## What's next (not in this v1)

- A real vision-model dimension estimator (the photo tool is architected so
  swapping in an actual model call is a one-function change).
- More cars/items — the data files are the extension point.
- Persisting a full session (not just saved items) so you can resume a trip.
