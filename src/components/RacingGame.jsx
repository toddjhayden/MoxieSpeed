import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import SoundManager from '../utils/SoundManager';

// Vehicle progression through 100 levels
const VEHICLES = [
  { name: 'Model T', emoji: '=ó', levels: [1, 10], color: '#8B4513', speed: 1 },
  { name: 'Classic Car', emoji: '=ô', levels: [11, 20], color: '#4169E1', speed: 1.2 },
  { name: 'Muscle Car', emoji: '<Œ', levels: [21, 30], color: '#DC143C', speed: 1.4 },
  { name: 'Sports Car', emoji: '=ò', levels: [31, 40], color: '#FFD700', speed: 1.6 },
  { name: 'Race Car', emoji: '<¡', levels: [41, 50], color: '#FF4500', speed: 1.8 },
  { name: 'Supercar', emoji: '°', levels: [51, 60], color: '#9400D3', speed: 2.0 },
  { name: 'Hypercar', emoji: '=®', levels: [61, 70], color: '#00CED1', speed: 2.2 },
  { name: 'Jet Car', emoji: '', levels: [71, 80], color: '#FF1493', speed: 2.5 },
  { name: 'Hover Car', emoji: '=¯', levels: [81, 90], color: '#00FF7F', speed: 2.8 },
  { name: 'Spaceship', emoji: '=Ä', levels: [91, 100], color: '#FF00FF', speed: 3.0 },
];

const getVehicle = (level) => {
  return VEHICLES.find(v => level >= v.levels[0] && level <= v.levels[1]) || VEHICLES[0];
};

const LANE_COUNT = 5;
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const LANE_WIDTH = GAME_WIDTH / LANE_COUNT;

