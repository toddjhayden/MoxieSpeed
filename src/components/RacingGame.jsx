import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Trophy, Flag } from 'lucide-react';
import SoundManager from '../utils/SoundManager';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const ROAD_WIDTH = 800;
const SEGMENT_LENGTH = 200;
const RUMBLE_LENGTH = 3;
const LANES = 3;

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

const COLORS = {
  SKY: '#72D7EE',
  TREE: '#005108',
  FOG: '#005108',
  LIGHT: { road: '#6B6B6B', grass: '#10AA10', rumble: '#555555', lane: '#CCCCCC' },
  DARK: { road: '#696969', grass: '#009A00', rumble: '#BBBBBB', lane: '#696969' },
  START: { road: '#FFFFFF', grass: '#10AA10', rumble: '#FFFFFF', lane: '#000000' },
};

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

  const createTrack = useCallback((level) => {
    const segments = [];
    const trackLength = 200 + level * 10;

    const addSegment = (curve, y) => {
      const n = segments.length;
      segments.push({
        index: n,
        p1: { world: { y: y, z: n * SEGMENT_LENGTH }, camera: {}, screen: {} },
        p2: { world: { y: y, z: (n + 1) * SEGMENT_LENGTH }, camera: {}, screen: {} },
        curve: curve,
        color: Math.floor(n / RUMBLE_LENGTH) % 2 ? COLORS.DARK : COLORS.LIGHT,
      });
    };

    const addRoad = (enter, hold, leave, curve, y) => {
      for (let i = 0; i < enter; i++) addSegment(curve * (i / enter), y);
      for (let i = 0; i < hold; i++) addSegment(curve, y);
      for (let i = 0; i < leave; i++) addSegment(curve * (1 - i / leave), y);
    };

    // Starting straight
    for (let i = 0; i < 25; i++) addSegment(0, 0);

    // Generate curves based on level
    const curviness = 2 + level * 0.5;
    for (let i = 0; i < (trackLength - 50) / 25; i++) {
      const curve = (Math.sin(i * 0.7) * curviness);
      addRoad(5, 15, 5, curve, 0);
    }

    // Finish straight
    for (let i = 0; i < 25; i++) addSegment(0, 0);

    return segments;
  }, []);

  const createOpponents = useCallback((trackLength, level) => {
    const opponents = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      opponents.push({
        offset: (Math.random() - 0.5) * 2,
        z: (i + 1) * trackLength * SEGMENT_LENGTH / (count + 2),
        speed: 150 + Math.random() * 50 + level * 3,
        color: `hsl(${(i * 51) % 360}, 70%, 50%)`,
        lap: 1,
        finished: false,
      });
    }
    return opponents;
  }, []);

  const startGame = useCallback(async () => {
    if (soundManagerRef.current) {
      await soundManagerRef.current.initialize();
      soundManagerRef.current.stopMenuMusic();
    }

    const segments = createTrack(level);
    const opponents = createOpponents(segments.length, level);

    gameRef.current = {
      segments,
      opponents,
      trackLength: segments.length * SEGMENT_LENGTH,
      position: 0,
      playerX: 0,
      speed: 0,
      lap: 1,
      keys: {},
      startTime: 0,
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
  }, [level, createTrack, createOpponents]);

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
    if (level >= 100) {
      setGameState('champion');
      return;
    }
    setLevel((prev) => prev + 1);
    startGame();
  }, [level, startGame]);

  const resetGame = useCallback(() => {
    setLevel(1);
    setGameState('menu');
  }, []);

  // Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      const g = gameRef.current;
      if (!g) return;

      const keys = g.keys;
      const maxSpeed = vehicle.maxSpeed * (g.nitro < 100 && keys[' '] ? 1.5 : 1);
      const accel = vehicle.accel;
      const handling = vehicle.handling;
      const dt = 1 / 60;

      if (!g.finished) {
        // Accelerate / Brake
        if (keys['ArrowUp'] || keys['w'] || keys['W']) {
          g.speed = Math.min(g.speed + accel, maxSpeed);
        } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
          g.speed = Math.max(g.speed - accel * 2, 0);
        } else {
          g.speed = Math.max(g.speed - accel * 0.5, 0);
        }

        // Nitro
        if (keys[' '] && g.nitro > 0 && g.speed > 50) {
          g.nitro -= 0.5;
          g.speed = Math.min(g.speed + accel * 0.5, maxSpeed);
        } else if (g.nitro < 100) {
          g.nitro += 0.1;
        }

        // Steering
        const dx = dt * 2 * (g.speed / maxSpeed) * handling;
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) g.playerX -= dx;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) g.playerX += dx;

        // Keep on road
        if (Math.abs(g.playerX) > 2) {
          g.playerX = Math.max(-2, Math.min(2, g.playerX));
          g.speed *= 0.95;
        } else if (Math.abs(g.playerX) > 1) {
          g.speed *= 0.98;
        }

        // Move forward
        g.position += g.speed * dt;

        // Apply curve
        const segIdx = Math.floor(g.position / SEGMENT_LENGTH) % g.segments.length;
        const seg = g.segments[segIdx];
        if (seg) {
          g.playerX += seg.curve * g.speed * 0.0001;
        }

        // Lap
        if (g.position >= g.trackLength) {
          g.position -= g.trackLength;
          g.lap++;
          setLap(g.lap);
          soundManagerRef.current?.levelUp();
          if (g.lap > totalLaps) {
            g.finished = true;
            let pos = 1;
            g.opponents.forEach((o) => { if (o.finished) pos++; });
            finishRace(pos);
          }
        }

        // Opponents
        g.opponents.forEach((opp) => {
          if (opp.finished) return;
          opp.z += opp.speed * dt;
          opp.offset += (Math.sin(opp.z * 0.002) * 0.5 - opp.offset) * 0.1;
          if (opp.z >= g.trackLength) {
            opp.z -= g.trackLength;
            opp.lap++;
            if (opp.lap > totalLaps) opp.finished = true;
          }
          // Collision
          const dz = Math.abs(opp.z - g.position);
          const dx = Math.abs(opp.offset - g.playerX);
          if (dz < SEGMENT_LENGTH && dx < 0.7) {
            if (g.position > opp.z) g.speed *= 0.7;
            else opp.speed *= 0.7;
            g.playerX += (g.playerX - opp.offset) * 0.3;
          }
        });

        // Position calc
        let pos = 1;
        g.opponents.forEach((opp) => {
          const oppProg = opp.lap * g.trackLength + opp.z;
          const playerProg = g.lap * g.trackLength + g.position;
          if (oppProg > playerProg) pos++;
        });
        setPosition(pos);
        setSpeed(Math.floor(g.speed));
        setNitro(Math.floor(Math.max(0, g.nitro)));
        setRaceTime((performance.now() - g.startTime) / 1000);
      }

      // RENDER
      const width = CANVAS_WIDTH;
      const height = CANVAS_HEIGHT;
      const roadWidth = ROAD_WIDTH;
      const segmentLength = SEGMENT_LENGTH;
      const cameraHeight = 1000;
      const cameraDepth = 1 / Math.tan(80 * Math.PI / 360);
      const drawDistance = 100;

      // Sky
      ctx.fillStyle = '#1a0a3e';
      ctx.fillRect(0, 0, width, height);

      // Horizon
      const horizonY = height / 2;

      // Render segments back to front
      const baseSegment = Math.floor(g.position / segmentLength);
      const basePercent = (g.position % segmentLength) / segmentLength;

      let maxy = height;
      let x = 0;
      let dx = -(g.segments[baseSegment % g.segments.length]?.curve || 0) * basePercent;

      for (let n = 0; n < drawDistance; n++) {
        const segIdx = (baseSegment + n) % g.segments.length;
        const seg = g.segments[segIdx];
        if (!seg) continue;

        const camZ = g.position - (n === 0 ? 0 : 0);
        const projZ = (n * segmentLength) + (segmentLength - (g.position % segmentLength));

        if (projZ <= 0) continue;

        const scale = cameraDepth / projZ;
        const projY = horizonY - scale * cameraHeight * height;
        const projW = scale * roadWidth * width / 2;
        const projX = width / 2 + (x - g.playerX * projW);

        seg.p1.screen = { x: projX, y: projY, w: projW };

        x += dx;
        dx += seg.curve;

        if (n > 0 && projY < maxy) {
          const prevSeg = g.segments[(baseSegment + n - 1) % g.segments.length];
          const p1 = prevSeg.p1.screen;
          const p2 = seg.p1.screen;

          // Grass
          ctx.fillStyle = seg.color.grass;
          ctx.fillRect(0, p2.y, width, p1.y - p2.y);

          // Rumble
          const rumbleW1 = p1.w * 1.15;
          const rumbleW2 = p2.w * 1.15;
          ctx.fillStyle = seg.color.rumble;
          ctx.beginPath();
          ctx.moveTo(p1.x - rumbleW1, p1.y);
          ctx.lineTo(p1.x + rumbleW1, p1.y);
          ctx.lineTo(p2.x + rumbleW2, p2.y);
          ctx.lineTo(p2.x - rumbleW2, p2.y);
          ctx.fill();

          // Road
          ctx.fillStyle = seg.color.road;
          ctx.beginPath();
          ctx.moveTo(p1.x - p1.w, p1.y);
          ctx.lineTo(p1.x + p1.w, p1.y);
          ctx.lineTo(p2.x + p2.w, p2.y);
          ctx.lineTo(p2.x - p2.w, p2.y);
          ctx.fill();

          // Lane markers
          if (seg.color === COLORS.LIGHT) {
            ctx.fillStyle = '#FFFFFF';
            const laneW = 0.02;
            for (let l = -0.5; l <= 0.5; l += 0.5) {
              if (l === 0) continue;
              ctx.beginPath();
              ctx.moveTo(p1.x + p1.w * l - p1.w * laneW, p1.y);
              ctx.lineTo(p1.x + p1.w * l + p1.w * laneW, p1.y);
              ctx.lineTo(p2.x + p2.w * l + p2.w * laneW, p2.y);
              ctx.lineTo(p2.x + p2.w * l - p2.w * laneW, p2.y);
              ctx.fill();
            }
          }

          // Start line
          if (segIdx < 3) {
            ctx.fillStyle = segIdx % 2 ? '#000' : '#FFF';
            const lineH = Math.max(1, (p1.y - p2.y) * 0.3);
            ctx.fillRect(p2.x - p2.w, p2.y, p2.w * 2, lineH);
          }

          maxy = p2.y;
        }
      }

      // Render opponents
      g.opponents.forEach((opp) => {
        let oppZ = opp.z - g.position;
        if (oppZ < 0) oppZ += g.trackLength;
        if (oppZ < 0 || oppZ > segmentLength * drawDistance) return;

        const scale = cameraDepth / oppZ;
        const projY = horizonY - scale * cameraHeight * height;
        const projW = scale * roadWidth * width / 2;
        const projX = width / 2 + (opp.offset - g.playerX) * projW;

        if (projY < horizonY || projY > height - 50) return;

        const carW = projW * 0.15;
        const carH = carW * 0.6;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(projX - carW / 2, projY - carH * 0.1, carW, carH * 0.15);

        // Body
        ctx.fillStyle = opp.color;
        ctx.fillRect(projX - carW / 2, projY - carH, carW, carH * 0.7);

        // Roof
        ctx.fillRect(projX - carW / 3, projY - carH * 1.3, carW * 0.66, carH * 0.3);

        // Windows
        ctx.fillStyle = '#333';
        ctx.fillRect(projX - carW / 4, projY - carH * 1.25, carW * 0.5, carH * 0.2);
      });

      // Player car at bottom
      const carY = height - 80;
      const carW = 90;
      const carH = 45;
      const tilt = -g.playerX * 0.05;

      ctx.save();
      ctx.translate(width / 2, carY);
      ctx.rotate(tilt);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-carW / 2, carH * 0.35, carW, 8);

      // Body
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.moveTo(-carW / 2, carH * 0.3);
      ctx.lineTo(-carW / 2 + 10, -carH * 0.3);
      ctx.lineTo(carW / 2 - 10, -carH * 0.3);
      ctx.lineTo(carW / 2, carH * 0.3);
      ctx.closePath();
      ctx.fill();

      // Roof
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.moveTo(-carW / 3, -carH * 0.3);
      ctx.lineTo(-carW / 4, -carH * 0.7);
      ctx.lineTo(carW / 4, -carH * 0.7);
      ctx.lineTo(carW / 3, -carH * 0.3);
      ctx.closePath();
      ctx.fill();

      // Windshield
      ctx.fillStyle = '#87CEEB';
      ctx.beginPath();
      ctx.moveTo(-carW / 4 + 5, -carH * 0.35);
      ctx.lineTo(-carW / 5, -carH * 0.65);
      ctx.lineTo(carW / 5, -carH * 0.65);
      ctx.lineTo(carW / 4 - 5, -carH * 0.35);
      ctx.closePath();
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-carW / 2.5, carH * 0.2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(carW / 2.5, carH * 0.2, 10, 0, Math.PI * 2);
      ctx.fill();

      // Rims
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(-carW / 2.5, carH * 0.2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(carW / 2.5, carH * 0.2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Nitro flames
      if (keys[' '] && g.nitro > 0 && g.speed > 50) {
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.moveTo(-carW / 4, carH * 0.3);
        ctx.lineTo(-carW / 4 - 8, carH * 0.3 + 25 + Math.random() * 15);
        ctx.lineTo(-carW / 4 + 8, carH * 0.3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(carW / 4, carH * 0.3);
        ctx.lineTo(carW / 4 - 8, carH * 0.3 + 25 + Math.random() * 15);
        ctx.lineTo(carW / 4 + 8, carH * 0.3);
        ctx.fill();
      }

      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, vehicle, totalLaps, finishRace]);

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="arcade-title text-4xl md:text-6xl neon-glow mb-4 text-center">MOXIE SPEED</h1>
        <p className="text-lg mb-6 text-green-400">Outrun the Competition - 100 Levels</p>

        <div className="mb-6 text-center">
          <p className="text-yellow-400 mb-2">Select Your Ride:</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
            {VEHICLES.filter((v) => v.unlockLevel <= level).map((v, i) => (
              <button
                key={i}
                onClick={() => setSelectedVehicle(i)}
                className={`px-3 py-2 rounded text-sm ${selectedVehicle === i ? 'bg-green-600 text-black' : 'bg-gray-700'}`}
                style={{ borderColor: v.color, borderWidth: 2 }}
              >
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
          <p>UP / W - Accelerate | DOWN / S - Brake</p>
          <p>LEFT / RIGHT or A / D - Steer</p>
          <p>SPACE - Nitro Boost</p>
        </div>

        <div className="flex items-center gap-4">
          {bestTime && (
            <p className="text-yellow-400">
              <Trophy className="inline mr-1" size={16} /> Best: {bestTime.toFixed(2)}s
            </p>
          )}
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-green-400">
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <h1 className="arcade-title text-8xl text-yellow-400 neon-glow animate-pulse">{countdown}</h1>
        <p className="text-2xl mt-4 text-green-400">GET READY!</p>
      </div>
    );
  }

  if (gameState === 'victory') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-yellow-400 neon-glow mb-4">
          <Trophy className="inline" /> {finalPosition === 1 ? 'WINNER!' : `${finalPosition}${finalPosition === 2 ? 'ND' : 'RD'} PLACE!`}
        </h2>
        <p className="text-xl mb-2">Level {level} Complete!</p>
        <p className="text-xl mb-4">Time: {raceTime.toFixed(2)}s</p>
        <button onClick={nextLevel} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold">
          <Flag size={20} /> NEXT RACE
        </button>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-red-500 mb-4">{finalPosition}TH PLACE</h2>
        <p className="text-xl mb-2">Top 3 needed to advance!</p>
        <p className="text-xl mb-4">Time: {raceTime.toFixed(2)}s</p>
        <div className="flex gap-4">
          <button onClick={startGame} className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-3 rounded-lg font-bold">
            <RotateCcw size={20} /> RETRY
          </button>
          <button onClick={resetGame} className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-bold">MENU</button>
        </div>
      </div>
    );
  }

  if (gameState === 'champion') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-yellow-400 neon-glow mb-4">
          <Trophy className="inline" /> WORLD CHAMPION! <Trophy className="inline" />
        </h2>
        <p className="text-xl mb-4">You conquered all 100 levels!</p>
        <button onClick={resetGame} className="flex items-center gap-2 bg-green-600 text-black px-6 py-3 rounded-lg font-bold">
          <RotateCcw size={20} /> PLAY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 bg-black">
      <div className="w-full max-w-4xl flex justify-between items-center mb-1 px-2 text-white text-sm">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold" style={{ color: position <= 3 ? '#22c55e' : '#ef4444' }}>P{position}</span>
          <span className="text-yellow-400">LAP {lap}/{totalLaps}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-400 font-mono text-xl">{speed} MPH</span>
          <span className="text-green-400">{raceTime.toFixed(1)}s</span>
        </div>
      </div>

      <div className="w-full max-w-4xl flex items-center gap-2 mb-1 px-2">
        <span className="text-yellow-400 text-xs">NITRO</span>
        <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500" style={{ width: `${nitro}%` }} />
        </div>
      </div>

      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-2 border-green-500 rounded" />

      <div className="flex gap-2 mt-2 md:hidden">
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowLeft'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowLeft'] = false; }} className="bg-gray-700 text-white px-6 py-4 rounded-lg">LEFT</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowDown'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowDown'] = false; }} className="bg-red-700 text-white px-6 py-4 rounded-lg">BRAKE</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowUp'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowUp'] = false; }} className="bg-green-700 text-white px-6 py-4 rounded-lg">GAS</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys[' '] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys[' '] = false; }} className="bg-yellow-600 text-black px-4 py-4 rounded-lg">N2O</button>
        <button onTouchStart={() => { if (gameRef.current) gameRef.current.keys['ArrowRight'] = true; }} onTouchEnd={() => { if (gameRef.current) gameRef.current.keys['ArrowRight'] = false; }} className="bg-gray-700 text-white px-6 py-4 rounded-lg">RIGHT</button>
      </div>
    </div>
  );
}
