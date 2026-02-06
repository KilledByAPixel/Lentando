# Lentando

**Mindful progress tracking** — a zero-friction habit and substance-use tracker that runs entirely in your browser.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red)

## What It Does

Lentando helps you track substance use, urges resisted, and healthy habits — then turns that data into wins. It's designed for harm reduction, not judgment. Every small step counts.

### Features

- **One-tap logging** — Log sessions, resisted urges, or healthy habits with a single tap
- **Multi-addiction profiles** — Cannabis, alcohol, nicotine, or custom tracking
- **25+ win types** — Automatic recognition of streaks, gaps, tapers, harm reduction, and more
- **7/14/30-day graphs** — Visualize sessions, amounts, urges resisted, water intake, and exercise
- **Day-by-day history** — Expandable history with full event details and inline editing
- **Coaching tips** — Gentle nudges toward water, breathing, music, and movement
- **Dark/light theme** — Follows system preference or toggle manually
- **Import/export** — Full JSON backup and restore with duplicate detection
- **100% offline** — No server, no accounts, no tracking. Data stays in `localStorage`

### Tracked Win Types

| Category | Examples |
|---|---|
| **Session** | Resist, Delay (15m+), CBD Replacement, Harm Reduction, Low Dose, Mindful Session |
| **Daily** | CBD-Only Day, Zero THC Day, Low Day |
| **Timing** | Gap Wins (1–12h), Late Start, Held Off Until Afternoon |
| **Comparison** | Fewer sessions than yesterday, Lower amount, First later / Last earlier |
| **Habits** | Habit Stack, Music + Habit, Music During Resist |
| **Streaks** | Resist Streak, Habit Streak, Music Streak, Taper Win |

## Getting Started

1. Open `index.html` in any modern browser
2. Select what you're tracking (cannabis, alcohol, nicotine, or other)
3. Start logging

That's it. No build step, no dependencies, no install.

## Project Structure

```
index.html   — Single-page app (HTML + CSS, ~870 lines)
code.js      — All application logic (~1270 lines)
```

## Tech Stack

- **Vanilla JavaScript** in a single IIFE — no frameworks, no dependencies
- **localStorage** for persistence — `ht_events` and `ht_settings`
- **CSS custom properties** for theming
- **Mobile-first** responsive design (max-width 480px)

## Browser Support

Any modern browser with `localStorage` support. Designed primarily for mobile use.

## License

All rights reserved. See [LICENSE](LICENSE) for details.
