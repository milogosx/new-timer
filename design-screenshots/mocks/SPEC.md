# Mock spec — iPhone 390x844 reference

Based on 5 reference images. Proportions measured as % of 390w unless noted.

## 01-home.png

- Status bar 9:41 at ~y=48
- "ELITE RECOMPOSITION" caps, amber, 13px, letter-spacing ~3px, centered, y≈150
- Settings gear: 48×48 outlined square, top-right, ~y=140
- Hero gauge: diameter ≈320, centered, y≈180-500
  - Gauge stroke is a THIN bezel, top 60% is a dark brushed-metal arc (grey gradient)
  - Amber arc sweeps clockwise from ~1 o'clock to ~7 o'clock (~180°) with strong glow
  - Small amber triangle pointer at 12 o'clock
- Wordmark inside gauge, centered:
  - "WORKOUT" silver gradient, condensed display 72px, weight 700
  - "TIMER" amber gradient same size, sits directly below (line-height 0.85)
- "YOUR WORKOUTS" small caps grey label, left, 15px letter-spacing 3px
- "EDIT" outlined button, right, ~72w × 40h, outlined white 1px
- Workout cards — 4 of them, each 72h, gap 12:
  - Amber left stripe 3px, full height
  - Circular icon badge 48×48, left, rgba(255,255,255,0.03) bg, 1px white-10 border
  - Name center: mixed case "Foundation & Flow", Oswald 20px weight 500
  - Right: outlined amber chip "STRENGTH" (4px radius, 11px, 2px letter-spacing) + chevron ›
  - Icons: Foundation & Flow=wavy lines, Power Pull=lightning, Full Body Volume=bars, The Engine=heart
- Dashed "+ CREATE NEW WORKOUT" pill, full width, 64h, border 1.5px dashed rgba(255,107,26,0.4), text: amber "+" + grey caps
- "TIMER ONLY" row 64h: stopwatch icon, bold caps label, right: "60 MIN · 30 SEC" grey caps, chevron
- "SESSION" row 64h: calendar icon, "SESSION" label, right: "WORKOUT · 60 MIN · 30 SEC"

## 02-timer-only.png

- Header row y≈100:
  - Back arrow 44×44 outlined-square top-left
  - "TIMER ONLY" centered, Oswald 18px bold 2px letter-spacing
  - Speaker icon 44×44 outlined top-right
- Gauge huge: diameter ≈360, centered ~y=280-640
  - Thick dark bezel ring ~24px wide, brushed gradient
  - Inner segmented tick ring (many small ticks, ~80)
  - Amber arc RIGHT SIDE ONLY: from ~12 o'clock down-right, curving around to ~6 o'clock (≈180°), with wide glow
  - Small amber triangle pointer at top
- Inside gauge (mock shows reversed order from what user requested):
  - "REMAINING" orange caps label 11px
  - "60:00" massive Orbitron 96px silver gradient
  - "ELAPSED" grey caps 11px
  - "00:00" Orbitron 28px grey
  - **USER OVERRIDE: flip so ELAPSED is big, REMAINING small**
- Controls row: at ~y=720
  - START: ~55% width, 56h, amber gradient fill, glow, play-triangle icon + "START" centered
  - RESET: ~42% width, 56h, transparent, outlined rgba(255,255,255,0.15), reset-arrow icon + "RESET"

## 03-workout-timer.png

- Header:
  - Back arrow square, "WARM UP" amber caps 20px, "FOUNDATION & FLOW" grey subtitle below, speaker icon right
- Gauge: diameter ≈360, centered
  - Ring is SEGMENTED BAR STYLE (thick radial bars, ~60 segments, not thin lines)
  - Dark segments on un-elapsed side
  - Amber segments on elapsed portion with glow
  - Quarter labels: "0" at top (y≈12 o'clock), "15" right (3 o'clock), "30" bottom, "45" left — digital font ~14px grey
- Center: "00:30" Orbitron 88px silver gradient
- Below timer: "30 SEC" grey caps 14px 2px tracking
- Session elapsed: "00:00" small grey right-aligned above START row — can keep but muted
- Controls row — identical layout to Timer Only
- "NEXT UP 0/12" row: amber left stripe 3px, "NEXT UP" bold caps + "0/12" grey, dropdown chevron ▾ outlined square right
- Exercise rows, 72h each:
  - 6-dot drag handle (::), small empty circle checkbox (24px), bold name, small meta "10" or "5 per side" + "REST 15s" chip
  - Right: "W/U" grey-blue chip (steel) + "RPE 4" amber chip (all outlined 4px radius)
  - 3-dot menu "..."

## 04-library.png

- Header y≈80:
  - Back arrow square left
  - "MANAGE" small amber caps 14px, letter-spacing 3px
  - "WORKOUTS" HUGE silver condensed, Oswald 44px weight 700
- Dashed "+ CREATE NEW WORKOUT" — amber-dashed, 64h, amber "+" + grey caps text
- Workout cards — ~180h each, not 72:
  - Amber left stripe 3px
  - Top row: icon badge 56×56 circle, then vertical stack {NAME caps 20px Oswald 700, "5 EXERCISES" + outlined amber chip "STRENGTH" on same row 14px grey}, right: PINNED badge (only on pinned, outlined amber 4px radius, amber glow)
  - Bottom row: 3 equal buttons — "UNPIN"/"PIN TOP" amber-outlined amber-text, "EDIT" white-outlined white-text, "DELETE" red-outlined red-text; 44h, 4px radius
  - Pinned card: full amber border outline + box-shadow glow
- "WARM-UPS" divider: horizontal grey line, centered amber text 14px tracking 3px, horizontal line
- Dashed "+ CREATE NEW WARM-UP" same style
- Warm-up cards: same 180h layout, WARM-UP chip (grey-ish amber) in meta row, only EDIT + DELETE (2 buttons)

## 05-editor.png

- Header:
  - Back arrow square left
  - "EDIT WORKOUT" centered, Oswald 22px bold, silver condensed
  - Save button top-right: 44×44 rounded 12, amber gradient fill, amber glow, white checkmark
- Section 1 (no left stripe — neutral card):
  - "WORKOUT NAME" label caps tracking
  - Input field dark
  - thin divider
  - "TYPE" label
  - Pill row: STRENGTH (amber outlined active) + CARDIO/MOBILITY/HIIT/OTHER (grey outlined inactive), wrapping
- Sections 2,3,4 have amber LEFT STRIPE 3px:
  - "WARM-UPS" title caps, divider, italic grey hint "Attach reusable warm-ups..."
    - Dynamic Primer chip: amber outlined, amber-check-circle filled, name, "7 ex" right
  - "CARDIO" title, hint, Steady State Cardio unselected (grey ring)
  - "EXERCISES" title, "#1" amber label, up/down/delete (↑/↓/✕) buttons outlined 36×36 right, then input fields below