export default function RacingGame() {
  const [gameState, setGameState] = useState('menu'); // menu, playing, paused, gameOver, victory
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('moxiespeed-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [playerLane, setPlayerLane] = useState(2);
  const [obstacles, setObstacles] = useState([]);
  const [powerUps, setPowerUps] = useState([]);
  const [distance, setDistance] = useState(0);
  const [shield, setShield] = useState(false);
  const [boost, setBoost] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lives, setLives] = useState(3);

  const soundManagerRef = useRef(null);
  const gameLoopRef = useRef(null);
  const lastTimeRef = useRef(0);

  const vehicle = getVehicle(level);
  const levelGoal = 1000 + (level * 200);
  const obstacleSpeed = 3 + (level * 0.15);
  const spawnRate = Math.max(0.02, 0.05 - (level * 0.0003));

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager(soundEnabled);
    return () => {
      if (soundManagerRef.current) {
        soundManagerRef.current.stopMenuMusic();
      }
    };
  }, []);

  // Update sound state
  useEffect(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.toggleSound(soundEnabled);
    }
  }, [soundEnabled]);

  // Save high score
  useEffect(() => {
    localStorage.setItem('moxiespeed-highscore', highScore.toString());
  }, [highScore]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') {
        if (e.key === ' ' || e.key === 'Enter') {
          if (gameState === 'menu') startGame();
          else if (gameState === 'gameOver' || gameState === 'victory') resetGame();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setPlayerLane(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          setPlayerLane(prev => Math.min(LANE_COUNT - 1, prev + 1));
          break;
        case ' ':
          setGameState('paused');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const startGame = useCallback(async () => {
    if (soundManagerRef.current) {
      await soundManagerRef.current.initialize();
      soundManagerRef.current.stopMenuMusic();
      soundManagerRef.current.startRace();
    }
    setGameState('playing');
    setObstacles([]);
    setPowerUps([]);
    setDistance(0);
    setShield(false);
    setBoost(false);
  }, []);

  const resetGame = useCallback(() => {
    setLevel(1);
    setScore(0);
    setLives(3);
    setPlayerLane(2);
    setGameState('menu');
    if (soundManagerRef.current) {
      soundManagerRef.current.playMenuMusic();
    }
  }, []);

  const nextLevel = useCallback(() => {
    if (level >= 100) {
      setGameState('victory');
      if (soundManagerRef.current) soundManagerRef.current.victory();
      if (score > highScore) setHighScore(score);
      return;
    }
    setLevel(prev => prev + 1);
    setDistance(0);
    setObstacles([]);
    setPowerUps([]);
    setShield(false);
    setBoost(false);
    if (soundManagerRef.current) soundManagerRef.current.levelUp();
  }, [level, score, highScore]);

  const handleCollision = useCallback(() => {
    if (shield) {
      setShield(false);
      return;
    }

    if (soundManagerRef.current) soundManagerRef.current.defeat();

    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setGameState('gameOver');
        if (score > highScore) setHighScore(score);
      }
      return newLives;
    });

    setObstacles([]);
    setDistance(prev => Math.max(0, prev - 200));
  }, [shield, score, highScore]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = (timestamp) => {
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (deltaTime > 0) {
        const speedMultiplier = boost ? 2 : 1;
        const actualSpeed = obstacleSpeed * vehicle.speed * speedMultiplier;

        // Update distance
        setDistance(prev => {
          const newDist = prev + actualSpeed * 0.5;
          if (newDist >= levelGoal) {
            nextLevel();
            return 0;
          }
          return newDist;
        });

        // Update score
        setScore(prev => prev + Math.floor(actualSpeed * 0.1));

        // Spawn obstacles
        if (Math.random() < spawnRate) {
          const lane = Math.floor(Math.random() * LANE_COUNT);
          setObstacles(prev => [...prev, {
            id: Date.now() + Math.random(),
            lane,
            y: -60,
            type: Math.random() > 0.7 ? 'truck' : 'car'
          }]);
        }

        // Spawn power-ups
        if (Math.random() < 0.005) {
          const lane = Math.floor(Math.random() * LANE_COUNT);
          const type = Math.random() > 0.5 ? 'shield' : 'boost';
          setPowerUps(prev => [...prev, {
            id: Date.now() + Math.random(),
            lane,
            y: -40,
            type
          }]);
        }

        // Move obstacles
        setObstacles(prev => {
          const updated = prev
            .map(obs => ({ ...obs, y: obs.y + actualSpeed }))
            .filter(obs => obs.y < GAME_HEIGHT + 60);

          // Check collisions
          updated.forEach(obs => {
            if (obs.lane === playerLane && obs.y > GAME_HEIGHT - 120 && obs.y < GAME_HEIGHT - 40) {
              handleCollision();
            }
          });

          return updated;
        });

        // Move power-ups
        setPowerUps(prev => {
          const updated = prev
            .map(pu => ({ ...pu, y: pu.y + actualSpeed }))
            .filter(pu => pu.y < GAME_HEIGHT);

          // Check power-up collection
          const collected = updated.filter(pu =>
            pu.lane === playerLane && pu.y > GAME_HEIGHT - 120 && pu.y < GAME_HEIGHT - 40
          );

          collected.forEach(pu => {
            if (pu.type === 'shield') setShield(true);
            else if (pu.type === 'boost') {
              setBoost(true);
              setTimeout(() => setBoost(false), 3000);
            }
          });

          return updated.filter(pu => !collected.includes(pu));
        });

        // Engine sound
        if (soundManagerRef.current && Math.random() < 0.1) {
          soundManagerRef.current.engineSound(actualSpeed);
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, playerLane, obstacleSpeed, vehicle.speed, spawnRate, levelGoal, boost, handleCollision, nextLevel]);

  // Menu screen
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="arcade-title text-4xl md:text-6xl neon-glow mb-8 text-center">
          MOXIE<br/>SPEED
        </h1>
        <p className="text-lg mb-4 text-green-400">100 Levels of Racing Evolution</p>
        <p className="text-sm mb-8 text-green-600">Model T í Spaceship</p>

        <button
          onClick={startGame}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-8 py-4 rounded-lg text-xl font-bold transition-all transform hover:scale-105"
        >
          <Play size={24} /> START RACE
        </button>

        <div className="mt-8 text-center text-green-500">
          <p>ê í or A/D to steer</p>
          <p>SPACE to pause</p>
        </div>

        {highScore > 0 && (
          <p className="mt-4 text-yellow-400">
            <Trophy className="inline mr-2" size={16} />
            High Score: {highScore.toLocaleString()}
          </p>
        )}

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="mt-6 p-2 text-green-400 hover:text-green-300"
        >
          {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
      </div>
    );
  }

  // Game Over screen
  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-4xl text-red-500 mb-4">GAME OVER</h2>
        <p className="text-xl mb-2">Level: {level}</p>
        <p className="text-2xl mb-4 text-yellow-400">Score: {score.toLocaleString()}</p>
        {score >= highScore && <p className="text-green-400 mb-4">NEW HIGH SCORE!</p>}
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
        <h2 className="arcade-title text-4xl text-yellow-400 neon-glow mb-4"><∆ CHAMPION! <∆</h2>
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

  // Paused screen
  if (gameState === 'paused') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="arcade-title text-3xl mb-8">PAUSED</h2>
        <button
          onClick={() => setGameState('playing')}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold"
        >
          <Play size={20} /> RESUME
        </button>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* HUD */}
      <div className="w-full max-w-md flex justify-between items-center mb-2 px-2">
        <div className="text-sm">
          <span className="text-green-400">LVL {level}</span>
          <span className="ml-2 text-lg">{vehicle.emoji} {vehicle.name}</span>
        </div>
        <div className="text-sm text-yellow-400">
          Score: {score.toLocaleString()}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md h-2 bg-gray-800 rounded mb-2">
        <div
          className="h-full bg-green-500 rounded transition-all"
          style={{ width: `${(distance / levelGoal) * 100}%` }}
        />
      </div>

      {/* Lives and power-ups */}
      <div className="w-full max-w-md flex justify-between items-center mb-2 px-2">
        <div className="text-red-500">
          {'d'.repeat(lives)}{'=§'.repeat(3 - lives)}
        </div>
        <div className="flex gap-2">
          {shield && <span className="text-blue-400">=·</span>}
          {boost && <span className="text-orange-400">=%</span>}
        </div>
        <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-green-400">
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Game canvas */}
      <div
        className="relative bg-gray-900 border-4 border-green-500 rounded-lg overflow-hidden"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Road lines */}
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-1 bg-yellow-500 opacity-50"
            style={{
              left: i * LANE_WIDTH - 2,
              backgroundImage: 'repeating-linear-gradient(0deg, #eab308 0px, #eab308 20px, transparent 20px, transparent 40px)',
              animation: 'scroll 0.5s linear infinite'
            }}
          />
        ))}

        {/* Obstacles */}
        {obstacles.map(obs => (
          <div
            key={obs.id}
            className="absolute flex items-center justify-center text-3xl"
            style={{
              left: obs.lane * LANE_WIDTH + LANE_WIDTH / 2 - 20,
              top: obs.y,
              width: 40,
              height: 60,
            }}
          >
            {obs.type === 'truck' ? '=õ' : '=ó'}
          </div>
        ))}

        {/* Power-ups */}
        {powerUps.map(pu => (
          <div
            key={pu.id}
            className="absolute flex items-center justify-center text-2xl animate-pulse"
            style={{
              left: pu.lane * LANE_WIDTH + LANE_WIDTH / 2 - 15,
              top: pu.y,
              width: 30,
              height: 30,
            }}
          >
            {pu.type === 'shield' ? '=·' : <Zap className="text-yellow-400" />}
          </div>
        ))}

        {/* Player */}
        <div
          className={`absolute transition-all duration-100 flex items-center justify-center text-4xl ${shield ? 'ring-4 ring-blue-400 rounded-full' : ''} ${boost ? 'animate-pulse' : ''}`}
          style={{
            left: playerLane * LANE_WIDTH + LANE_WIDTH / 2 - 25,
            bottom: 40,
            width: 50,
            height: 70,
          }}
        >
          {vehicle.emoji}
        </div>
      </div>

      {/* Touch controls for mobile */}
      <div className="flex gap-4 mt-4 md:hidden">
        <button
          onTouchStart={() => setPlayerLane(prev => Math.max(0, prev - 1))}
          className="bg-green-600 text-black px-8 py-4 rounded-lg text-2xl font-bold active:bg-green-400"
        >
          ê
        </button>
        <button
          onTouchStart={() => setPlayerLane(prev => Math.min(LANE_COUNT - 1, prev + 1))}
          className="bg-green-600 text-black px-8 py-4 rounded-lg text-2xl font-bold active:bg-green-400"
        >
          í
        </button>
      </div>

      <style>{`
        @keyframes scroll {
          0% { background-position: 0 0; }
          100% { background-position: 0 40px; }
        }
      `}</style>
    </div>
  );
}
