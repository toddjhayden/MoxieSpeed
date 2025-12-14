import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Trophy, Fuel, Gauge, Zap } from 'lucide-react';
import SoundManager from '../utils/SoundManager';

const VEHICLES = [
  { name: 'Model T', maxSpeed: 8, acceleration: 0.15, grip: 0.7, color: '#8B4513', unlockLevel: 1 },
  { name: 'Hot Rod', maxSpeed: 10, acceleration: 0.18, grip: 0.75, color: '#DC143C', unlockLevel: 5 },
  { name: 'Muscle Car', maxSpeed: 12, acceleration: 0.2, grip: 0.8, color: '#4169E1', unlockLevel: 10 },
  { name: 'Sports Car', maxSpeed: 14, acceleration: 0.22, grip: 0.85, color: '#FFD700', unlockLevel: 20 },
  { name: 'Super Car', maxSpeed: 16, acceleration: 0.25, grip: 0.88, color: '#9400D3', unlockLevel: 35 },
  { name: 'Hyper Car', maxSpeed: 18, acceleration: 0.28, grip: 0.9, color: '#00CED1', unlockLevel: 50 },
  { name: 'Rocket Car', maxSpeed: 20, acceleration: 0.3, grip: 0.92, color: '#FF1493', unlockLevel: 70 },
  { name: 'Hover Racer', maxSpeed: 22, acceleration: 0.32, grip: 0.95, color: '#00FF7F', unlockLevel: 85 },
  { name: 'Spacecraft', maxSpeed: 25, acceleration: 0.35, grip: 0.98, color: '#FF00FF', unlockLevel: 95 },
];

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const GROUND_Y = 380;
const CAR_WIDTH = 80;
const CAR_HEIGHT = 35;

const generateTerrain = (level) => {
  const points = [];
  const segmentWidth = 50;
  const numSegments = 300;
  let x = 0;
  let y = GROUND_Y;

  const hillFrequency = 0.02 + (level * 0.003);
  const hillAmplitude = 30 + (level * 2);
  const bumpFrequency = 0.1;
  const bumpAmplitude = 5 + (level * 0.5);

  for (let i = 0; i <= numSegments; i++) {
    const hills = Math.sin(x * hillFrequency) * hillAmplitude;
    const bumps = Math.sin(x * bumpFrequency) * bumpAmplitude;
    y = GROUND_Y - hills - bumps;
    points.push({ x, y });
    x += segmentWidth;
  }

  return points;
};

const getTerrainYAtX = (terrain, x) => {
  if (x < 0) return GROUND_Y;
  const segmentWidth = 50;
  const index = Math.floor(x / segmentWidth);
  if (index >= terrain.length - 1) return terrain[terrain.length - 1].y;

  const p1 = terrain[index];
  const p2 = terrain[index + 1];
  const t = (x - p1.x) / segmentWidth;
  return p1.y + (p2.y - p1.y) * t;
};

const getTerrainAngleAtX = (terrain, x) => {
  const segmentWidth = 50;
  const index = Math.floor(x / segmentWidth);
  if (index >= terrain.length - 1) return 0;

  const p1 = terrain[index];
  const p2 = terrain[index + 1];
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
};

