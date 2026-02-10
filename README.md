# Calgary Barbell 16-Week Program

Training program tracker and workout logger built from the official Calgary Barbell spreadsheet.

## Quick Start

```bash
cd /Users/ahmadziada/.gemini/antigravity/scratch
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **16-week program** parsed exactly from the Excel template (all exercises, sets, reps, intensities, tempos, rest)
- **Auto-calculated loads** using your training maxes with MROUND rounding
- **Set-by-set workout logging** with weight, reps, RPE, and notes
- **Progress charts** for Squat, Bench, and Deadlift (top set + estimated 1RM)
- **Calendar history** of completed workouts
- **Unit conversion** (lbs ↔ kg) with consistent rounding
- **100% offline** — all data stored locally in IndexedDB

## How It Works

### Load Calculation
```
Suggested Load = MROUND(Training Max × Intensity%, Rounding Increment)
```
- Example: Squat TM=315, Week 1 @ 67% → `MROUND(315 × 0.67, 5)` = **210 lbs**

### E1RM Formula
Uses the **Epley method**:
```
Estimated 1RM = Weight × (1 + Reps / 30)
```

### Updating the Program
If the spreadsheet changes:
```bash
node scripts/parse-program.js /path/to/new-spreadsheet.xlsx
```
This regenerates `public/program_template.json`.

## Tech Stack

- **Next.js 16** + TypeScript
- **IndexedDB** (via `idb`) for local persistence 
- **Recharts** for progress visualization
- **XLSX** for spreadsheet parsing (build-time)

## Project Structure

```
├── scripts/parse-program.js     # Excel → JSON converter
├── public/program_template.json # Generated program data
├── src/
│   ├── app/                     # Next.js app router
│   ├── components/              # UI components
│   │   ├── AppShell.tsx
│   │   ├── Onboarding.tsx
│   │   ├── ProgramBrowser.tsx
│   │   ├── WorkoutLogger.tsx
│   │   ├── History.tsx
│   │   ├── Progress.tsx
│   │   └── Settings.tsx
│   └── lib/                     # Core logic
│       ├── types.ts
│       ├── calculations.ts
│       ├── db.ts
│       └── context.tsx
```
