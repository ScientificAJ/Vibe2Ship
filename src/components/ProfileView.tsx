import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Award, Shield, Sparkles, User, LogIn, Flame, Trophy, Check, RefreshCw, FolderOpen, TableProperties, CalendarDays, CheckSquare, FileText, MessageSquareShare, FileEdit, Wand2, Pencil, X } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { googleSignIn, addTokenListener, logoutWorkspace } from '../utils/googleAuth';
import { motion } from 'motion/react';
import { useToast } from './Toast';
import confetti from 'canvas-confetti';

export function getCitizenRank(points: number): { title: string; colorClass: string; desc: string } {
  if (points >= 200) {
    return { title: 'Legendary Citizen', colorClass: 'text-amber-700 bg-amber-50 border-amber-200/60', desc: 'Eminent town veteran status' };
  }
  if (points >= 100) {
    return { title: 'Civic Protector', colorClass: 'text-orange-700 bg-orange-50 border-orange-200/60', desc: 'Outstanding ward-level champion' };
  }
  if (points >= 60) {
    return { title: 'Ward Guardian', colorClass: 'text-sky-700 bg-sky-50 border-sky-200/60', desc: 'Active guardian of local streets' };
  }
  if (points >= 30) {
    return { title: 'Active Witness', colorClass: 'text-teal-700 bg-teal-50 border-teal-200/60', desc: 'Contributor of critical verifications' };
  }
  return { title: 'Novice Observer', colorClass: 'text-slate-500 bg-slate-50 border-slate-200/60', desc: 'Learning the ropes of local activism' };
}

export const CITIZEN_CREST_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="48" fill="#FFF8E1" stroke="#FF8A65" stroke-width="2"/>
  <circle cx="50" cy="38" r="16" fill="#FF8A65"/>
  <path d="M24 75 C24 58, 76 58, 76 75 Z" fill="#FF8A65"/>
  <circle cx="50" cy="50" r="44" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.8"/>
</svg>
`.trim())}`;

interface ProfileViewProps {
  currentUserProfile: UserProfile | null;
  currentUser: any;
  onSignOut?: () => void;
  onRequestShowLoadingScreen?: () => void;
  onUpdateUserProfile?: (updates: Partial<UserProfile>) => Promise<void> | void;
}