export default function RacingGame() {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('moxiespeed-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fuel, setFuel] = useState(100);
  const [nitro, setNitro] = useState(100);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [crashed, setCrashed] = useState(false);

  const soundManagerRef = useRef(null);
  const gameStateRef = useRef({
    carX: 200,
    carY: GROUND_Y - CAR_HEIGHT,
    velocityX: 0,
    velocityY: 0,
    rotation: 0,
    angularVelocity: 0,
    onGround: true,
    terrain: [],
    cameraX: 0,
    keys: { up: false, down: false, left: false, right: false, space: false },
    lastTime: 0,
    distance: 0,
    fuel: 100,
    nitro: 100,
    crashed: false,
  });

  const vehicle = VEHICLES[selectedVehicle];
  const levelGoal = 2000 + (level * 500);

  useEffect(() => {
    soundManagerRef.current = new SoundManager(soundEnabled);
    return () => soundManagerRef.current?.stopMenuMusic();
  }, []);

  useEffect(() => {
    soundManagerRef.current?.toggleSound(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('moxiespeed-highscore', highScore.toString());
  }, [highScore]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') gameStateRef.current.keys.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') gameStateRef.current.keys.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') gameStateRef.current.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') gameStateRef.current.keys.right = true;
      if (e.key === ' ') gameStateRef.current.keys.space = true;

      if (gameState === 'menu' && (e.key === ' ' || e.key === 'Enter')) startGame();
      if ((gameState === 'gameOver' || gameState === 'levelComplete') && (e.key === ' ' || e.key === 'Enter')) {
        if (gameState === 'levelComplete') nextLevel();
        else resetGame();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') gameStateRef.current.keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') gameStateRef.current.keys.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') gameStateRef.current.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') gameStateRef.current.keys.right = false;
      if (e.key === ' ') gameStateRef.current.keys.space = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  const startGame = useCallback(async () => {
    if (soundManagerRef.current) {
      await soundManagerRef.current.initialize();
      soundManagerRef.current.stopMenuMusic();
      soundManagerRef.current.startRace();
    }

    const terrain = generateTerrain(level);
    gameStateRef.current = {
      carX: 200,
      carY: GROUND_Y - CAR_HEIGHT,
      velocityX: 0,
      velocityY: 0,
      rotation: 0,
      angularVelocity: 0,
      onGround: true,
      terrain,
      cameraX: 0,
      keys: { up: false, down: false, left: false, right: false, space: false },
      lastTime: performance.now(),
      distance: 0,
      fuel: 100,
      nitro: 100,
      crashed: false,
    };

    setFuel(100);
    setNitro(100);
    setDistance(0);
    setSpeed(0);
    setCrashed(false);
    setGameState('playing');
  }, [level]);

  const resetGame = useCallback(() => {
    setLevel(1);
    setScore(0);
    setGameState('menu');
    soundManagerRef.current?.playMenuMusic();
  }, []);

  const nextLevel = useCallback(() => {
    if (level >= 100) {
      setGameState('victory');
      soundManagerRef.current?.victory();
      if (score > highScore) setHighScore(score);
      return;
    }
    setLevel(prev => prev + 1);
    soundManagerRef.current?.levelUp();
    startGame();
  }, [level, score, highScore, startGame]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;

    const gameLoop = (currentTime) => {
      const gs = gameStateRef.current;
      const dt = Math.min((currentTime - gs.lastTime) / 1000, 0.05);
      gs.lastTime = currentTime;

      if (!gs.crashed) {
        // Physics
        const gravity = 0.5;
        const friction = 0.98;
        const airResistance = 0.995;

        // Input handling
        let accelerating = false;
        let braking = false;
        let usingNitro = false;

        if (gs.keys.up && gs.fuel > 0) {
          accelerating = true;
          gs.fuel -= 0.05;
        }
        if (gs.keys.down) {
          braking = true;
        }
        if (gs.keys.space && gs.nitro > 0 && gs.keys.up) {
          usingNitro = true;
          gs.nitro -= 0.3;
        }
        if (gs.keys.left) {
          gs.angularVelocity -= 0.003;
        }
        if (gs.keys.right) {
          gs.angularVelocity += 0.003;
        }

        // Get terrain info
        const terrainY = getTerrainYAtX(gs.terrain, gs.carX + CAR_WIDTH / 2);
        const terrainAngle = getTerrainAngleAtX(gs.terrain, gs.carX + CAR_WIDTH / 2);
        const carBottom = gs.carY + CAR_HEIGHT;

        // Ground collision
        gs.onGround = carBottom >= terrainY - 5;

        if (gs.onGround) {
          gs.carY = terrainY - CAR_HEIGHT;
          gs.velocityY = 0;
          gs.rotation = terrainAngle * 0.7;
          gs.angularVelocity *= 0.8;

          // Acceleration on ground
          if (accelerating) {
            const accel = vehicle.acceleration * (usingNitro ? 2 : 1);
            gs.velocityX += Math.cos(terrainAngle) * accel;
            gs.velocityY += Math.sin(terrainAngle) * accel;
          }

          // Braking
          if (braking) {
            gs.velocityX *= 0.95;
          }

          // Friction
          gs.velocityX *= friction;

          // Slope effect
          gs.velocityX += Math.sin(terrainAngle) * gravity * 0.5;

        } else {
          // Air physics
          gs.velocityY += gravity;
          gs.rotation += gs.angularVelocity;
          gs.angularVelocity *= 0.99;
          gs.velocityX *= airResistance;
        }

        // Speed limit
        const maxSpd = vehicle.maxSpeed * (usingNitro ? 1.5 : 1);
        gs.velocityX = Math.max(-maxSpd * 0.3, Math.min(maxSpd, gs.velocityX));

        // Update position
        gs.carX += gs.velocityX;
        gs.carY += gs.velocityY;

        // Prevent going below terrain
        const newTerrainY = getTerrainYAtX(gs.terrain, gs.carX + CAR_WIDTH / 2);
        if (gs.carY + CAR_HEIGHT > newTerrainY) {
          gs.carY = newTerrainY - CAR_HEIGHT;
        }

        // Camera follow
        gs.cameraX = gs.carX - 200;

        // Track distance
        if (gs.velocityX > 0) {
          gs.distance += gs.velocityX;
        }

        // Crash detection (car flipped)
        if (Math.abs(gs.rotation) > Math.PI / 2) {
          gs.crashed = true;
          setCrashed(true);
          soundManagerRef.current?.defeat();
        }

        // Fuel pickup regeneration (every 500 units)
        if (Math.floor(gs.distance / 500) > Math.floor((gs.distance - gs.velocityX) / 500)) {
          gs.fuel = Math.min(100, gs.fuel + 20);
        }

        // Nitro regeneration over time
        if (!usingNitro && gs.nitro < 100) {
          gs.nitro += 0.02;
        }

        // Out of fuel
        if (gs.fuel <= 0 && gs.velocityX < 0.5) {
          gs.crashed = true;
          setCrashed(true);
        }

        // Level complete
        if (gs.distance >= levelGoal) {
          setScore(prev => prev + Math.floor(gs.distance) + Math.floor(gs.fuel * 10));
          setGameState('levelComplete');
          soundManagerRef.current?.victory();
        }

        // Update React state periodically
        setFuel(Math.max(0, Math.floor(gs.fuel)));
        setNitro(Math.max(0, Math.floor(gs.nitro)));
        setDistance(Math.floor(gs.distance));
        setSpeed(Math.abs(Math.floor(gs.velocityX * 10)));
      }

      // Rendering
      ctx.fillStyle = '#1a0a3e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 50; i++) {
        const starX = ((i * 137) % CANVAS_WIDTH + gs.cameraX * 0.1) % CANVAS_WIDTH;
        const starY = (i * 89) % 200;
        ctx.fillRect(starX, starY, 2, 2);
      }

      // Mountains (background)
      ctx.fillStyle = '#2a1a4e';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      for (let x = 0; x <= CANVAS_WIDTH; x += 100) {
        const mountainY = 250 + Math.sin((x + gs.cameraX * 0.3) * 0.01) * 50;
        ctx.lineTo(x, mountainY);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fill();

      // Hills (midground)
      ctx.fillStyle = '#3a2a5e';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      for (let x = 0; x <= CANVAS_WIDTH; x += 50) {
        const hillY = 320 + Math.sin((x + gs.cameraX * 0.5) * 0.02) * 30;
        ctx.lineTo(x, hillY);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fill();

      // Terrain
      ctx.fillStyle = '#4a3a2e';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);

      for (let screenX = 0; screenX <= CANVAS_WIDTH; screenX += 10) {
        const worldX = screenX + gs.cameraX;
        const terrainY = getTerrainYAtX(gs.terrain, worldX);
        ctx.lineTo(screenX, terrainY);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fill();

      // Grass on top of terrain
      ctx.strokeStyle = '#2d5a2d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let screenX = 0; screenX <= CANVAS_WIDTH; screenX += 10) {
        const worldX = screenX + gs.cameraX;
        const terrainY = getTerrainYAtX(gs.terrain, worldX);
        if (screenX === 0) ctx.moveTo(screenX, terrainY);
        else ctx.lineTo(screenX, terrainY);
      }
      ctx.stroke();

      // Distance markers
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      for (let d = 0; d <= levelGoal; d += 500) {
        const markerX = d - gs.cameraX;
        if (markerX > 0 && markerX < CANVAS_WIDTH) {
          const markerY = getTerrainYAtX(gs.terrain, d) - 20;
          ctx.fillText(`${d}m`, markerX, markerY);
        }
      }

      // Draw car
      const carScreenX = gs.carX - gs.cameraX;
      const carScreenY = gs.carY;

      ctx.save();
      ctx.translate(carScreenX + CAR_WIDTH / 2, carScreenY + CAR_HEIGHT / 2);
      ctx.rotate(gs.rotation);

      // Car body
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT * 0.7);

      // Car top
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(-CAR_WIDTH / 4, -CAR_HEIGHT / 2 - 15, CAR_WIDTH / 2, 15);

      // Windows
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(-CAR_WIDTH / 4 + 3, -CAR_HEIGHT / 2 - 12, CAR_WIDTH / 2 - 6, 10);

      // Wheels
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(-CAR_WIDTH / 3, CAR_HEIGHT / 3, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CAR_WIDTH / 3, CAR_HEIGHT / 3, 12, 0, Math.PI * 2);
      ctx.fill();

      // Wheel rims
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(-CAR_WIDTH / 3, CAR_HEIGHT / 3, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CAR_WIDTH / 3, CAR_HEIGHT / 3, 6, 0, Math.PI * 2);
      ctx.fill();

      // Nitro flame
      if (gs.keys.space && gs.keys.up && gs.nitro > 0) {
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-CAR_WIDTH / 2, 0);
        ctx.lineTo(-CAR_WIDTH / 2 - 30, 5);
        ctx.lineTo(-CAR_WIDTH / 2, 10);
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(-CAR_WIDTH / 2, 2);
        ctx.lineTo(-CAR_WIDTH / 2 - 20, 5);
        ctx.lineTo(-CAR_WIDTH / 2, 8);
        ctx.fill();
      }

      ctx.restore();

      // Finish line
      const finishX = levelGoal - gs.cameraX;
      if (finishX > 0 && finishX < CANVAS_WIDTH) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(finishX, 0, 10, CANVAS_HEIGHT);
        ctx.fillStyle = '#000000';
        for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
          ctx.fillRect(finishX, y, 10, 10);
        }
      }

      // Crashed overlay
      if (gs.crashed) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CRASHED!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Press SPACE to retry', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

        if (gs.keys.space) {
          startGame();
        }
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, vehicle, levelGoal, startGame]);

  // Menu screen
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="arcade-title text-4xl md:text-6xl neon-glow mb-4 text-center">
          MOXIE<br/>SPEED
        </h1>
        <p className="text-lg mb-2 text-green-400">100 Levels of Racing Evolution</p>
        <p className="text-sm mb-6 text-green-600">Model T to Spacecraft</p>

        <div className="mb-6 text-center">
          <p className="text-yellow-400 mb-2">Select Vehicle:</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-lg">
            {VEHICLES.filter(v => v.unlockLevel <= Math.max(1, level)).map((v, i) => (
              <button
                key={i}
                onClick={() => setSelectedVehicle(i)}
                className={`px-3 py-2 rounded ${selectedVehicle === i ? 'bg-green-600 text-black' : 'bg-gray-700 text-white'}`}
                style={{ borderColor: v.color, borderWidth: 2 }}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-8 py-4 rounded-lg text-xl font-bold transition-all transform hover:scale-105 mb-6"
        >
          <Play size={24} /> START RACE
        </button>

        <div className="text-center text-green-500 text-sm">
          <p className="mb-1">UP / W - Accelerate</p>
          <p className="mb-1">DOWN / S - Brake</p>
          <p className="mb-1">LEFT / RIGHT - Balance in air</p>
          <p className="mb-1">SPACE - Nitro boost</p>
        </div>

        {highScore > 0 && (
          <p className="mt-4 text-yellow-400">
            <Trophy className="inline mr-2" size={16} />
            High Score: {highScore.toLocaleString()}
          </p>
        )}

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="mt-4 p-2 text-green-400 hover:text-green-300"
        >
          {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
      </div>
    );
  }

  // Level complete screen
  if (gameState === 'levelComplete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-green-400 neon-glow mb-4">LEVEL {level} COMPLETE!</h2>
        <p className="text-xl mb-2">Distance: {distance}m</p>
        <p className="text-xl mb-2">Fuel Bonus: {fuel * 10}</p>
        <p className="text-2xl mb-4 text-yellow-400">Score: {score.toLocaleString()}</p>
        <button
          onClick={nextLevel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold"
        >
          <Play size={20} /> NEXT LEVEL
        </button>
      </div>
    );
  }

  // Game over screen
  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-red-500 mb-4">GAME OVER</h2>
        <p className="text-xl mb-2">Level: {level}</p>
        <p className="text-xl mb-2">Distance: {distance}m</p>
        <p className="text-2xl mb-4 text-yellow-400">Score: {score.toLocaleString()}</p>
        {score >= highScore && score > 0 && <p className="text-green-400 mb-4">NEW HIGH SCORE!</p>}
        <button
          onClick={resetGame}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold"
        >
          <RotateCcw size={20} /> TRY AGAIN
        </button>
      </div>
    );
  }

  // Victory screen
  if (gameState === 'victory') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-yellow-400 neon-glow mb-4">
          <Trophy className="inline" /> CHAMPION! <Trophy className="inline" />
        </h2>
        <p className="text-xl mb-4">You completed all 100 levels!</p>
        <p className="text-2xl mb-4 text-yellow-400">Final Score: {score.toLocaleString()}</p>
        <button
          onClick={resetGame}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold"
        >
          <RotateCcw size={20} /> PLAY AGAIN
        </button>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 bg-gray-900">
      {/* HUD */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-2 px-2 text-white">
        <div className="flex items-center gap-4">
          <span className="text-green-400 font-bold">LVL {level}</span>
          <span style={{ color: vehicle.color }}>{vehicle.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Gauge size={16} className="text-blue-400" />
            {speed} mph
          </span>
          <span className="text-yellow-400">Score: {score + Math.floor(distance)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-4xl h-3 bg-gray-800 rounded mb-2">
        <div
          className="h-full bg-green-500 rounded transition-all"
          style={{ width: `${Math.min(100, (distance / levelGoal) * 100)}%` }}
        />
      </div>

      {/* Fuel and Nitro */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-2 px-2">
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-orange-400" />
          <div className="w-32 h-4 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${fuel}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          <div className="w-32 h-4 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all" style={{ width: `${nitro}%` }} />
          </div>
        </div>
        <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-green-400">
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-4 border-green-500 rounded-lg"
      />

      {/* Mobile controls */}
      <div className="flex gap-2 mt-4 md:hidden">
        <button
          onTouchStart={() => gameStateRef.current.keys.left = true}
          onTouchEnd={() => gameStateRef.current.keys.left = false}
          className="bg-gray-700 text-white px-6 py-4 rounded-lg font-bold active:bg-gray-600"
        >
          TILT L
        </button>
        <button
          onTouchStart={() => gameStateRef.current.keys.down = true}
          onTouchEnd={() => gameStateRef.current.keys.down = false}
          className="bg-red-700 text-white px-6 py-4 rounded-lg font-bold active:bg-red-600"
        >
          BRAKE
        </button>
        <button
          onTouchStart={() => gameStateRef.current.keys.up = true}
          onTouchEnd={() => gameStateRef.current.keys.up = false}
          className="bg-green-700 text-white px-6 py-4 rounded-lg font-bold active:bg-green-600"
        >
          GAS
        </button>
        <button
          onTouchStart={() => gameStateRef.current.keys.space = true}
          onTouchEnd={() => gameStateRef.current.keys.space = false}
          className="bg-yellow-600 text-black px-6 py-4 rounded-lg font-bold active:bg-yellow-500"
        >
          NITRO
        </button>
        <button
          onTouchStart={() => gameStateRef.current.keys.right = true}
          onTouchEnd={() => gameStateRef.current.keys.right = false}
          className="bg-gray-700 text-white px-6 py-4 rounded-lg font-bold active:bg-gray-600"
        >
          TILT R
        </button>
      </div>
    </div>
  );
}
