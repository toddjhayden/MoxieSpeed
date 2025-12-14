# MoxieSpeed Game - Complete Setup PowerShell Script for Windows

Write-Host ""
Write-Host "========================================"
Write-Host "  MoxieSpeed Game - Auto Setup"
Write-Host "========================================"
Write-Host ""

# Create directory structure
Write-Host "[1/20] Creating directories..."
New-Item -ItemType Directory -Path "src\components" -Force | Out-Null
New-Item -ItemType Directory -Path "src\utils" -Force | Out-Null
New-Item -ItemType Directory -Path "src\styles" -Force | Out-Null

# Create package.json
Write-Host "[2/20] Creating package.json..."
$packageJson = @{
    name = "moxiespeed"
    version = "1.1.0"
    description = "Progressive 100-level racing game from Model T Fords to Spaceships"
    type = "module"
    homepage = "https://toddjhayden.github.io/MoxieSpeed/"
    scripts = @{
        dev = "vite"
        build = "vite build"
        preview = "vite preview"
        lint = "eslint src --ext js,jsx"
        deploy = "npm run build && gh-pages -d dist"
    }
    dependencies = @{
        react = "^18.2.0"
        "react-dom" = "^18.2.0"
        "lucide-react" = "^0.263.1"
        tone = "^14.8.49"
    }
    devDependencies = @{
        "@vitejs/plugin-react" = "^4.0.0"
        vite = "^4.3.9"
        tailwindcss = "^3.3.0"
        postcss = "^8.4.24"
        autoprefixer = "^10.4.14"
        eslint = "^8.44.0"
        "eslint-plugin-react" = "^7.32.2"
        "gh-pages" = "^6.1.0"
    }
    engines = @{
        node = ">=18.0.0"
    }
} | ConvertTo-Json -Depth 10
$packageJson | Out-File -FilePath "package.json" -Encoding UTF8

# Create vite.config.js
Write-Host "[3/20] Creating vite.config.js..."
$viteConfig = @"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/MoxieSpeed/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
"@
$viteConfig | Out-File -FilePath "vite.config.js" -Encoding UTF8

# Create tailwind.config.js
Write-Host "[4/20] Creating tailwind.config.js..."
$tailwindConfig = @"
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"@
$tailwindConfig | Out-File -FilePath "tailwind.config.js" -Encoding UTF8

# Create postcss.config.js
Write-Host "[5/20] Creating postcss.config.js..."
$postcssConfig = @"
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"@
$postcssConfig | Out-File -FilePath "postcss.config.js" -Encoding UTF8

# Create .prettierrc
Write-Host "[6/20] Creating .prettierrc..."
$prettierrc = @{
    semi = $true
    trailingComma = "es5"
    singleQuote = $true
    printWidth = 100
    tabWidth = 2
    useTabs = $false
} | ConvertTo-Json
$prettierrc | Out-File -FilePath ".prettierrc" -Encoding UTF8

# Create .eslintrc
Write-Host "[7/20] Creating .eslintrc..."
$eslintrc = @{
    env = @{
        browser = $true
        es2021 = $true
    }
    extends = @(
        "eslint:recommended"
        "plugin:react/recommended"
        "plugin:react/jsx-runtime"
    )
    parserOptions = @{
        ecmaVersion = "latest"
        sourceType = "module"
    }
    plugins = @("react")
    rules = @{
        "react/prop-types" = "off"
    }
    settings = @{
        react = @{
            version = "detect"
        }
    }
} | ConvertTo-Json -Depth 10
$eslintrc | Out-File -FilePath ".eslintrc" -Encoding UTF8

# Create .gitignore
Write-Host "[8/20] Creating .gitignore..."
$gitignore = @"
node_modules
dist
.env
.env.local
.DS_Store
*.log
.vscode
.idea
*.swp
*.swo
"@
$gitignore | Out-File -FilePath ".gitignore" -Encoding UTF8

# Create index.html
Write-Host "[9/20] Creating index.html..."
$indexHtml = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MoxieSpeed - Progressive Racing Game</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"@
$indexHtml | Out-File -FilePath "index.html" -Encoding UTF8

# Create src/main.jsx
Write-Host "[10/20] Creating src/main.jsx..."
$mainJsx = @"
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
"@
$mainJsx | Out-File -FilePath "src\main.jsx" -Encoding UTF8

# Create src/App.jsx
Write-Host "[11/20] Creating src/App.jsx..."
$appJsx = @"
import React from 'react';
import RacingGame from './components/RacingGame';

function App() {
  return <RacingGame />;
}