export default function ProfileView({ 
  currentUserProfile, 
  currentUser, 
  onSignOut, 
  onRequestShowLoadingScreen,
  onUpdateUserProfile
}: ProfileViewProps) {
  const toast = useToast();
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  
  // Inline edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: UserProfile[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setLeaderboard(fetched);
    }, (error) => {
      console.warn("Leaderboard onSnapshot offline/permission error:", error);
      if (currentUserProfile) {
        setLeaderboard([currentUserProfile]);
      }
    });

    return () => unsubscribe();
  }, [currentUserProfile]);

  useEffect(() => {
    // Subscribe to Google Workspace access token changes
    const unsubscribeToken = addTokenListener((token) => {
      setAccessTokenState(token);
    });
    return () => unsubscribeToken();
  }, []);

  const handleLinkGoogle = async () => {
    setLinkError(null);
    try {
      await googleSignIn();
      toast.success("Successfully connected Google Workspace!");
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.warn("Linking cancelled by user", err.message || err);
        toast.warning("Google linking cancelled.");
      } else {
        console.error("Linking failed", err);
        toast.error("Failed to connect Google Account.");
      }
      if (err?.code === 'auth/popup-closed-by-user') {
        setLinkError("The Google sign-in window was closed before completing authentication. Please try again or click the tip below to run in a new tab.");
      } else {
        setLinkError(err?.message || "Failed to connect to Google Account.");
      }
    }
  };

  const badgeDescriptions: Record<string, string> = {
    'Verified Eyewitness': 'Confirmed reported community issues on-location',
    'Fix Verifier': 'Uploaded valid before/after proof to close a civic issue',
    'Safety Scout': 'First reporter of a Critical or High hazard',
    'Noise Filter': 'Identified spam or invalid complaints successfully',
    'Community Hero': 'Earned over 100 civic engagement points'
  };

  return (
    <div className="w-full h-full max-w-md mx-auto px-4 pt-4 pb-24 overflow-y-auto space-y-5 text-left">
      {/* User Passport Header Card */}
      <div className="bg-white border border-beach-cream rounded-3xl p-5 relative overflow-hidden shadow-md">
        <div className="absolute top-4 right-4 text-beach-coral">
          <Award className="w-8 h-8 animate-pulse" />
        </div>

        <div className="flex gap-4 items-center">
          <img 
            src={currentUser?.photoURL || CITIZEN_CREST_URL} 
            alt="Avatar" 
            className="w-16 h-16 rounded-full border border-beach-coral/20 object-cover bg-beach-cream/30" 
            referrerPolicy="no-referrer"
          />

          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="bg-beach-sand border border-beach-cream px-2 py-0.5 rounded text-xs text-beach-driftwood font-bold outline-none focus:border-beach-coral max-w-[120px]"
                  maxLength={25}
                  autoFocus
                />
                <button
                  onClick={async () => {
                    if (tempName.trim() && onUpdateUserProfile) {
                      await onUpdateUserProfile({ displayName: tempName.trim() });
                    }
                    setIsEditingName(false);
                  }}
                  className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded cursor-pointer"
                  title="Save Name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h2 className="text-base font-bold text-beach-driftwood flex items-center gap-1.5">
                <span className="truncate max-w-[140px]">
                  {currentUserProfile?.displayName || currentUser?.displayName || 'Anonymous Hero'}
                </span>
                <button
                  onClick={() => {
                    setTempName(currentUserProfile?.displayName || currentUser?.displayName || 'Anonymous Hero');
                    setIsEditingName(true);
                  }}
                  className="p-1 text-slate-400 hover:text-beach-coral transition-colors cursor-pointer rounded"
                  title="Edit Display Name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {(currentUser?.isAnonymous || currentUser?.isLocalGuest) && (
                  <span className="text-[9px] bg-beach-cream text-slate-600 px-2 py-0.5 rounded-full border border-beach-cream/85 font-bold shrink-0">
                    {currentUser?.isLocalGuest ? 'Local Guest' : 'Anon'}
                  </span>
                )}
              </h2>
            )}
            <p className="text-[10px] text-slate-500 mt-0.5">Civic Passport ID: {currentUser?.uid?.slice(0, 10)}...</p>
            
            {(() => {
              const rank = getCitizenRank(currentUserProfile?.points || 0);
              return (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="mt-1.5 inline-flex items-center">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border leading-none ${rank.colorClass}`}>
                    Rep: {rank.title}
                  </span>
                </motion.div>
              );
            })()}

            <motion.div 
              className="flex items-center gap-1.5 mt-2 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent px-3 py-1.5 rounded-xl border border-orange-500/10 w-fit cursor-pointer shadow-sm select-none"
              whileHover={{ scale: 1.05, y: -2, boxShadow: "0 4px 12px rgba(249,115,22,0.08)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.6 }
                });
              }}
              title="Click to celebrate your civic progress!"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.25, 1],
                  filter: ["drop-shadow(0 0 2px rgba(249,115,22,0.2))", "drop-shadow(0 0 8px rgba(249,115,22,0.5))", "drop-shadow(0 0 2px rgba(249,115,22,0.2))"]
                }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              >
                <Flame className="text-orange-500 w-4.5 h-4.5 shrink-0" />
              </motion.div>
              <span className="text-xs font-bold text-slate-700">
                <span className="text-orange-600 text-sm font-extrabold mr-0.5">{currentUserProfile?.points || 0}</span> Civic Points
              </span>
            </motion.div>
          </div>
        </div>
 
        {(currentUser?.isAnonymous || currentUser?.isLocalGuest || !accessToken) && (
          <div className="mt-4 pt-4 border-t border-beach-cream space-y-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Connect your Google Account to preserve your civic badges, track ranking, and enable live Google Drive, Sheets, Docs, Calendar, Tasks, and Chat sync.
            </p>

            {linkError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-[10px] font-semibold flex items-start gap-1.5 leading-relaxed text-left">
                <span className="text-xs">⚠️</span>
                <span>{linkError}</span>
              </div>
            )}

            <button
              onClick={handleLinkGoogle}
              className="w-full py-2 bg-beach-coral hover:bg-beach-coral/90 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-white" /> {accessToken ? 'Re-authorize Workspace' : 'Connect Google & Workspace'}
            </button>

            {isIframe && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl text-[10px] text-slate-600 leading-relaxed text-left space-y-1">
                <span className="font-bold text-amber-800 block">💡 Connection Tip:</span>
                <span>
                  Previews inside iframes can block Google popups. If this button fails or hangs, please{' '}
                  <a 
                    href={window.location.href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-beach-coral underline font-bold hover:text-beach-coral/85"
                  >
                    click here to open in a new tab
                  </a>{' '}
                  to authenticate smoothly.
                </span>
              </div>
            )}
          </div>
        )}

        {onSignOut && (
          <div className="mt-3 pt-3 border-t border-beach-cream/50">
            <button
              onClick={onSignOut}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              Log Out / End Session
            </button>
          </div>
        )}
      </div>

      {/* Google Workspace Integration Hub Status */}
      <div className="bg-white border border-beach-cream shadow-sm p-4 rounded-2xl space-y-3.5">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${accessToken ? 'text-emerald-500 animate-spin-slow' : 'text-slate-400'}`} /> Google Workspace Hub
          </h3>
          <span className={`text-[9px] px-2 py-0.5 font-bold rounded-full border ${
            accessToken 
              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' 
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {accessToken ? 'Linked & Synced' : 'Offline / Local'}
          </span>
        </div>

        {accessToken ? (
          <div className="space-y-2.5">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Your community actions are synchronized with Google Workspace. Select reports on the feed to trigger actions.
            </p>

            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-slate-700">Google Drive Cases</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ready</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <TableProperties className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700">Google Sheets DB</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ready</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">Google Calendar Rallies</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ready</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">Google Tasks Items</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ready</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-slate-700">Google Docs Petitions</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ready</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <MessageSquareShare className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700">Google Chat Dispatch</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ready</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold text-slate-600">Local Keep Archive</span>
                </div>
                <span className="text-[9px] font-bold text-slate-500">Local Cache</span>
              </div>
            </div>

            <button
              onClick={() => {
                logoutWorkspace();
                toast.info("Disconnected from Google Workspace.");
              }}
              className="w-full mt-1.5 py-2 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Disconnect Workspace
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 text-center py-4">
            <p className="text-xs text-slate-500 italic max-w-[280px] mx-auto leading-relaxed">
              Google Workspace integration is currently offline. Connect your Google account to unlock advanced civic escalation tools.
            </p>
            <button
              onClick={handleLinkGoogle}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign in with Google
            </button>
          </div>
        )}
      </div>

      {/* Badges passport view */}
      <div className="bg-white border border-beach-cream shadow-sm p-4 rounded-2xl space-y-3.5">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4.5 h-4.5 text-beach-coral" /> Earned Civic Badges
          </h3>
          {currentUserProfile?.badges && currentUserProfile.badges.length > 0 && (
            <span className="text-[9px] font-black bg-beach-cream/50 px-2 py-0.5 rounded-full text-slate-600 border border-beach-cream/80">
              {currentUserProfile.badges.length} Badges
            </span>
          )}
        </div>

        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.12
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="space-y-2.5"
        >
          {currentUserProfile?.badges && currentUserProfile.badges.length > 0 ? (
            currentUserProfile.badges.map((badge, idx) => (
              <motion.div 
                key={idx}
                variants={{
                  hidden: { opacity: 0, y: 12, scale: 0.96 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 20 } }
                }}
                whileHover={{ 
                  scale: 1.02, 
                  x: 3,
                  boxShadow: "0 4px 12px rgba(224,130,102,0.04)",
                  borderColor: "rgba(224,130,102,0.3)"
                }}
                className="bg-beach-cream/20 p-3 rounded-xl border border-beach-cream/85 flex items-start gap-3 transition-colors duration-200"
              >
                <motion.div 
                  className="p-2 bg-beach-coral/10 rounded-lg border border-beach-coral/15 shrink-0"
                  whileHover={{ rotate: 15, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Sparkles className="w-4.5 h-4.5 text-beach-coral" />
                </motion.div>
                <div className="text-left">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {badge}
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 + idx * 0.1 }}
                      className="text-[8px] font-extrabold bg-emerald-500/10 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-wider"
                    >
                      Unlocked
                    </motion.span>
                  </h4>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                    {badgeDescriptions[badge] || 'Honorable ward contributor achievement'}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center py-6"
            >
              <p className="text-xs text-slate-500 italic">No badges acquired yet. Confirm eyewitness accounts or report issues to unlock credentials!</p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Whimsical Features */}
      <div className="bg-white border border-beach-cream shadow-sm p-4 rounded-2xl space-y-3.5 text-left">
        <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider flex items-center gap-1.5">
          <Wand2 className="w-4.5 h-4.5 text-pink-500 animate-pulse" /> Whimsical Features
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Need a burst of joy? Replay our magical interactive rainbow screen, customized with sound effects, gravity switches, and sparkles!
        </p>
        <button
          onClick={onRequestShowLoadingScreen}
          className="w-full py-2.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:brightness-110 active:scale-95 cursor-pointer border border-white/10"
        >
          <Sparkles className="w-4 h-4 text-yellow-300 animate-spin-slow" />
          Play Rainbow Loading Screen
        </button>
      </div>

      {/* Ward Leaderboard */}
      <div className="bg-white border border-beach-cream shadow-sm p-4 rounded-2xl space-y-3.5">
        <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider flex items-center gap-1.5">
          <Trophy className="w-4.5 h-4.5 text-amber-500" /> Top Ward Contributors
        </h3>

        <div className="space-y-2">
          {leaderboard.map((user, idx) => (
            <div 
              key={user.id} 
              className={`p-2.5 rounded-xl border flex justify-between items-center ${
                user.id === currentUser?.uid 
                  ? 'bg-sky-500/5 border-sky-500/15' 
                  : 'bg-beach-cream/20 border-beach-cream/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-black text-slate-400 w-4">{idx + 1}</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-snug">{user.displayName || 'Anonymous Hero'}</span>
                  <span className="text-[9px] font-extrabold text-slate-400 tracking-wider leading-none uppercase">
                    {getCitizenRank(user.points || 0).title}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-beach-ocean">{user.points || 0} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

