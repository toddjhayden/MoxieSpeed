import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Trophy, Flag } from 'lucide-react';
import SoundManager from '../utils/SoundManager';

// Game constants
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const ROAD_WIDTH = 2000;
const SEGMENT_LENGTH = 200;
const DRAW_DISTANCE = 150;
const FOV = 100;
const CAMERA_HEIGHT = 1000;
const CAMERA_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);

// Vehicles with stats
const VEHICLES = [
  { name: 'Stock Racer', maxSpeed: 280, accel: 0.8, handling: 0.8, color: '#e74c3c', unlockLevel: 1 },
  { name: 'Street Machine', maxSpeed: 300, accel: 0.85, handling: 0.85, color: '#3498db', unlockLevel: 3 },
  { name: 'Muscle Beast', maxSpeed: 320, accel: 0.9, handling: 0.75, color: '#f39c12', unlockLevel: 5 },
  { name: 'Euro Sport', maxSpeed: 340, accel: 0.85, handling: 0.95, color: '#2ecc71', unlockLevel: 10 },
  { name: 'Super GT', maxSpeed: 360, accel: 0.92, handling: 0.9, color: '#9b59b6', unlockLevel: 20 },
  { name: 'Hyper Machine', maxSpeed: 380, accel: 0.95, handling: 0.88, color: '#1abc9c', unlockLevel: 35 },
  { name: 'Proto Racer', maxSpeed: 400, accel: 0.98, handling: 0.92, color: '#e91e63', unlockLevel: 50 },
  { name: 'Apex Predator', maxSpeed: 420, accel: 1.0, handling: 0.95, color: '#ff5722', unlockLevel: 70 },
  { name: 'Lightning', maxSpeed: 450, accel: 1.0, handling: 1.0, color: '#00bcd4', unlockLevel: 90 },
];

// Colors
const COLORS = {
  SKY: '#72D7EE',
  HORIZON: '#0080C0',
  TREE: '#005108',
  GRASS_LIGHT: '#10AA10',
  GRASS_DARK: '#009A00',
  RUMBLE_LIGHT: '#BBB',
  RUMBLE_DARK: '#555',
  ROAD_LIGHT: '#6B6B6B',
  ROAD_DARK: '#696969',
  LANE_LIGHT: '#CCCCCC',
  LANE_DARK: '#696969',
  START_LIGHT: '#EEE',
  START_DARK: '#000',
};

// Generate track with curves and hills
const generateTrack = (level) => {
  const segments = [];
  const trackLength = 300 + level * 20;

  const addRoad = (enter, hold, leave, curve, hill) => {
    const startIndex = segments.length;
    for (let i = 0; i < enter; i++) {
      segments.push({ curve: (i / enter) * curve, hill: (i / enter) * hill });
    }
    for (let i = 0; i < hold; i++) {
      segments.push({ curve, hill });
    }
    for (let i = 0; i < leave; i++) {
      segments.push({ curve: curve - (i / leave) * curve, hill: hill - (i / leave) * hill });
    }
  };

  // Starting straight
  addRoad(10, 20, 10, 0, 0);

  // Generate varied track based on level
  const curves = [0, 2, -2, 4, -4, 3, -3];
  const hills = [0, 20, -20, 40, -40, 30, -30];

  for (let i = 0; i < (trackLength - 40) / 30; i++) {
    const curveIndex = (i + level) % curves.length;
    const hillIndex = (i + level + 3) % hills.length;
    const intensity = 1 + (level * 0.1);
    addRoad(
      5 + Math.floor(Math.random() * 10),
      10 + Math.floor(Math.random() * 20),
      5 + Math.floor(Math.random() * 10),
      curves[curveIndex] * intensity,
      hills[hillIndex] * intensity
    );
  }

  // Finish straight
  addRoad(10, 20, 10, 0, 0);

  // Calculate 3D coordinates
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < segments.length; i++) {
    segments[i].index = i;
    segments[i].p1 = { world: { x, y, z }, camera: {}, screen: {} };
    z += SEGMENT_LENGTH;
    x += segments[i].curve;
    y += segments[i].hill;
    segments[i].p2 = { world: { x, y, z }, camera: {}, screen: {} };
    segments[i].color = Math.floor(i / 3) % 2 ? 'light' : 'dark';
  }

  return segments;
};