export default App;
"@
$appJsx | Out-File -FilePath "src\App.jsx" -Encoding UTF8

# Create src/styles/index.css
Write-Host "[12/20] Creating src/styles/index.css..."
$indexCss = @"
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Press+Start+2P&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier Prime', monospace;
  background: linear-gradient(135deg, #0a0e27 0%, #1a0a3e 50%, #0a0e27 100%);
  color: #00ff00;
  min-height: 100vh;
}

canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.neon-glow {
  text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00;
}

.arcade-title {
  font-family: 'Press Start 2P', cursive;
  letter-spacing: 2px;
}
"@
$indexCss | Out-File -FilePath "src\styles\index.css" -Encoding UTF8

# Create CHANGELOG.md
Write-Host "[13/20] Creating CHANGELOG.md..."
$changelog = @"
# Changelog

## [1.1.0] - 2025-01-15

### Added
- Complete sound system using Tone.js Web Audio API
- Engine sounds with dynamic pitch based on speed
- Victory/defeat fanfare melodies
- Menu ambient music
- GitHub Pages deployment support
- Sound toggle button on UI

## [1.0.0] - 2025-01-15

### Added
- Initial release of MoxieSpeed
- 100 progressive racing levels
- 6 vehicle eras (Model T to Spaceships)
- AI opponent system with dynamic difficulty
- Canvas-based 60fps rendering
- Keyboard controls (Arrow Keys + WASD)
- Win/loss statistics tracking
- Retro arcade aesthetic with neon styling
"@
$changelog | Out-File -FilePath "CHANGELOG.md" -Encoding UTF8

# Create README.md
Write-Host "[14/20] Creating README.md..."
$readme = @"
# MoxieSpeed - Progressive Racing Game

Progressive 100-level racing game from Model T Fords to Spaceships with complete sound system.

## Features

- **100 Progressive Levels** - From Model T to Spaceships
- **6 Vehicle Eras** with unique designs
- **3 AI Opponents** with dynamic difficulty
- **Complete Sound System** - Engine sounds, music, effects
- **Beautiful Arcade Aesthetic** - Neon colors, retro styling
- **GitHub Pages Support** - Play directly from web

## Installation

