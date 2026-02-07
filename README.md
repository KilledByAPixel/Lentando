# Lentando

**Mindful progress tracking** — a zero-friction habit and substance-use tracker that runs entirely in your browser.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Installable-5c6bc0)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red)

## What It Does

Lentando helps you track substance use, urges resisted, and healthy habits — then turns that data into wins. It's designed for harm reduction, not judgment. Every small step counts.

### Features

- **One-tap logging** — Log sessions, resisted urges, or healthy habits with a single tap
- **Multi-addiction profiles** — Cannabis, alcohol, nicotine, or custom tracking
- **30+ win awards** — Automatic recognition of streaks, gaps, tapers, harm reduction, mindfulness, and more
- **Visual analytics** — 7/14/30-day graphs for sessions, amounts, urges resisted, and exercise
- **Hourly heatmaps** — See usage patterns by time of day (today + lifetime average)
- **Day-by-day history** — Browse previous days with full event details and inline editing
- **Win notifications** — Animated toast popups when you earn new achievements
- **Coaching tips** — Gentle nudges toward water, breathing, and movement after resisting
- **Dark/light theme** — Follows system preference or toggle manually
- **To-do list** — Built-in task tracking to stay organized
- **Import/export** — Full JSON backup and restore with duplicate detection
- **PWA support** — Install to home screen, works offline, network-first updates

### Tracked Win Types

| Category | Examples |
|---|---|
| **Session** | Resist, Delay (15m+), CBD Replacement, Harm Reduction, Low Dose, Mindful Session |
| **Daily** | CBD-Only Day, Zero THC Day, Low Day (≤2 units), T-Break Day, Hydrated (4+ waters) |
| **Timing** | Gap Wins (1–12h), Held Off Until Afternoon |
| **Comparison** | Fewer sessions than yesterday, Lower amount, First later / Last earlier |
| **Habits** | Habit Stack (2+ habit types) |
| **Streaks** | Resist Streak, Habit Streak, Taper Win (consecutive declining days) |
| **Engagement** | Welcome Back (24+ hours away) |

## Getting Started

1. Open `index.html` in any modern browser
2. Select what you're tracking (cannabis, alcohol, nicotine, or other)
3. Start logging

That's it. No build step, no dependencies, no install.

## Project Structure

```
index.html   — Single-page app (HTML + CSS, ~930 lines)
code.js      — All application logic (ES6 modules, ~1400 lines)
sw.js        — Service worker for PWA offline support
manifest.json — PWA manifest for installability
```

## Tech Stack

- **Vanilla JavaScript** using ES6 modules — no frameworks, no dependencies, no build step
- **localStorage** for persistence — `ht_events`, `ht_settings`, `ht_todos`, `ht_theme`
- **Service Worker** — Network-first caching strategy for instant updates
- **CSS custom properties** for theming with dark/light mode
- **Mobile-first** responsive design (max-width 480px)
- **PWA manifest** — Installable as standalone app

## Browser Support

Any modern browser with `localStorage` and Service Worker support. Designed primarily for mobile use but works on desktop.

## License

© 2026 Frank Force. All rights reserved. See [LICENSE](LICENSE) for details.
