import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Volume2, VolumeX, ArrowRight, Target, Flame, Crown } from 'lucide-react';

import '../polyfill';

import confetti from 'canvas-confetti';

interface RainbowLoadingScreenProps {
  isAuthLoaded: boolean;
  onComplete: () => void;
}

interface SparkleItem {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  opacity: number;
  char: string;
}

const SOCCER_STATUS_TEXTS = [
  "Mapping neighborhood blocks and active civic zones...",
  "Alerting local maintenance teams and volunteer champions...",
  "Inspecting the community park football pitch turf for safety...",
  "Tuning municipal AI engines for precise pothole and hazard detection...",
  "Pre-heating asphalt mixers and preparing sustainable eco-chalk...",
  "Polishing the Community Hero champion badges and golden trophies...",
  "Clearing neighborhood debris and painting fresh goalpost lines...",
  "Summoning local leaders and star soccer players to the hub...",
  "Powering up real-time geographic resolution routers...",
  "Coaxing street spotlights to shine with maximum neighborhood glow...",
  "Warming up community spirit for an epic local kick-off! ⚽"
];

const N_AMERICA_COLORS = [
  '#3B82F6', // Civic Blue
  '#10B981', // Park Green
  '#F59E0B', // Amber Warning / Gold
  '#EF4444', // Coral Urgent / Flag
  '#6366F1', // Indigo Community
  '#FFFFFF'  // Pure White
];