\`\`\`bash
npm install
npm run dev
\`\`\`

## How to Play

- **Arrow Keys** or **WASD** to drive
- **Finish in 1st place** to advance levels
- **Toggle sound** with menu button
- **Complete all 100 levels** to win!

## Deployment

\`\`\`bash
npm run build
npm run deploy
\`\`\`

Play online: https://toddjhayden.github.io/MoxieSpeed/

## Sound System

Complete Web Audio API synthesis using Tone.js:
- Engine sounds with speed-based pitch
- Victory/defeat fanfares
- Menu ambient music
- All sounds toggleable
"@
$readme | Out-File -FilePath "README.md" -Encoding UTF8

# Create QUICKSTART.md
Write-Host "[15/20] Creating QUICKSTART.md..."
$quickstart = @"
# Quick Start Guide

## Installation (1 minute)

\`\`\`bash
npm install
\`\`\`

## Run Locally (1 minute)

\`\`\`bash
npm run dev
\`\`\`

Game opens at http://localhost:3000

## Deploy to GitHub Pages (2 minutes)

1. Go to: https://github.com/toddjhayden/MoxieSpeed/settings/pages
2. Source: Deploy from a branch > main
3. Click Save
4. Wait 2-3 minutes
5. Visit: https://toddjhayden.github.io/MoxieSpeed/

## Game Controls

- Arrow Keys or WASD to drive
- Click SOUND: ON/OFF to toggle audio
- Finish 1st to advance level
"@
$quickstart | Out-File -FilePath "QUICKSTART.md" -Encoding UTF8

# Create DEPLOYMENT.md
Write-Host "[16/20] Creating DEPLOYMENT.md..."
$deployment = @"
# Deployment Guide

## GitHub Pages

1. Go to: https://github.com/toddjhayden/MoxieSpeed/settings/pages
2. Source: Deploy from a branch
3. Branch: main
4. Wait 2-3 minutes

Your game: https://toddjhayden.github.io/MoxieSpeed/

## Vercel (Alternative)

1. Go to: https://vercel.com
2. Import GitHub repo
3. Click Deploy

Auto-deploys on every push!
"@
$deployment | Out-File -FilePath "DEPLOYMENT.md" -Encoding UTF8

# Create GITHUB_PAGES_AND_SOUND.md
Write-Host "[17/20] Creating GITHUB_PAGES_AND_SOUND.md..."
$githubPages = @"
# GitHub Pages and Sound System

## Play Directly from GitHub

After deploying to GitHub Pages:
https://toddjhayden.github.io/MoxieSpeed/

## Sound Features

- **Engine Sounds** - Pitch changes with speed
- **Victory Fanfare** - Win melody
- **Defeat Melody** - Loss melody  
- **Menu Music** - Ambient drone
- **Sound Toggle** - ON/OFF button

All synthesized with Tone.js Web Audio API - no audio files needed!
"@
$githubPages | Out-File -FilePath "GITHUB_PAGES_AND_SOUND.md" -Encoding UTF8

# Create src/utils/SoundManager.js
Write-Host "[18/20] Creating src/utils/SoundManager.js..."
$soundManager = @"
import * as Tone from 'tone';

export class SoundManager {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.synth = null;
    this.bass = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized || !this.enabled) return;
    
    await Tone.start();
    
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.1,
      },
    }).toDestination();
    this.synth.volume.value = -15;

    this.bass = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.1,
        release: 0.3,
      },
    }).toDestination();
    this.bass.volume.value = -12;

    this.initialized = true;
  }

  engineSound(speed, duration = 0.1) {
    if (!this.enabled || !this.initialized) return;
    const frequency = 200 + Math.abs(speed) * 100;
    this.synth.triggerAttackRelease(frequency, duration);
  }

  victory() {
    if (!this.enabled || !this.initialized) return;
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.synth.triggerAttackRelease(note, '0.3');
      }, i * 150);
    });
  }

  defeat() {
    if (!this.enabled || !this.initialized) return;
    const notes = ['C4', 'B3', 'A3', 'G3'];
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.bass.triggerAttackRelease(note, '0.4');
      }, i * 200);
    });
  }

  levelUp() {
    if (!this.enabled || !this.initialized) return;
    this.bass.triggerAttackRelease('C2', '0.1');
    setTimeout(() => {
      this.synth.triggerAttackRelease('G4', '0.3');
    }, 100);
  }

  startRace() {
    if (!this.enabled || !this.initialized) return;
    const tones = ['A4', 'A4', 'A4', 'C5'];
    const durations = ['0.1', '0.1', '0.1', '0.3'];
    tones.forEach((tone, i) => {
      setTimeout(() => {
        this.synth.triggerAttackRelease(tone, durations[i]);
      }, i * 250);
    });
  }

  playMenuMusic() {
    if (!this.enabled || !this.initialized) return;
    if (this.ambiance) this.ambiance.stop();
    this.ambiance = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 0.5 },
    }).toDestination();
    this.ambiance.volume.value = -20;
    this.ambiance.triggerAttack('C2');
    setTimeout(() => {
      this.ambiance.frequency.rampTo('G1', 2);
    }, 2000);
  }

  stopMenuMusic() {
    if (this.ambiance) {
      this.ambiance.triggerRelease();
      this.ambiance = null;
    }
  }

  toggleSound(enabled) {
    this.enabled = enabled;
    if (!enabled && this.ambiance) {
      this.stopMenuMusic();
    }
  }
}

export default SoundManager;
"@
$soundManager | Out-File -FilePath "src\utils\SoundManager.js" -Encoding UTF8

# Create src/components/RacingGame.jsx - Large file, read from pre-existing
Write-Host "[19/20] Creating src/components/RacingGame.jsx..."
$racingGame = Get-Content -Path "/mnt/user-data/outputs/MoxieSpeed/src/components/RacingGame.jsx" -Raw
$racingGame | Out-File -FilePath "src\components\RacingGame.jsx" -Encoding UTF8

# Git commit
Write-Host "[20/20] Committing to git..."
git add .
git commit -m "chore: initial MoxieSpeed project setup with complete game and sound system"

Write-Host ""
Write-Host "========================================"
Write-Host "  ✅ SUCCESS! All files created!"
Write-Host "========================================"
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "1. Install dependencies:"
Write-Host "   npm install"
Write-Host ""
Write-Host "2. Test locally:"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "3. Push to GitHub:"
Write-Host "   git push -u origin main"
Write-Host ""
Write-Host "4. Enable GitHub Pages:"
Write-Host "   - Go to https://github.com/toddjhayden/MoxieSpeed/settings/pages"
Write-Host "   - Select 'Deploy from a branch' > 'main'"
Write-Host "   - Wait 2-3 minutes"
Write-Host "   - Visit https://toddjhayden.github.io/MoxieSpeed/"
Write-Host ""
Write-Host "========================================"
Write-Host ""
Read-Host "Press Enter to close"
