import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, User, Sparkles, Trophy, ShieldCheck, RefreshCw, AlertCircle, HeartHandshake } from 'lucide-react';

interface LoginGateProps {
  onLoginWithGoogle: () => Promise<void>;
  onLoginAsGuest: () => Promise<void>;
}

export default function LoginGate({ onLoginWithGoogle, onLoginAsGuest }: LoginGateProps) {
  const [loadingMode, setLoadingMode] = useState<'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    try {
      setLoadingMode('google');
      setError(null);
      await onLoginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Google Authentication failed. Please try again.');
    } finally {
      setLoadingMode(null);
    }
  };

  const handleGuestAuth = async () => {
    try {
      setLoadingMode('guest');
      setError(null);
      await onLoginAsGuest();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Guest session initialization failed.');
    } finally {
      setLoadingMode(null);
    }
  };

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="min-h-screen bg-beach-sand flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background sun & ripple elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-beach-sun/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-beach-coral/5 blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-beach-cream/80 rounded-[32px] p-8 shadow-xl relative z-10 space-y-6"
      >
        {/* App Logo & Branding */}
        <div className="text-center space-y-3">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
            className="inline-flex p-4 bg-beach-coral/10 rounded-2xl border border-beach-coral/20 text-beach-coral mx-auto"
          >
            <HeartHandshake className="w-8 h-8" />
          </motion.div>
          
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-beach-driftwood tracking-tight">
              Community Hero
            </h1>
            <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">
              Escalate issues, earn reputation, and organize ward-level civic changes dynamically.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 gap-3.5 pt-2">
          <div className="flex gap-3 items-start p-3.5 bg-beach-cream/10 border border-beach-cream rounded-2xl">
            <div className="p-2 bg-beach-sun/10 rounded-xl border border-beach-sun/20 text-beach-sun shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-beach-driftwood">Civic Reputations & Leaderboards</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                Gain local and global reputation (Reps) for upvoting, verifying, and reporting hazards.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start p-3.5 bg-beach-cream/10 border border-beach-cream rounded-2xl">
            <div className="p-2 bg-beach-seafoam/10 rounded-xl border border-beach-seafoam/20 text-beach-seafoam shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-beach-driftwood">Verified Eyewitness Audits</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                Upload real photographic proof to verify reports and help Municipal agencies resolve cases.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start p-3.5 bg-beach-cream/10 border border-beach-cream rounded-2xl">
            <div className="p-2 bg-beach-ocean/10 rounded-xl border border-beach-ocean/20 text-beach-ocean shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-beach-driftwood">Google Workspace Hub Connection</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                Instantly sync cases to live Google Sheets database, Docs petitions, Calendar meetings, Tasks, and Google Chat warnings.
              </p>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-[11px] font-semibold flex items-start gap-2 text-left"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Access Actions Panel */}
        <div className="space-y-3.5 pt-2">
          {/* Google Login Button */}
          <button
            onClick={handleGoogleAuth}
            disabled={loadingMode !== null}
            className="w-full h-12 bg-beach-coral hover:bg-beach-coral/95 active:scale-[0.98] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md shadow-beach-coral/20 cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
          >
            {loadingMode === 'google' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <LogIn className="w-4 h-4 text-white" />
            )}
            <span>Sign in with Google Account</span>
          </button>

          {/* Continue as Guest Button */}
          <button
            onClick={handleGuestAuth}
            disabled={loadingMode !== null}
            className="w-full h-12 bg-white hover:bg-beach-cream/25 active:scale-[0.98] text-beach-driftwood border border-beach-cream text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
          >
            {loadingMode === 'guest' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-beach-coral" />
            ) : (
              <User className="w-4 h-4 text-slate-500" />
            )}
            <span>Continue as Guest Citizen</span>
          </button>

          {/* Iframe help reminder */}
          {isIframe && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl text-[10px] text-slate-600 leading-relaxed text-left space-y-1">
              <span className="font-bold text-amber-800 block">💡 Connection Tip:</span>
              <span>
                Browsers often block popups and sign-in credentials inside preview frames. If Google Sign-In hangs or fails, please{' '}
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-beach-coral underline font-bold hover:text-beach-coral/85"
                >
                  click here to open in a new tab
                </a>{' '}
                to sign in smoothly!
              </span>
            </div>
          )}

          {/* Footnote information */}
          <p className="text-[9px] text-slate-400 text-center leading-relaxed font-medium px-4">
            Guest citizens earn reputation points locally. You can easily upgrade and link with a Google Account anytime on your Passport page.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
