# Stageshow rehearsal for ProMoney Home

The starting point was Stageshow 1.1.1’s filmed hero-demo. The adaptation keeps its measured cursor targets, browser frame, bottom crop and compact layout. It uses Manrope, ProMoney green and a short activity list. The runtime uses a subset of the MIT-licensed kit under `kit/` with all kit rules scoped to the landing wrapper.

## Story and poster

1. The cursor presses Add and types “¥1,200 · Food & Dining” in the quick-entry row.
2. On Save, Food & Dining joins the activity list. Safe to spend rolls from ¥4,800/day to ¥4,750/day.
3. The cursor moves to the savings card. The arc draws into view and “On track” appears. The cursor holds, then presses Reset to clear the sample entry and return to the opening.

The wide stage is 720 × 340. The compact stage is 358 × 314 and omits the sidebar. The poster shows the saved entry, updated daily figure and goal status. Reduced motion and the pause control show that same state.

The amounts are illustrative. A separate check against financeMath confirmed the daily amounts for a 24-day sample month with a ¥1,200 expense. The arc reveals an existing goal’s status. The landing renders static sample values.

## Captures and gate

- Headless Chrome at 1440px and 390px. Both source-CSS loop captures printed “rehearsal passed” with zero gate findings. The automated motion scan still reported incomplete coverage because of capture gaps.
- Desktop and compact reduced-motion posters reported no issues. A compact state sheet and a targeted quick-entry capture supported the fresh-eye review. A separate browser run checked typing, save, amount roll, goal status, reset and replay in real time.
- Earlier passes caught uneven gutters, incorrect icon sizing and a clipped amount digit. The corrected stage clips the window at the bottom, uses equal side gutters and keeps the resting Roll width tied to the loaded font.
- The fresh-eye review flagged the daily amount and goal progress as easy to misread. The card now says “/ day” and the cursor moves to the goal before its existing progress draws from an empty track. Placeholder rows surround the story as requested.

To repeat the visual gate, serve the frontend and run from the installed Stageshow folder:

```sh
node scripts/film.mjs http://localhost:5173/landing --select .landing-product-demo --width 1440 --every 1200 --count 12 --gate
node scripts/film.mjs http://localhost:5173/landing --select .landing-product-demo --width 390 --every 1200 --count 12 --gate
```

The bundled production stylesheet combines the kit files into one sheet. Stageshow's checker treats some kit rules in this sheet as external overrides. The gate used Vite’s source stylesheets, and the production page was also captured. Physical phone playback, continuous 40–80 ms coverage of every beat and 4× glyph checks were outside this pass.
