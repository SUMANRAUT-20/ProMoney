# Stageshow rehearsal for the landing phone

The previous ProMoney Home demo supplies the script and final-state poster. The hero replaces its browser frame with the Stageshow 1.1.1 Phone. The 500 × 480 stage shows a 428px phone on desktop. The 358 × 378 compact stage uses a 326px phone, tighter content insets and different cursor coordinates. The page supplies the background and crops the phone through the activity placeholders.

## Story and poster

1. Add opens the quick entry and the cursor types “¥1,200 · Food & Dining”.
2. Save adds the transaction, then Safe to spend rolls from ¥4,800/day to ¥4,750/day.
3. The cursor moves to the goal, whose progress and “On track” appear. The final state holds until the cursor presses Reset.

The daily figures use the same 24-day sample as the previous landing. The goal reveal represents existing progress. The reduced-motion poster shows the saved transaction, updated amount and goal status.

## Rehearsal

- The 1440px and 390px loop gates printed “rehearsal passed”. Frame sampling gaps made the separate automated motion coverage inconclusive.
- The reduced-motion poster gate checked both layouts. The desktop pass corrected the rolling value’s bottom inset, and the phone pass centered the goal ring and label.
- The real-time compact browser check verified typing, save, amount roll, goal status, reset and pause. The fresh-eye frame review confirmed the centered composition and full story content. It noted the repeated daily figure on mobile and the activity placeholders. Both are part of the comparison design and the existing demo.
- Browser checks confirmed the phone crop, final state, visible satellite counts and clearances. Physical-phone playback was outside this pass.

Run the loop rehearsal from the installed Stageshow folder:

```sh
node scripts/film.mjs http://127.0.0.1:5173/landing --select .landing-product-demo --width 1440 --every 1560 --count 10 --gate
node scripts/film.mjs http://127.0.0.1:5173/landing --select .landing-product-demo --width 390 --every 1560 --count 10 --gate
```