export default function RainbowLoadingScreen({ isAuthLoaded, onComplete }: RainbowLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [activeMessage, setActiveMessage] = useState(SOCCER_STATUS_TEXTS[0]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sparkles, setSparkles] = useState<SparkleItem[]>([]);
  
  // Game state
  const [isJuggling, setIsJuggling] = useState(false);
  const [juggles, setJuggles] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem('fifa_juggle_high_score') || 0);
  });
  const [easterEggUnlocked, setEasterEggUnlocked] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const ballElementRef = useRef<HTMLDivElement>(null);
  const shadowElementRef = useRef<HTMLDivElement>(null);
  const sparkleIdCounter = useRef(0);
  
  // Keep physics ref to avoid re-renders on every frame tick
  const ballRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    rotationSpeed: 0,
  });

  // Welcome Confetti and initial pitch setup
  useEffect(() => {
    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.8 },
      colors: N_AMERICA_COLORS
    });
  }, []);

  // Update soccer status messages periodically
  useEffect(() => {
    let index = 0;
    const msgInterval = setInterval(() => {
      index = (index + 1) % SOCCER_STATUS_TEXTS.length;
      setActiveMessage(SOCCER_STATUS_TEXTS[index]);
    }, 2800);
    return () => clearInterval(msgInterval);
  }, []);

  // Smooth progress bar pacing with capping
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (isAuthLoaded) {
          if (prev >= 100) return 100;
          const remaining = 100 - prev;
          const step = Math.max(2.5, remaining * 0.15);
          return Math.min(prev + step, 100);
        } else {
          if (prev < 85) {
            const step = Math.max(1.5, (85 - prev) * 0.12);
            return Math.min(prev + step, 85);
          }
          return Math.min(prev + 0.05, 95);
        }
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isAuthLoaded]);

  // Synthetic Web Audio SFX Engine (No dependencies/assets required)
  const playKickSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle'; // Smooth lower punch for ball kick
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }, [soundEnabled]);

  const playWhistleSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(1150, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(1170, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.32);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.32);
      osc2.stop(audioCtx.currentTime + 0.32);
    } catch (e) {}
  }, [soundEnabled]);

  const spawnSparkle = useCallback((x: number, y: number, textEmoji?: string) => {
    const id = sparkleIdCounter.current++;
    const color = N_AMERICA_COLORS[id % N_AMERICA_COLORS.length];
    const size = Math.random() * 12 + 18;
    const emojis = ['⚽', '🏆', '🏘️', '🤝', '🛠️', '⭐', '🔥', '🦸', '🌱', '🌟'];
    const char = textEmoji || emojis[Math.floor(Math.random() * emojis.length)];

    setSparkles(prev => [
      ...prev,
      { id, x, y, color, size, opacity: 1, char }
    ]);
  }, []);

  // Frame Loop for physics updating at 60Hz+ with refs
  useEffect(() => {
    let animFrame: number;
    
    const updatePhysics = () => {
      // 1. Update Sparkles drift
      setSparkles(prev => {
        if (prev.length === 0) return prev;
        return prev
          .map(s => ({
            ...s,
            y: s.y - 1.8, // rise up
            x: s.x + Math.sin(s.id + s.y / 12) * 0.5,
            opacity: s.opacity - 0.02
          }))
          .filter(s => s.opacity > 0 && s.y > -20);
      });

      // 2. Update Juggling Ball Physics
      let { x, y, vx, vy, rotation, rotationSpeed } = ballRef.current;
      const container = containerRef.current;
      
      if (container) {
        const rect = container.getBoundingClientRect();
        const ballRadius = 42; // 84px wide
        const bottomLimit = rect.height / 2 - ballRadius - 100; // offset floor
        
        if (isJuggling) {
          // Gravity pull
          vy += 0.42;
          y += vy;
          x += vx;
          rotation += rotationSpeed;

          // Bounce off left/right side boundaries
          const leftLimit = -rect.width / 2 + ballRadius;
          const rightLimit = rect.width / 2 - ballRadius;
          
          if (x < leftLimit) {
            x = leftLimit;
            vx = -vx * 0.75; // rebound bounce
            rotationSpeed = -rotationSpeed * 0.8;
            playKickSound();
          } else if (x > rightLimit) {
            x = rightLimit;
            vx = -vx * 0.75;
            rotationSpeed = -rotationSpeed * 0.8;
            playKickSound();
          }

          // Ceiling threshold
          const topLimit = -rect.height / 2 + ballRadius + 60;
          if (y < topLimit) {
            y = topLimit;
            vy = -vy * 0.5; // slow down ceiling impact
          }

          // Floor threshold (Lost ball)
          if (y > bottomLimit) {
            y = bottomLimit;
            vx = 0;
            vy = 0;
            rotationSpeed = 0;
            setIsJuggling(false);
            
            // Check if streak broke
            setJuggles(0);
          }
        } else {
          // Float gently on floor
          y = bottomLimit + Math.sin(Date.now() / 250) * 6;
          x = 0;
          rotation = Math.sin(Date.now() / 800) * 15;
        }

        // Apply visual positions to elements without React lag
        if (ballElementRef.current) {
          ballElementRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
        }
        if (shadowElementRef.current) {
          const heightFromFloor = bottomLimit - y;
          const shadowScale = Math.max(0.18, 1 - heightFromFloor / 280);
          const shadowOpacity = Math.max(0.04, 0.45 - heightFromFloor / 380);
          shadowElementRef.current.style.transform = `translate(${x}px, ${bottomLimit + 42}px) scale(${shadowScale})`;
          shadowElementRef.current.style.opacity = `${shadowOpacity}`;
        }
      }

      ballRef.current = { x, y, vx, vy, rotation, rotationSpeed };
      animFrame = requestAnimationFrame(updatePhysics);
    };

    animFrame = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animFrame);
  }, [isJuggling, playKickSound]);

  // Click on ball event handler with vector angles
  const handleBallKick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    
    const container = containerRef.current;
    const ballEl = ballElementRef.current;
    if (!container || !ballEl) return;

    const ballRect = ballEl.getBoundingClientRect();
    const clickX = e.clientX - (ballRect.left + ballRect.width / 2); // -r to +r
    
    // Apply English vector physics depending on where you kicked the ball
    let nextVx = ballRef.current.vx + (clickX / 10);
    // Limit horizontal wildness
    nextVx = Math.max(-6, Math.min(6, nextVx));

    // Heavy upward impulse
    const nextVy = -11.5;
    
    // Spin speed based on kick direction
    const nextRotationSpeed = -clickX * 1.5;

    ballRef.current = {
      ...ballRef.current,
      vx: nextVx,
      vy: nextVy,
      rotationSpeed: nextRotationSpeed
    };

    if (!isJuggling) {
      setIsJuggling(true);
    }

    playKickSound();
    
    // Spawn soccer confetti on tap position
    const containerRect = container.getBoundingClientRect();
    const spawnX = e.clientX - containerRect.left;
    const spawnY = e.clientY - containerRect.top;
    
    spawnSparkle(spawnX, spawnY);
    spawnSparkle(spawnX - 10, spawnY - 10);
    spawnSparkle(spawnX + 10, spawnY - 10);

    setJuggles(prev => {
      const nextJuggles = prev + 1;
      
      // Update high score
      if (nextJuggles > highScore) {
        setHighScore(nextJuggles);
        localStorage.setItem('fifa_juggle_high_score', String(nextJuggles));
      }

      // Check easter egg milestones
      if (nextJuggles === 5) {
        confetti({ particleCount: 15, spread: 45, colors: N_AMERICA_COLORS });
      } else if (nextJuggles === 10) {
        // Gold explosion!
        setEasterEggUnlocked(true);
        localStorage.setItem('unlocked_fifa_badge', 'true');
        playWhistleSound();
        
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#D4AF37', '#FFD700', '#FFFFFF']
        });
      }

      return nextJuggles;
    });
  };

  // Click on background
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Spawn custom sparkles
    for (let i = 0; i < 3; i++) {
      spawnSparkle(x + (Math.random() * 26 - 13), y + (Math.random() * 26 - 13));
    }
  };

  const isReadyToEnter = progress >= 100 && isAuthLoaded;

  // Auto transition on completed load
  useEffect(() => {
    if (isReadyToEnter) {
      const autoTimer = setTimeout(() => {
        onComplete();
      }, 3500); // Give them time to play, or they can skip!
      return () => clearTimeout(autoTimer);
    }
  }, [isReadyToEnter, onComplete]);

  return (
    <div
      id="football-loading-screen"
      ref={containerRef}
      onMouseDown={handleBackgroundClick}
      className={`fixed inset-0 w-full h-full overflow-hidden select-none flex flex-col justify-between p-8 md:p-12 cursor-pointer z-50 ${
        easterEggUnlocked 
          ? 'bg-gradient-to-b from-amber-500 via-yellow-500 to-amber-600 text-slate-950' 
          : 'bg-gradient-to-b from-[#FAF7F0] via-[#F4EDE0] to-[#EAE0D0] text-slate-900'
      }`}
    >
      {/* City Street map layout grids and paths */}
      <div className="absolute inset-0 stadium-grass opacity-15 pointer-events-none" />
      <div className="absolute inset-0 stadium-grid opacity-25 pointer-events-none" />
      
      {/* Dynamic glow city street lights */}
      <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        easterEggUnlocked ? 'bg-amber-400/30' : 'bg-blue-500/10'
      }`} />
      <div className={`absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        easterEggUnlocked ? 'bg-yellow-400/20' : 'bg-cyan-500/10'
      }`} />

      {/* Embedded community park map and pitch design element */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        {/* Center park pitch and circle */}
        <div className="w-80 h-80 border-4 border-dashed border-white/30 rounded-full flex items-center justify-center">
          <div className="w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        {/* Halfway community line */}
        <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent top-1/2 left-0" />
        <div className="absolute h-full w-1 bg-gradient-to-b from-transparent via-white/30 to-transparent left-1/2 top-0" />
      </div>

      <style>{`
        .stadium-grid {
          background-image: radial-gradient(rgba(59, 130, 246, 0.25) 1.5px, transparent 1.5px);
          background-size: 30px 30px;
        }
        .stadium-grass {
          background: repeating-linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0px,
            rgba(255, 255, 255, 0) 120px,
            rgba(255, 255, 255, 0.02) 120px,
            rgba(255, 255, 255, 0.02) 240px
          );
        }
        @keyframes shineGold {
          0%, 100% { color: #FFFFFF; text-shadow: 0 0 10px rgba(212, 175, 55, 0.3); }
          50% { color: #FFD700; text-shadow: 0 0 20px rgba(212, 175, 55, 0.8); }
        }
        .glow-gold {
          animation: shineGold 3s infinite ease-in-out;
        }
      `}</style>

      {/* Floating sparkles particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        <AnimatePresence>
          {sparkles.map((s) => (
            <motion.div
              key={s.id}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.1, opacity: s.opacity }}
              style={{
                position: 'absolute',
                fontSize: `${s.size}px`,
                color: s.color,
                left: s.x,
                top: s.y,
                transform: 'translate(-50%, -50%)',
                textShadow: '0 2px 4px rgba(0,0,0,0.4)'
              }}
              className="pointer-events-none font-bold"
            >
              {s.char}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* TOP STATUS BAR */}
      <div className="relative z-20 w-full flex items-center justify-between">
        <div className="flex items-center space-x-2.5 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/60 shadow-md">
          <Trophy className={`w-5 h-5 ${easterEggUnlocked ? 'text-amber-500 animate-bounce' : 'text-blue-500'}`} />
          <span className={`text-[11px] font-black tracking-widest font-mono uppercase ${
            easterEggUnlocked ? 'text-amber-600' : 'text-slate-700'
          }`}>
            COMMUNITY HERO • PARK CHAMPIONSHIP
          </span>
        </div>

        {/* Minimal Audio Toggle */}
        <button
          id="sound-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setSoundEnabled(!soundEnabled);
          }}
          className={`p-2.5 rounded-full border transition-all duration-200 flex items-center justify-center ${
            soundEnabled 
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 shadow-sm' 
              : 'bg-white/80 border-slate-200/60 text-slate-500 hover:bg-white'
          }`}
          title="Toggle stadium sounds!"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* FOOTER & LOADING PROGRESS BAR */}
      <div className="relative z-20 w-full max-w-md mx-auto flex flex-col items-center space-y-6 my-auto">
        
        {/* Whimsical Fact/Status */}
        <div className="h-14 flex items-center justify-center px-4 text-center max-w-sm">
          <AnimatePresence mode="wait">
            <motion.p
              key={activeMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-xs md:text-sm font-extrabold tracking-wide leading-relaxed text-slate-900 bg-white/95 border border-slate-200/60 px-5 py-2.5 rounded-2xl shadow-md backdrop-blur-md"
            >
              {activeMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* NEIGHBORHOOD PROGRESS BAR */}
        <div className="w-full space-y-2 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/60 shadow-lg overflow-visible relative">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-600">
            <span>COMMUNITY DISPATCHING</span>
            <span className={easterEggUnlocked ? 'text-amber-600' : 'text-blue-600'}>{Math.round(progress)}%</span>
          </div>

          <div className="w-full h-4 rounded-full bg-slate-100 border border-slate-200 p-0.5 relative overflow-visible shadow-inner">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
              className={`h-full rounded-full relative transition-colors duration-1000 ${
                easterEggUnlocked 
                  ? 'bg-gradient-to-r from-yellow-500 via-amber-500 to-amber-300' 
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-full" />
              
              {/* Soccer Ball PNG/SVG rolling along the progress line */}
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 pointer-events-none flex items-center justify-center z-30"
                style={{
                  transform: `translate(50%, -50%) rotate(${progress * 7.2}deg)`
                }}
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg" 
                  alt="Rolling Football" 
                  className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* BUTTON ACTION CONTAINER */}
        <div className="pt-2 flex flex-col items-center space-y-3 w-full">
          {isReadyToEnter ? (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={onComplete}
              className={`px-7 py-3.5 w-full rounded-xl hover:brightness-110 text-xs font-black tracking-widest font-mono shadow-lg transition-all flex items-center justify-center space-x-2 border cursor-pointer ${
                easterEggUnlocked
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 shadow-amber-500/10'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500/20 shadow-blue-500/10'
              }`}
            >
              <span>COMMUNITY KICK-OFF</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <button
              onClick={onComplete}
              className="text-[10px] font-mono tracking-widest text-slate-500 hover:text-slate-700 transition-colors py-2 px-4 rounded-lg border border-slate-200 hover:border-slate-300 bg-white/40 backdrop-blur-md uppercase font-black"
            >
              Skip Loading Screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
