import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Trophy, Flag } from 'lucide-react';
import SoundManager from '../utils/SoundManager';

const WIDTH = 900;
const HEIGHT = 600;

const VEHICLES = [
  { name: 'Stock Racer', maxSpeed: 200, accel: 5, handling: 1, color: '#e74c3c', unlockLevel: 1 },
  { name: 'Street Machine', maxSpeed: 220, accel: 5.5, handling: 1.1, color: '#3498db', unlockLevel: 3 },
  { name: 'Muscle Beast', maxSpeed: 240, accel: 6, handling: 0.9, color: '#f39c12', unlockLevel: 5 },
  { name: 'Euro Sport', maxSpeed: 260, accel: 5.5, handling: 1.3, color: '#2ecc71', unlockLevel: 10 },
  { name: 'Super GT', maxSpeed: 280, accel: 6.5, handling: 1.2, color: '#9b59b6', unlockLevel: 20 },
  { name: 'Hyper Machine', maxSpeed: 300, accel: 7, handling: 1.1, color: '#1abc9c', unlockLevel: 35 },
  { name: 'Proto Racer', maxSpeed: 320, accel: 7.5, handling: 1.3, color: '#e91e63', unlockLevel: 50 },
  { name: 'Apex Predator', maxSpeed: 340, accel: 8, handling: 1.4, color: '#ff5722', unlockLevel: 70 },
  { name: 'Lightning', maxSpeed: 360, accel: 8.5, handling: 1.5, color: '#00bcd4', unlockLevel: 90 },
];

