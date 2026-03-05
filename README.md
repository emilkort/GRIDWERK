# GRIDWERK

A desktop music production dashboard for organizing samples, VST plugins, projects, and creative workflows — built for producers who use Ableton Live and Maschine.

![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

## Features

### Sample Library
- Import and organize audio samples with folder watching (chokidar)
- Auto-detect **BPM**, **musical key**, spectral features, and waveform peaks
- AI-powered **similarity search** using audio embeddings and cosine similarity
- **Duplicate detection** — exact matches via waveform hashing, near-duplicates via clustering
- NLP-enhanced search across file names, categories, and tags
- Interactive waveform previews (WaveSurfer.js) with click-to-seek
- Web Audio API playback engine with LRU AudioBuffer cache
- Categories: kick, snare, hi-hat, clap, percussion, bass, vocal, FX, pad, synth, keys, loop, one-shot
- Camelot wheel key filtering with color-coded badges
- Batch analysis via Piscina thread pool workers

### VST Plugin Manager
- Scan and catalog installed VST2/VST3 plugins
- Auto-extract vendor, category, and subcategory metadata
- Favorite plugins and filter by type
- Plugin enrichment from VST3 `moduleinfo.json` and VST2 DLL version info

### Project Tracker
- Kanban-style boards with drag-and-drop (Idea → In Progress → Mixing → Done)
- Track BPM, musical key, priority, and task completion per project
- Filter by DAW (Ableton / Maschine / Other)

### Analytics Dashboard
- Sample count, project funnel, VST inventory stats
- BPM range distribution and key grid heatmap
- Category breakdown, DAW usage, and top tags cloud

### Discover
- AI-powered plugin recommendations
- Surface unexplored categories and plugins similar to your favorites

### DAW Hub
- Quick access to active DAW sessions and recent projects

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 28 |
| Frontend | React 19, TypeScript 5.7, TailwindCSS 3.4 |
| State | Zustand |
| Database | SQLite (better-sqlite3) |
| Audio | Web Audio API, WaveSurfer.js, music-metadata |
| Analysis | Piscina worker threads (BPM, key, embeddings, spectral) |
| UI | @tanstack/react-virtual, @dnd-kit, react-arborist, cmdk |
| Build | electron-vite |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Install

```bash
git clone https://github.com/emilkort/GRIDWERK.git
cd GRIDWERK
npm install
npx electron-rebuild -f -w better-sqlite3
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── services/   # Database, analysis workers, IPC handlers
│   └── index.ts
├── preload/        # contextBridge API
└── renderer/       # React app
    ├── components/ # UI components
    ├── stores/     # Zustand stores
    ├── hooks/      # Custom React hooks
    ├── pages/      # Route pages
    └── assets/     # Styles, images, logo
```

## License

Private — All rights reserved.
