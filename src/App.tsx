import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Issue } from './types';
import BottomNav from './components/BottomNav';
import FeedView from './components/FeedView';
import MapView from './components/MapView';
import ReportView from './components/ReportView';
import DashboardView from './components/DashboardView';
import ProfileView from './components/ProfileView';
import LoginGate from './components/LoginGate';
import RainbowLoadingScreen from './components/RainbowLoadingScreen';
import { useToast } from './components/Toast';
import { Sparkles, Loader2 } from 'lucide-react';

export default function App() {
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  const [activeTab, setActiveTab] = useState<string>('feed');
  const [selectedIssueForDetail, setSelectedIssueForDetail] = useState<Issue | null>(null);

  // Authenticate user on mount; gracefully fall back to Local Guest if anonymous auth fails
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Load or initialize user profile in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        let userDoc: any = null;
        let isOffline = false;

        try {
          userDoc = await getDoc(userDocRef);
        } catch (e: any) {
          const isNetworkError = e?.message?.toLowerCase().includes('offline') || e?.code === 'unavailable';
          if (isNetworkError) {
            console.warn("Failed to load user profile from Firestore (offline/cached mode):", e.message || e);
          } else {
            console.error("Failed to load user profile from Firestore:", e);
          }
          isOffline = true;
        }

        let profileData: UserProfile;
        
        // Retrieve local guest session info if any
        let localProfile: UserProfile | null = null;
        const guestProfileStr = localStorage.getItem('community_hero_guest_profile');
        if (guestProfileStr) {
          try {
            localProfile = JSON.parse(guestProfileStr);
          } catch (e) {}
        }

        // Try to load cached auth profile
        const cachedProfileStr = localStorage.getItem(`community_hero_user_profile_${user.uid}`);
        let cachedAuthProfile: UserProfile | null = null;
        if (cachedProfileStr) {
          try {
            cachedAuthProfile = JSON.parse(cachedProfileStr);
          } catch (e) {}
        }

        if (userDoc && userDoc.exists()) {
          profileData = userDoc.data() as UserProfile;
          if (profileData.emergencyAttentionsLeft === undefined) {
            profileData.emergencyAttentionsLeft = 3;
          }
          
          // Migrate local guest points/badges if they accumulated points as guest
          if (localProfile && localProfile.points > 10) {
            profileData.points = (profileData.points || 0) + (localProfile.points - 10);
            if (localProfile.badges && localProfile.badges.length > 0) {
              const uniqueBadges = Array.from(new Set([...(profileData.badges || []), ...(localProfile.badges || [])]));
              profileData.badges = uniqueBadges;
            }
            await setDoc(userDocRef, profileData).catch(() => {});
            // Clear local guest profile after migration
            localStorage.removeItem('community_hero_guest_profile');
            localStorage.removeItem('community_hero_guest_uid');
          }
          // Cache the profile
          localStorage.setItem(`community_hero_user_profile_${user.uid}`, JSON.stringify(profileData));
        } else if (isOffline && cachedAuthProfile) {
          profileData = cachedAuthProfile;
        } else {
          // Initialize new passport profile
          profileData = {
            id: user.uid,
            displayName: user.displayName || `Citizen-${user.uid.slice(0, 5)}`,
            photoURL: user.photoURL || '',
            points: (localProfile ? localProfile.points : 10), // Carry over local points
            badges: (localProfile ? localProfile.badges : []), // Carry over local badges
            isAnonymous: user.isAnonymous,
            dailyReportCount: (localProfile ? localProfile.dailyReportCount : 0),
            emergencyAttentionsLeft: 3
          };
          
          if (!isOffline) {
            await setDoc(userDocRef, profileData).catch(() => {});
          }
          
          // Clear local guest profile after migration
          if (localProfile) {
            localStorage.removeItem('community_hero_guest_profile');
            localStorage.removeItem('community_hero_guest_uid');
          }
          // Cache the profile
          localStorage.setItem(`community_hero_user_profile_${user.uid}`, JSON.stringify(profileData));
        }

        setCurrentUser(user);
        setCurrentUserProfile(profileData);
        setAuthLoading(false);
      } else {
        // Check if they have an active local guest session
        const guestProfileStr = localStorage.getItem('community_hero_guest_profile');
        if (guestProfileStr) {
          try {
            // Trigger frictionless anonymous login in the background to sync with firebase auth
            await signInAnonymously(auth);
          } catch (err) {
            // Fallback to local guest profile completely
            let guestUid = localStorage.getItem('community_hero_guest_uid') || 'guest-' + Math.random().toString(36).substring(2, 11);
            let guestProfile: UserProfile;
            try {
              guestProfile = JSON.parse(guestProfileStr);
            } catch (e) {
              guestProfile = {
                id: guestUid,
                displayName: 'Guest Citizen',
                photoURL: '',
                points: 10,
                badges: [],
                isAnonymous: true,
                dailyReportCount: 0,
                emergencyAttentionsLeft: 3
              };
            }
            setCurrentUser({
              uid: guestUid,
              displayName: guestProfile.displayName,
              photoURL: '',
              isAnonymous: true,
              isLocalGuest: true
            });
            setCurrentUserProfile(guestProfile);
            setAuthLoading(false);
          }
        } else {
          // Clean states - wait for user interaction in LoginGate
          setCurrentUser(null);
          setCurrentUserProfile(null);
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to profile updates in real-time (skip for Local Guest to avoid permission errors)
  useEffect(() => {
    if (!currentUser || currentUser.isLocalGuest) return;
    const userDocRef = doc(db, 'users', currentUser.uid);
    const interval = setInterval(async () => {
      const snap = await getDoc(userDocRef).catch(() => null);
      if (snap && snap.exists()) {
        setCurrentUserProfile(snap.data() as UserProfile);
      }
    }, 4000); // Poll profile score/points changes safely every 4s
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleSelectMapLocation = (lat: number, lng: number) => {
    setActiveTab('map');
  };

  const handleSelectIssueFromMap = (issue: Issue) => {
    setSelectedIssueForDetail(issue);
    setActiveTab('feed');
  };

  const handleLoginWithGoogle = async () => {
    const { googleSignIn } = await import('./utils/googleAuth');
    await googleSignIn();
  };

  const handleLoginAsGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("Anonymous auth disabled in console. Initializing local storage guest session.", err);
      let guestUid = localStorage.getItem('community_hero_guest_uid');
      if (!guestUid) {
        guestUid = 'guest-' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('community_hero_guest_uid', guestUid);
      }
      
      const guestUser = {
        uid: guestUid,
        displayName: 'Guest Citizen',
        photoURL: '',
        isAnonymous: true,
        isLocalGuest: true
      };
      
      const guestProfile: UserProfile = {
        id: guestUid,
        displayName: 'Guest Citizen',
        photoURL: '',
        points: 10,
        badges: [],
        isAnonymous: true,
        dailyReportCount: 0,
        emergencyAttentionsLeft: 3
      };
      
      localStorage.setItem('community_hero_guest_profile', JSON.stringify(guestProfile));
      setCurrentUser(guestUser);
      setCurrentUserProfile(guestProfile);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('community_hero_guest_profile');
      localStorage.removeItem('community_hero_guest_uid');
      setCurrentUser(null);
      setCurrentUserProfile(null);
      setActiveTab('feed');
      toast.success("Successfully logged out.");
    } catch (err: any) {
      toast.error("Failed to log out: " + err.message);
    }
  };

  const handleUpdateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUserProfile) return;
    const updated = { ...currentUserProfile, ...updates };
    setCurrentUserProfile(updated);
    
    try {
      if (currentUser && !currentUser.isLocalGuest) {
        const docRef = doc(db, 'users', currentUser.uid);
        await updateDoc(docRef, updates);
      } else {
        localStorage.setItem('community_hero_guest_profile', JSON.stringify(updated));
      }
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      console.error("Firestore user update failed:", err);
      toast.error("Failed to update profile: " + err.message);
    }
  };

  // Award FIFA 2026 Easter Egg Badge and Points
  useEffect(() => {
    if (!currentUserProfile) return;
    const hasUnlockedBadge = localStorage.getItem('unlocked_fifa_badge') === 'true';
    const hasBeenAwarded = localStorage.getItem('fifa_juggling_badge_awarded') === 'true';
    
    if (hasUnlockedBadge && !hasBeenAwarded) {
      const currentBadges = currentUserProfile.badges || [];
      if (!currentBadges.includes('⚽ Juggling Champ')) {
        const updatedBadges = [...currentBadges, '⚽ Juggling Champ'];
        const updatedPoints = (currentUserProfile.points || 0) + 50;
        
        handleUpdateUserProfile({
          badges: updatedBadges,
          points: updatedPoints
        });
        
        localStorage.setItem('fifa_juggling_badge_awarded', 'true');
        setTimeout(() => {
          toast.success("🏆 FIFA 2026 Easter Egg Unlocked! Awarded '⚽ Juggling Champ' Badge & +50 Citizen Points!");
        }, 1200);
      } else {
        localStorage.setItem('fifa_juggling_badge_awarded', 'true');
      }
    }
  }, [currentUserProfile]);

  if (showLoadingScreen) {
    return (
      <RainbowLoadingScreen 
        isAuthLoaded={!authLoading} 
        onComplete={() => setShowLoadingScreen(false)} 
      />
    );
  }

  // If no user is logged in, present the Login Gate!
  if (!currentUser) {
    return (
      <LoginGate 
        onLoginWithGoogle={handleLoginWithGoogle} 
        onLoginAsGuest={handleLoginAsGuest} 
      />
    );
  }

  return (
    <div id="app-viewport" className="w-full h-screen bg-beach-sand flex flex-col relative text-slate-800 antialiased overflow-hidden">
      {/* Scrollable Viewport area */}
      <div id="main-content-viewport" className="flex-1 w-full overflow-hidden relative">
        {activeTab === 'feed' && (
          <FeedView 
            onSelectMapLocation={handleSelectMapLocation} 
            currentUser={currentUser}
            currentUserProfile={currentUserProfile}
            onUpdateUserProfile={handleUpdateUserProfile}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'map' && (
          <MapView 
            onSelectIssue={handleSelectIssueFromMap}
          />
        )}

        {activeTab === 'report' && (
          <ReportView 
            onReportSuccess={() => setActiveTab('feed')} 
            currentUser={currentUser}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView currentUser={currentUser} />
        )}

        {activeTab === 'profile' && (
          <ProfileView 
            currentUserProfile={currentUserProfile} 
            currentUser={currentUser}
            onSignOut={handleSignOut}
            onRequestShowLoadingScreen={() => setShowLoadingScreen(true)}
            onUpdateUserProfile={handleUpdateUserProfile}
          />
        )}
      </div>

      {/* Persistent Glassmorphic Bottom Navigation */}
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onReportClick={() => setActiveTab('report')}
      />
    </div>
  );
}