// Generate AI opponents
const generateOpponents = (count, trackLength, level) => {
  const opponents = [];
  const spacing = trackLength / (count + 1);

  for (let i = 0; i < count; i++) {
    const skill = 0.7 + Math.random() * 0.3 + (level * 0.005);
    opponents.push({
      id: i,
      z: spacing * (i + 1) * SEGMENT_LENGTH,
      x: (Math.random() - 0.5) * 1.5,
      speed: 150 + Math.random() * 100 + level * 2,
      maxSpeed: 200 + Math.random() * 80 + level * 3,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      skill,
      lap: 0,
      finished: false,
    });
  }
  return opponents;
};

const project = (p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) => {
  p.camera.x = (p.world.x || 0) - cameraX;
  p.camera.y = (p.world.y || 0) - cameraY;
  p.camera.z = (p.world.z || 0) - cameraZ;
  p.screen.scale = cameraDepth / p.camera.z;
  p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
  p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
  p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
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
  const [bestTime, setBestTime] = useState(() => {
    const saved = localStorage.getItem('moxiespeed-besttime');
    return saved ? parseFloat(saved) : null;
  });
  const [countdown, setCountdown] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [finalPosition, setFinalPosition] = useState(null);

  const soundManagerRef = useRef(null);
  const gameRef = useRef({
    playerX: 0,
    playerZ: 0,
    speed: 0,
    position: 0,
    segments: [],
    opponents: [],
    keys: {},
    lap: 1,
    trackLength: 0,
    startTime: 0,
    nitro: 100,
    usingNitro: false,
    finished: false,
  });

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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      gameRef.current.keys[e.key] = true;
      if (e.key === ' ') e.preventDefault();
    };
    const handleKeyUp = (e) => {
      gameRef.current.keys[e.key] = false;
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

    const segments = generateTrack(level);
    const trackLength = segments.length * SEGMENT_LENGTH;
    const opponents = generateOpponents(7, segments.length, level);

    gameRef.current = {
      playerX: 0,
      playerZ: 0,
      speed: 0,
      segments,
      opponents,
      keys: {},
      lap: 1,
      trackLength,
      startTime: 0,
      nitro: 100,
      usingNitro: false,
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

    // Countdown
    setTimeout(() => setCountdown(2), 1000);
    setTimeout(() => setCountdown(1), 2000);
    setTimeout(() => {
      setCountdown(0);
      setGameState('playing');
      gameRef.current.startTime = performance.now();
      soundManagerRef.current?.startRace();
    }, 3000);
  }, [level]);

  const finishRace = useCallback((pos) => {
    const time = (performance.now() - gameRef.current.startTime) / 1000;
    setRaceTime(time);
    setFinalPosition(pos);

    if (!bestTime || time < bestTime) {
      setBestTime(time);
    }

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
    setLevel(prev => prev + 1);
    startGame();
  }, [level, startGame]);

  const resetGame = useCallback(() => {
    setLevel(1);
    setGameState('menu');
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const gameLoop = () => {
      const g = gameRef.current;
      const keys = g.keys;
      const dt = 1 / 60;
      const maxSpeed = vehicle.maxSpeed * (g.usingNitro ? 1.3 : 1);
      const accel = vehicle.accel * 8000;
      const handling = vehicle.handling;

      if (!g.finished) {
        // Input
        if (keys['ArrowUp'] || keys['w'] || keys['W']) {
          g.speed += accel * dt;
        } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
          g.speed -= accel * 2 * dt;
        } else {
          g.speed -= accel * 0.5 * dt;
        }

        // Nitro
        g.usingNitro = (keys[' '] && g.nitro > 0 && g.speed > 50);
        if (g.usingNitro) {
          g.nitro -= 30 * dt;
          g.speed += accel * 0.5 * dt;
        } else if (g.nitro < 100) {
          g.nitro += 5 * dt;
        }

        // Steering
        const steerAmount = handling * 3 * (g.speed / maxSpeed);
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
          g.playerX -= steerAmount * dt;
        }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) {
          g.playerX += steerAmount * dt;
        }

        // Speed limits
        g.speed = Math.max(0, Math.min(maxSpeed, g.speed));

        // Off-road penalty
        if (Math.abs(g.playerX) > 1.2) {
          g.speed *= 0.97;
          g.playerX = Math.max(-2, Math.min(2, g.playerX));
        }

        // Update position
        g.playerZ += g.speed * dt;

        // Get current segment for curve
        const segmentIndex = Math.floor(g.playerZ / SEGMENT_LENGTH) % g.segments.length;
        const segment = g.segments[segmentIndex];

        // Apply curve to player (centrifugal force)
        if (segment) {
          g.playerX += (segment.curve * g.speed / maxSpeed) * 0.003;
        }

        // Lap detection
        if (g.playerZ >= g.trackLength) {
          g.playerZ -= g.trackLength;
          g.lap++;
          setLap(g.lap);
          soundManagerRef.current?.levelUp();

          if (g.lap > totalLaps) {
            g.finished = true;
            // Calculate final position
            let pos = 1;
            g.opponents.forEach(opp => {
              if (!opp.finished && opp.lap * g.trackLength + opp.z > g.lap * g.trackLength + g.playerZ) {
                pos++;
              }
              if (opp.finished) pos++;
            });
            finishRace(pos);
          }
        }

        // Update opponents
        g.opponents.forEach(opp => {
          if (opp.finished) return;

          // AI driving
          const targetX = Math.sin(opp.z * 0.001) * 0.8;
          opp.x += (targetX - opp.x) * 0.02;

          // Speed variation
          opp.speed += (opp.maxSpeed * opp.skill - opp.speed) * 0.1;
          opp.z += opp.speed * dt;

          // Opponent lap
          if (opp.z >= g.trackLength) {
            opp.z -= g.trackLength;
            opp.lap++;
            if (opp.lap > totalLaps) {
              opp.finished = true;
            }
          }

          // Collision with player
          const dz = Math.abs(opp.z - g.playerZ);
          const dx = Math.abs(opp.x - g.playerX);
          if (dz < SEGMENT_LENGTH * 0.8 && dx < 0.8) {
            // Bump
            if (g.playerZ > opp.z) {
              g.speed *= 0.7;
            } else {
              opp.speed *= 0.7;
            }
            g.playerX += (g.playerX - opp.x) * 0.5;
          }
        });

        // Calculate position
        let pos = 1;
        g.opponents.forEach(opp => {
          const oppProgress = opp.lap * g.trackLength + opp.z;
          const playerProgress = g.lap * g.trackLength + g.playerZ;
          if (oppProgress > playerProgress) pos++;
        });
        setPosition(pos);

        // Update state
        setSpeed(Math.floor(g.speed));
        setNitro(Math.floor(g.nitro));
        setRaceTime((performance.now() - g.startTime) / 1000);
      }

      // RENDERING
      const width = CANVAS_WIDTH;
      const height = CANVAS_HEIGHT;
      const baseSegment = Math.floor(g.playerZ / SEGMENT_LENGTH);

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height / 2);
      skyGrad.addColorStop(0, '#1a0a3e');
      skyGrad.addColorStop(1, '#4a2a7e');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height / 2);

      // Ground
      ctx.fillStyle = COLORS.GRASS_DARK;
      ctx.fillRect(0, height / 2, width, height / 2);

      // Render road segments
      let maxY = height;
      const cameraX = g.playerX * ROAD_WIDTH;
      const cameraY = CAMERA_HEIGHT;
      const cameraZ = g.playerZ - 500;

      for (let n = DRAW_DISTANCE - 1; n >= 0; n--) {
        const segIndex = (baseSegment + n) % g.segments.length;
        const seg = g.segments[segIndex];
        if (!seg) continue;

        const looped = (baseSegment + n) >= g.segments.length;
        const offsetZ = looped ? g.trackLength : 0;

        const p1 = { world: { ...seg.p1.world, z: seg.p1.world.z + offsetZ }, camera: {}, screen: {} };
        const p2 = { world: { ...seg.p2.world, z: seg.p2.world.z + offsetZ }, camera: {}, screen: {} };

        project(p1, cameraX, cameraY, cameraZ, CAMERA_DEPTH, width, height, ROAD_WIDTH);
        project(p2, cameraX, cameraY, cameraZ, CAMERA_DEPTH, width, height, ROAD_WIDTH);

        if (p1.camera.z <= 0 || p2.screen.y >= maxY) continue;

        const isLight = seg.color === 'light';

        // Grass
        ctx.fillStyle = isLight ? COLORS.GRASS_LIGHT : COLORS.GRASS_DARK;
        ctx.fillRect(0, p2.screen.y, width, p1.screen.y - p2.screen.y);

        // Road
        const roadColor = isLight ? COLORS.ROAD_LIGHT : COLORS.ROAD_DARK;
        const rumbleColor = isLight ? COLORS.RUMBLE_LIGHT : COLORS.RUMBLE_DARK;
        const laneColor = isLight ? COLORS.LANE_LIGHT : COLORS.LANE_DARK;

        // Rumble strips
        ctx.fillStyle = rumbleColor;
        ctx.beginPath();
        ctx.moveTo(p1.screen.x - p1.screen.w * 1.2, p1.screen.y);
        ctx.lineTo(p2.screen.x - p2.screen.w * 1.2, p2.screen.y);
        ctx.lineTo(p2.screen.x + p2.screen.w * 1.2, p2.screen.y);
        ctx.lineTo(p1.screen.x + p1.screen.w * 1.2, p1.screen.y);
        ctx.fill();

        // Road surface
        ctx.fillStyle = roadColor;
        ctx.beginPath();
        ctx.moveTo(p1.screen.x - p1.screen.w, p1.screen.y);
        ctx.lineTo(p2.screen.x - p2.screen.w, p2.screen.y);
        ctx.lineTo(p2.screen.x + p2.screen.w, p2.screen.y);
        ctx.lineTo(p1.screen.x + p1.screen.w, p1.screen.y);
        ctx.fill();

        // Lane markings
        if (isLight) {
          const laneW1 = p1.screen.w * 0.02;
          const laneW2 = p2.screen.w * 0.02;
          for (let lane = -1; lane <= 1; lane += 0.5) {
            if (lane === 0) continue;
            ctx.fillStyle = COLORS.LANE_LIGHT;
            ctx.beginPath();
            ctx.moveTo(p1.screen.x + p1.screen.w * lane - laneW1, p1.screen.y);
            ctx.lineTo(p2.screen.x + p2.screen.w * lane - laneW2, p2.screen.y);
            ctx.lineTo(p2.screen.x + p2.screen.w * lane + laneW2, p2.screen.y);
            ctx.lineTo(p1.screen.x + p1.screen.w * lane + laneW1, p1.screen.y);
            ctx.fill();
          }
        }

        // Start/finish line
        if (segIndex < 5) {
          ctx.fillStyle = (segIndex % 2 === 0) ? '#FFF' : '#000';
          ctx.fillRect(p1.screen.x - p1.screen.w, p1.screen.y - 3, p1.screen.w * 2, 6);
        }

        maxY = p2.screen.y;
      }

      // Render opponents
      g.opponents.forEach(opp => {
        const oppZ = opp.z - g.playerZ;
        if (oppZ < 0 || oppZ > SEGMENT_LENGTH * DRAW_DISTANCE) return;

        const scale = CAMERA_DEPTH / oppZ * height;
        const screenX = width / 2 + (opp.x - g.playerX) * scale * ROAD_WIDTH / 2;
        const screenY = height / 2 + (1 - CAMERA_HEIGHT / oppZ) * height / 2;
        const carW = scale * 120;
        const carH = scale * 60;

        if (screenY < 50 || screenY > height) return;

        // Car shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(screenX - carW / 2, screenY - carH * 0.1, carW, carH * 0.2);

        // Car body
        ctx.fillStyle = opp.color;
        ctx.fillRect(screenX - carW / 2, screenY - carH, carW, carH * 0.7);

        // Car top
        ctx.fillStyle = opp.color;
        ctx.fillRect(screenX - carW / 3, screenY - carH - carH * 0.3, carW * 0.66, carH * 0.3);

        // Windows
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX - carW / 4, screenY - carH - carH * 0.25, carW * 0.5, carH * 0.2);

        // Wheels
        ctx.fillStyle = '#111';
        ctx.fillRect(screenX - carW / 2 - carW * 0.05, screenY - carH * 0.3, carW * 0.15, carH * 0.3);
        ctx.fillRect(screenX + carW / 2 - carW * 0.1, screenY - carH * 0.3, carW * 0.15, carH * 0.3);
      });

      // Render player car (at bottom center)
      const playerCarY = height - 120;
      const playerCarW = 100;
      const playerCarH = 50;
      const tilt = -g.playerX * 0.1;

      ctx.save();
      ctx.translate(width / 2, playerCarY);
      ctx.rotate(tilt);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-playerCarW / 2, playerCarH * 0.3, playerCarW, playerCarH * 0.2);

      // Car body
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(-playerCarW / 2, -playerCarH / 2, playerCarW, playerCarH * 0.7);

      // Car top/cabin
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(-playerCarW / 3, -playerCarH / 2 - playerCarH * 0.4, playerCarW * 0.66, playerCarH * 0.4);

      // Windshield
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(-playerCarW / 4, -playerCarH / 2 - playerCarH * 0.35, playerCarW * 0.5, playerCarH * 0.3);

      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-playerCarW / 3, playerCarH * 0.2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(playerCarW / 3, playerCarH * 0.2, 12, 0, Math.PI * 2);
      ctx.fill();

      // Wheel rims
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(-playerCarW / 3, playerCarH * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(playerCarW / 3, playerCarH * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Nitro flames
      if (g.usingNitro) {
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-playerCarW / 3, playerCarH / 2);
        ctx.lineTo(-playerCarW / 3 - 10, playerCarH / 2 + 40 + Math.random() * 20);
        ctx.lineTo(-playerCarW / 3 + 10, playerCarH / 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(playerCarW / 3, playerCarH / 2);
        ctx.lineTo(playerCarW / 3 - 10, playerCarH / 2 + 40 + Math.random() * 20);
        ctx.lineTo(playerCarW / 3 + 10, playerCarH / 2);
        ctx.fill();
      }

      ctx.restore();

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, vehicle, totalLaps, finishRace]);

  // Menu
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="arcade-title text-4xl md:text-6xl neon-glow mb-4 text-center">MOXIE SPEED</h1>
        <p className="text-lg mb-6 text-green-400">Outrun the Competition</p>

        <div className="mb-6 text-center">
          <p className="text-yellow-400 mb-2">Select Your Ride:</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
            {VEHICLES.filter(v => v.unlockLevel <= level).map((v, i) => (
              <button
                key={i}
                onClick={() => setSelectedVehicle(i)}
                className={`px-3 py-2 rounded text-sm ${selectedVehicle === i ? 'bg-green-600 text-black' : 'bg-gray-700'}`}
                style={{ borderColor: v.color, borderWidth: 2 }}
              >
                <div style={{ color: selectedVehicle === i ? '#000' : v.color }}>{v.name}</div>
                <div className="text-xs text-gray-400">{v.maxSpeed}mph</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={startGame} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-8 py-4 rounded-lg text-xl font-bold mb-6">
          <Play size={24} /> RACE LEVEL {level}
        </button>

        <div className="text-center text-green-500 text-sm mb-4">
          <p>UP/W - Accelerate | DOWN/S - Brake</p>
          <p>LEFT/RIGHT or A/D - Steer</p>
          <p>SPACE - Nitro Boost</p>
        </div>

        <div className="flex items-center gap-4">
          {bestTime && <p className="text-yellow-400"><Trophy className="inline mr-1" size={16} /> Best: {bestTime.toFixed(2)}s</p>}
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-green-400">
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>
      </div>
    );
  }

  // Countdown
  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <h1 className="arcade-title text-8xl text-yellow-400 neon-glow animate-pulse">{countdown}</h1>
        <p className="text-2xl mt-4 text-green-400">GET READY!</p>
      </div>
    );
  }

  // Victory
  if (gameState === 'victory') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-yellow-400 neon-glow mb-4">
          <Trophy className="inline" /> {finalPosition === 1 ? 'WINNER!' : `${finalPosition}${finalPosition === 2 ? 'ND' : 'RD'} PLACE!`}
        </h2>
        <p className="text-xl mb-2">Level {level} Complete!</p>
        <p className="text-xl mb-2">Time: {raceTime.toFixed(2)}s</p>
        {bestTime && <p className="text-green-400 mb-4">Best: {bestTime.toFixed(2)}s</p>}
        <button onClick={nextLevel} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold">
          <Flag size={20} /> NEXT RACE
        </button>
      </div>
    );
  }

  // Game Over
  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-red-500 mb-4">{finalPosition}TH PLACE</h2>
        <p className="text-xl mb-2">You need top 3 to advance!</p>
        <p className="text-xl mb-4">Time: {raceTime.toFixed(2)}s</p>
        <div className="flex gap-4">
          <button onClick={startGame} className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-3 rounded-lg font-bold">
            <RotateCcw size={20} /> RETRY
          </button>
          <button onClick={resetGame} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-bold">
            MENU
          </button>
        </div>
      </div>
    );
  }

  // Champion
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

  // Racing
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 bg-black">
      {/* HUD */}
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

      {/* Nitro bar */}
      <div className="w-full max-w-4xl flex items-center gap-2 mb-1 px-2">
        <span className="text-yellow-400 text-xs">NITRO</span>
        <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all" style={{ width: `${nitro}%` }} />
        </div>
      </div>

      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-2 border-green-500 rounded" />

      {/* Mobile controls */}
      <div className="flex gap-2 mt-2 md:hidden">
        <button onTouchStart={() => gameRef.current.keys['ArrowLeft'] = true} onTouchEnd={() => gameRef.current.keys['ArrowLeft'] = false}
          className="bg-gray-700 text-white px-6 py-4 rounded-lg font-bold active:bg-gray-600">LEFT</button>
        <button onTouchStart={() => gameRef.current.keys['ArrowDown'] = true} onTouchEnd={() => gameRef.current.keys['ArrowDown'] = false}
          className="bg-red-700 text-white px-6 py-4 rounded-lg font-bold active:bg-red-600">BRAKE</button>
        <button onTouchStart={() => gameRef.current.keys['ArrowUp'] = true} onTouchEnd={() => gameRef.current.keys['ArrowUp'] = false}
          className="bg-green-700 text-white px-6 py-4 rounded-lg font-bold active:bg-green-600">GAS</button>
        <button onTouchStart={() => gameRef.current.keys[' '] = true} onTouchEnd={() => gameRef.current.keys[' '] = false}
          className="bg-yellow-600 text-black px-4 py-4 rounded-lg font-bold active:bg-yellow-500">N2O</button>
        <button onTouchStart={() => gameRef.current.keys['ArrowRight'] = true} onTouchEnd={() => gameRef.current.keys['ArrowRight'] = false}
          className="bg-gray-700 text-white px-6 py-4 rounded-lg font-bold active:bg-gray-600">RIGHT</button>
      </div>
    </div>
  );
}