export default function RacingGame() {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [level, setLevel] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [position, setPosition] = useState(1);
  const [lap, setLap] = useState(1);
  const [totalLaps] = useState(3);
  const [speed, setSpeed] = useState(0);
  const [raceTime, setRaceTime] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [finalPosition, setFinalPosition] = useState(null);
  const [bestTime, setBestTime] = useState(() => {
    const saved = localStorage.getItem('moxiespeed-besttime');
    return saved ? parseFloat(saved) : null;
  });

  const soundManagerRef = useRef(null);
  const gameRef = useRef(null);
  const vehicle = VEHICLES[selectedVehicle];

  useEffect(() => {
    soundManagerRef.current = new SoundManager(soundEnabled);
    return () => soundManagerRef.current?.stopMenuMusic();
  }, []);

  useEffect(() => {
    soundManagerRef.current?.toggleSound(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (bestTime) localStorage.setItem('moxiespeed-besttime', bestTime.toString());
  }, [bestTime]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameRef.current) gameRef.current.keys[e.key] = true;
      if (e.key === ' ') e.preventDefault();
    };
    const handleKeyUp = (e) => {
      if (gameRef.current) gameRef.current.keys[e.key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = useCallback(async () => {
    if (soundManagerRef.current) {
      await soundManagerRef.current.initialize();
      soundManagerRef.current.stopMenuMusic();
    }

    // Create track as array of curve values
    const trackLength = 3000 + level * 500;
    const track = [];
    for (let i = 0; i < trackLength; i++) {
      const curve = Math.sin(i * 0.01) * (2 + level * 0.2) + Math.sin(i * 0.02) * (1 + level * 0.1);
      track.push(curve);
    }

    // Create opponents
    const opponents = [];
    for (let i = 0; i < 7; i++) {
      opponents.push({
        z: trackLength * 0.1 + (i * trackLength * 0.1),
        x: (Math.random() - 0.5) * 1.4,
        speed: 120 + Math.random() * 60 + level * 2,
        color: `hsl(${i * 51}, 70%, 50%)`,
        lap: 1,
        finished: false,
      });
    }

    gameRef.current = {
      track,
      trackLength,
      opponents,
      z: 0,
      x: 0,
      speed: 0,
      lap: 1,
      keys: {},
      startTime: performance.now(),
      nitro: 100,
      finished: false,
    };

    setPosition(8);
    setLap(1);
    setSpeed(0);
    setRaceTime(0);
    setNitro(100);
    setFinalPosition(null);
    setCountdown(3);
    setGameState('countdown');

    setTimeout(() => setCountdown(2), 1000);
    setTimeout(() => setCountdown(1), 2000);
    setTimeout(() => {
      setCountdown(0);
      setGameState('playing');
      if (gameRef.current) gameRef.current.startTime = performance.now();
      soundManagerRef.current?.startRace();
    }, 3000);
  }, [level]);

  const finishRace = useCallback((pos) => {
    if (!gameRef.current) return;
    const time = (performance.now() - gameRef.current.startTime) / 1000;
    setRaceTime(time);
    setFinalPosition(pos);
    if (!bestTime || time < bestTime) setBestTime(time);
    if (pos <= 3) {
      soundManagerRef.current?.victory();
      setGameState('victory');
    } else {
      soundManagerRef.current?.defeat();
      setGameState('gameOver');
    }
  }, [bestTime]);

  const nextLevel = useCallback(() => {
    if (level >= 100) { setGameState('champion'); return; }
    setLevel(prev => prev + 1);
    startGame();
  }, [level, startGame]);

  const resetGame = useCallback(() => {
    setLevel(1);
    setGameState('menu');
  }, []);

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const loop = () => {
      const g = gameRef.current;
      if (!g) return;

      const keys = g.keys;
      const maxSpeed = vehicle.maxSpeed * (keys[' '] && g.nitro > 0 ? 1.4 : 1);
      const accel = vehicle.accel;
      const handling = vehicle.handling;

      if (!g.finished) {
        // Controls
        if (keys['ArrowUp'] || keys['w'] || keys['W']) {
          g.speed = Math.min(g.speed + accel, maxSpeed);
        } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
          g.speed = Math.max(g.speed - accel * 2, 0);
        } else {
          g.speed = Math.max(g.speed - accel * 0.3, 0);
        }

        if (keys[' '] && g.nitro > 0 && g.speed > 30) {
          g.nitro = Math.max(0, g.nitro - 0.5);
        } else {
          g.nitro = Math.min(100, g.nitro + 0.08);
        }

        const steer = handling * 0.03 * (g.speed / maxSpeed);
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) g.x -= steer;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) g.x += steer;

        // Off road
        if (Math.abs(g.x) > 1.1) {
          g.x = Math.max(-1.3, Math.min(1.3, g.x));
          g.speed *= 0.96;
        }

        // Move
        g.z += g.speed * 0.02;

        // Apply curve
        const idx = Math.floor(g.z) % g.track.length;
        g.x += g.track[idx] * g.speed * 0.00003;

        // Lap
        if (g.z >= g.trackLength) {
          g.z -= g.trackLength;
          g.lap++;
          setLap(g.lap);
          soundManagerRef.current?.levelUp();
          if (g.lap > totalLaps) {
            g.finished = true;
            let pos = 1;
            g.opponents.forEach(o => { if (o.finished) pos++; });
            finishRace(pos);
          }
        }

        // Opponents
        g.opponents.forEach(opp => {
          if (opp.finished) return;
          opp.z += opp.speed * 0.02;
          opp.x += Math.sin(opp.z * 0.01) * 0.01;
          opp.x = Math.max(-1, Math.min(1, opp.x));
          if (opp.z >= g.trackLength) {
            opp.z -= g.trackLength;
            opp.lap++;
            if (opp.lap > totalLaps) opp.finished = true;
          }
          // Collision
          const dz = Math.abs(opp.z - g.z);
          if (dz < 30 && Math.abs(opp.x - g.x) < 0.3) {
            if (g.z > opp.z) g.speed *= 0.8;
            else opp.speed *= 0.8;
            g.x += (g.x - opp.x) * 0.2;
          }
        });

        // Position
        let pos = 1;
        g.opponents.forEach(opp => {
          if (opp.lap > g.lap || (opp.lap === g.lap && opp.z > g.z)) pos++;
        });
        setPosition(pos);
        setSpeed(Math.floor(g.speed));
        setNitro(Math.floor(g.nitro));
        setRaceTime((performance.now() - g.startTime) / 1000);
      }

      // === RENDER ===
      const w = WIDTH, h = HEIGHT;
      const horizon = h * 0.4;
      const roadW = 0.6;

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#000428');
      sky.addColorStop(1, '#004e92');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      // Ground
      ctx.fillStyle = '#1a472a';
      ctx.fillRect(0, horizon, w, h - horizon);

      // Draw road segments from horizon to bottom
      const numSegments = 120;
      const segmentH = (h - horizon) / numSegments;
      const baseZ = Math.floor(g.z);

      let roadX = w / 2 - g.x * 200; // Player offset affects perspective

      for (let i = numSegments; i >= 0; i--) {
        const y = horizon + i * segmentH;
        const perspective = (i + 1) / numSegments;
        const scale = perspective * perspective; // Exponential for depth
        const segWidth = roadW * w * scale;

        const segZ = baseZ + (numSegments - i) * 3;
        const curve = g.track[segZ % g.track.length] || 0;
        roadX += curve * scale * 2;

        const nextY = y + segmentH;
        const nextPerspective = (i + 2) / numSegments;
        const nextScale = nextPerspective * nextPerspective;
        const nextSegWidth = roadW * w * nextScale;
        const nextRoadX = roadX + (g.track[(segZ + 3) % g.track.length] || 0) * nextScale * 2;

        // Alternating colors
        const stripe = Math.floor((segZ) / 8) % 2;

        // Grass
        ctx.fillStyle = stripe ? '#228B22' : '#1a6b1a';
        ctx.fillRect(0, y, w, segmentH + 1);

        // Rumble strips
        ctx.fillStyle = stripe ? '#ff0000' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(roadX - segWidth * 1.15, y);
        ctx.lineTo(nextRoadX - nextSegWidth * 1.15, nextY);
        ctx.lineTo(nextRoadX - nextSegWidth * 0.95, nextY);
        ctx.lineTo(roadX - segWidth * 0.95, y);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(roadX + segWidth * 0.95, y);
        ctx.lineTo(nextRoadX + nextSegWidth * 0.95, nextY);
        ctx.lineTo(nextRoadX + nextSegWidth * 1.15, nextY);
        ctx.lineTo(roadX + segWidth * 1.15, y);
        ctx.fill();

        // Road
        ctx.fillStyle = stripe ? '#444' : '#3a3a3a';
        ctx.beginPath();
        ctx.moveTo(roadX - segWidth, y);
        ctx.lineTo(nextRoadX - nextSegWidth, nextY);
        ctx.lineTo(nextRoadX + nextSegWidth, nextY);
        ctx.lineTo(roadX + segWidth, y);
        ctx.fill();

        // Center line
        if (stripe) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(roadX - segWidth * 0.02, y);
          ctx.lineTo(nextRoadX - nextSegWidth * 0.02, nextY);
          ctx.lineTo(nextRoadX + nextSegWidth * 0.02, nextY);
          ctx.lineTo(roadX + segWidth * 0.02, y);
          ctx.fill();
        }

        // Lane markers
        if (!stripe) {
          ctx.fillStyle = '#fff';
          for (const lane of [-0.5, 0.5]) {
            ctx.beginPath();
            ctx.moveTo(roadX + segWidth * lane - segWidth * 0.015, y);
            ctx.lineTo(nextRoadX + nextSegWidth * lane - nextSegWidth * 0.015, nextY);
            ctx.lineTo(nextRoadX + nextSegWidth * lane + nextSegWidth * 0.015, nextY);
            ctx.lineTo(roadX + segWidth * lane + segWidth * 0.015, y);
            ctx.fill();
          }
        }

        // Start/finish
        if (segZ % g.trackLength < 50) {
          ctx.fillStyle = (Math.floor(segZ / 10) % 2) ? '#fff' : '#000';
          ctx.fillRect(roadX - segWidth, y, segWidth * 2, segmentH);
        }
      }

      // Opponents
      g.opponents.forEach(opp => {
        let dz = opp.z - g.z;
        if (dz < -g.trackLength / 2) dz += g.trackLength;
        if (dz < 0 || dz > 500) return;

        const depth = dz / 500;
        const scale = 1 - depth * 0.9;
        if (scale < 0.05) return;

        const screenY = horizon + (1 - depth) * (h - horizon - 80);
        const screenX = w / 2 + (opp.x - g.x) * 300 * scale;
        const carW = 60 * scale;
        const carH = 35 * scale;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(screenX - carW/2, screenY + carH * 0.2, carW, carH * 0.15);

        // Body
        ctx.fillStyle = opp.color;
        ctx.fillRect(screenX - carW/2, screenY - carH, carW, carH);

        // Roof
        ctx.fillRect(screenX - carW/3, screenY - carH * 1.4, carW * 0.66, carH * 0.4);

        // Windshield
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX - carW/4, screenY - carH * 1.35, carW * 0.5, carH * 0.3);
      });

      // Player car
      const carY = h - 100;
      const carW = 80;
      const carH = 45;
      const tilt = -g.x * 0.08;

      ctx.save();
      ctx.translate(w / 2, carY);
      ctx.rotate(tilt);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-carW/2, carH * 0.3, carW, 10);

      // Body
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.moveTo(-carW/2, carH * 0.2);
      ctx.lineTo(-carW/2 + 8, -carH * 0.4);
      ctx.lineTo(carW/2 - 8, -carH * 0.4);
      ctx.lineTo(carW/2, carH * 0.2);
      ctx.closePath();
      ctx.fill();

      // Roof
      ctx.beginPath();
      ctx.moveTo(-carW/3, -carH * 0.4);
      ctx.lineTo(-carW/4, -carH * 0.8);
      ctx.lineTo(carW/4, -carH * 0.8);
      ctx.lineTo(carW/3, -carH * 0.4);
      ctx.closePath();
      ctx.fill();

      // Windshield
      ctx.fillStyle = '#5dade2';
      ctx.beginPath();
      ctx.moveTo(-carW/4 + 3, -carH * 0.45);
      ctx.lineTo(-carW/5, -carH * 0.75);
      ctx.lineTo(carW/5, -carH * 0.75);
      ctx.lineTo(carW/4 - 3, -carH * 0.45);
      ctx.closePath();
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(-carW/2.3, carH * 0.15, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(carW/2.3, carH * 0.15, 9, 0, Math.PI * 2); ctx.fill();

      // Rims
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(-carW/2.3, carH * 0.15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(carW/2.3, carH * 0.15, 4, 0, Math.PI * 2); ctx.fill();

      // Nitro flames
      if (keys[' '] && g.nitro > 0 && g.speed > 30) {
        const flameH = 20 + Math.random() * 15;
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-carW/4, carH * 0.2);
        ctx.lineTo(-carW/4 - 6, carH * 0.2 + flameH);
        ctx.lineTo(-carW/4 + 6, carH * 0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(carW/4, carH * 0.2);
        ctx.lineTo(carW/4 - 6, carH * 0.2 + flameH);
        ctx.lineTo(carW/4 + 6, carH * 0.2);
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(-carW/4, carH * 0.2);
        ctx.lineTo(-carW/4 - 3, carH * 0.2 + flameH * 0.6);
        ctx.lineTo(-carW/4 + 3, carH * 0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(carW/4, carH * 0.2);
        ctx.lineTo(carW/4 - 3, carH * 0.2 + flameH * 0.6);
        ctx.lineTo(carW/4 + 3, carH * 0.2);
        ctx.fill();
      }

      ctx.restore();

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, vehicle, totalLaps, finishRace]);

  // UI Screens
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="arcade-title text-5xl md:text-7xl neon-glow mb-4 text-center">MOXIE SPEED</h1>
        <p className="text-xl mb-6 text-green-400">Race Against 7 Opponents - 100 Levels</p>
        <div className="mb-6">
          <p className="text-yellow-400 mb-2 text-center">Select Your Ride:</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
            {VEHICLES.filter(v => v.unlockLevel <= level).map((v, i) => (
              <button key={i} onClick={() => setSelectedVehicle(i)}
                className={`px-3 py-2 rounded ${selectedVehicle === i ? 'bg-green-600 text-black' : 'bg-gray-700'}`}
                style={{ borderColor: v.color, borderWidth: 2 }}>
                <div style={{ color: selectedVehicle === i ? '#000' : v.color }}>{v.name}</div>
                <div className="text-xs text-gray-400">{v.maxSpeed} mph</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={startGame} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-8 py-4 rounded-lg text-xl font-bold mb-6">
          <Play size={24} /> RACE LEVEL {level}
        </button>
        <div className="text-center text-green-500 text-sm mb-4">
          <p>UP/W - Accelerate | DOWN/S - Brake</p>
          <p>LEFT/RIGHT or A/D - Steer | SPACE - Nitro</p>
        </div>
        <div className="flex items-center gap-4">
          {bestTime && <p className="text-yellow-400"><Trophy className="inline mr-1" size={16}/> Best: {bestTime.toFixed(2)}s</p>}
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-green-400">
            {soundEnabled ? <Volume2 size={24}/> : <VolumeX size={24}/>}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <h1 className="arcade-title text-9xl text-yellow-400 neon-glow animate-pulse">{countdown}</h1>
        <p className="text-3xl mt-4 text-green-400">GET READY!</p>
      </div>
    );
  }

  if (gameState === 'victory') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-5xl text-yellow-400 neon-glow mb-4">
          <Trophy className="inline"/> {finalPosition === 1 ? 'WINNER!' : `${finalPosition}${finalPosition === 2 ? 'ND' : 'RD'} PLACE!`}
        </h2>
        <p className="text-2xl mb-2">Level {level} Complete!</p>
        <p className="text-2xl mb-4">Time: {raceTime.toFixed(2)}s</p>
        <button onClick={nextLevel} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold text-xl">
          <Flag size={24}/> NEXT RACE
        </button>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-5xl text-red-500 mb-4">{finalPosition}TH PLACE</h2>
        <p className="text-2xl mb-4">Top 3 needed to advance!</p>
        <div className="flex gap-4">
          <button onClick={startGame} className="flex items-center gap-2 bg-yellow-600 text-black px-6 py-3 rounded-lg font-bold">
            <RotateCcw size={20}/> RETRY
          </button>
          <button onClick={resetGame} className="bg-gray-600 text-white px-6 py-3 rounded-lg font-bold">MENU</button>
        </div>
      </div>
    );
  }

  if (gameState === 'champion') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-5xl text-yellow-400 neon-glow mb-4">
          <Trophy className="inline"/> WORLD CHAMPION! <Trophy className="inline"/>
        </h2>
        <p className="text-2xl mb-4">All 100 levels conquered!</p>
        <button onClick={resetGame} className="flex items-center gap-2 bg-green-600 text-black px-6 py-3 rounded-lg font-bold">
          <RotateCcw size={20}/> PLAY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 bg-black">
      <div className="w-full max-w-4xl flex justify-between items-center mb-1 px-2 text-white">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-bold" style={{ color: position <= 3 ? '#22c55e' : '#ef4444' }}>P{position}</span>
          <span className="text-yellow-400 text-lg">LAP {lap}/{totalLaps}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-400 font-mono text-2xl">{speed} MPH</span>
          <span className="text-green-400 text-lg">{raceTime.toFixed(1)}s</span>
        </div>
      </div>
      <div className="w-full max-w-4xl flex items-center gap-2 mb-1 px-2">
        <span className="text-yellow-400 text-xs font-bold">NITRO</span>
        <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500" style={{ width: `${nitro}%` }}/>
        </div>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="border-4 border-green-500 rounded-lg"/>
      <div className="flex gap-2 mt-2 md:hidden">
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowLeft'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowLeft'] = false; }} className="bg-gray-700 text-white px-6 py-4 rounded-lg font-bold">LEFT</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowDown'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowDown'] = false; }} className="bg-red-700 text-white px-6 py-4 rounded-lg font-bold">BRAKE</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowUp'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowUp'] = false; }} className="bg-green-700 text-white px-6 py-4 rounded-lg font-bold">GAS</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys[' '] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys[' '] = false; }} className="bg-yellow-600 text-black px-4 py-4 rounded-lg font-bold">N2O</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowRight'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowRight'] = false; }} className="bg-gray-700 text-white px-6 py-4 rounded-lg font-bold">RIGHT</button>
      </div>
    </div>
  );
}
