import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  where,
  increment,
  arrayUnion,
  getDocsFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Issue, Comment, UserProfile, AppNotification } from '../types';
import { 
  AlertTriangle, 
  ThumbsUp, 
  CheckCircle, 
  MapPin, 
  MessageSquare, 
  Share2, 
  ArrowUpRight, 
  ShieldAlert, 
  Award,
  Sparkles,
  Camera,
  Calendar,
  X,
  Send,
  User,
  HeartHandshake,
  FolderOpen,
  TableProperties,
  CalendarDays,
  CheckSquare,
  FileText,
  MessageSquareShare,
  RefreshCw,
  FileEdit,
  Check,
  Loader,
  Search,
  Bell,
  BellOff,
  Lightbulb,
  Droplets,
  ArrowRight
} from 'lucide-react';
import { addTokenListener } from '../utils/googleAuth';
import { 
  exportToDocs, 
  exportToSheets, 
  scheduleOnCalendar, 
  createTaskItem, 
  listChatSpaces, 
  postChatMessage, 
  createKeepNote,
  ChatSpace 
} from '../utils/googleWorkspace';

import confetti from 'canvas-confetti';
import { 
  getLocalIssues, 
  saveLocalIssue,
  getLocalComments, 
  saveLocalComment, 
  saveLocalUpvote, 
  getLocalUpvotes, 
  saveLocalVerification, 
  getLocalVerifications, 
  updateLocalProfilePoints, 
  updateLocalIssue,
  getLocalNotifications,
  saveLocalNotification,
  markLocalNotificationRead,
  markAllLocalNotificationsRead
} from '../utils/localPersistence';

import { triggerHaptic } from '../utils/haptics';
import { useToast } from './Toast';

import IssueDetailModal from './IssueDetailModal';

export const NANO_MASCOT_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="48" fill="#FFF8E1" stroke="#FF8A65" stroke-width="2"/>
  <rect x="47" y="12" width="6" height="12" fill="#FF8A65" rx="3"/>
  <circle cx="50" cy="10" r="5" fill="#FF5722"/>
  <rect x="24" y="24" width="52" height="46" rx="14" fill="#ECEFF1" stroke="#37474F" stroke-width="3"/>
  <rect x="30" y="30" width="40" height="26" rx="8" fill="#263238"/>
  <circle cx="42" cy="43" r="4" fill="#00E5FF"/>
  <circle cx="58" cy="43" r="4" fill="#00E5FF"/>
  <path d="M 44 49 C 44 49 50 54 56 49" stroke="#00E5FF" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="35" cy="48" r="2.5" fill="#FF8A65" opacity="0.6"/>
  <circle cx="65" cy="48" r="2.5" fill="#FF8A65" opacity="0.6"/>
  <rect x="42" y="70" width="16" height="8" fill="#B0BEC5" stroke="#37474F" stroke-width="3"/>
  <rect x="18" y="38" width="6" height="18" rx="3" fill="#FF8A65"/>
  <rect x="76" y="38" width="6" height="18" rx="3" fill="#FF8A65"/>
</svg>
`.trim())}`;

interface FeedViewProps {
  onSelectMapLocation?: (lat: number, lng: number) => void;
  currentUser: any;
  currentUserProfile?: UserProfile | null;
  onUpdateUserProfile?: (updates: Partial<UserProfile>) => void;
  onNavigateToTab?: (tab: string) => void;
}

export default function FeedView({ onSelectMapLocation, currentUser, currentUserProfile, onUpdateUserProfile, onNavigateToTab }: FeedViewProps) {
  const toast = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [myUpvotes, setMyUpvotes] = useState<string[]>(() => getLocalUpvotes());
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Resolution upload state
  const [isResolving, setIsResolving] = useState(false);
  const [resolveMedia, setResolveMedia] = useState<string | null>(null);
  const [isVerifyingFix, setIsVerifyingFix] = useState(false);
  const [fixVerdict, setFixVerdict] = useState<string | null>(null);

  // Amplification state
  const [isAmplifying, setIsAmplifying] = useState(false);
  const [amplifiedMessage, setAmplifiedMessage] = useState<string | null>(null);

  // Notifications state & synchronization
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Pull-to-refresh mechanism state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const activeDragRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || isRefreshing) return;

    // Only allow pulling if scroll position is at the top
    if (container.scrollTop <= 0) {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startYRef.current = clientY;
      activeDragRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!activeDragRef.current || startYRef.current === null || isRefreshing) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const diffY = clientY - startYRef.current;

    if (diffY > 0) {
      // Prevent browser overflow bounce and pull-to-reload
      if (e.cancelable) {
        e.preventDefault();
      }
      const maxPull = 120;
      const progress = diffY / 300;
      const dragDistance = Math.min(maxPull, diffY * (1 - Math.min(0.5, progress)));
      setPullDistance(dragDistance);
    } else {
      setPullDistance(0);
      activeDragRef.current = false;
    }
  };

  const handleTouchEnd = async () => {
    if (!activeDragRef.current || isRefreshing) return;
    activeDragRef.current = false;
    startYRef.current = null;

    if (pullDistance >= 60) {
      await triggerRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const triggerRefresh = async () => {
    setIsRefreshing(true);
    setPullDistance(60);
    triggerHaptic([40, 30]);

    try {
      let q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
      if (activeCategory !== 'All') {
        q = query(collection(db, 'issues'), where('category', '==', activeCategory));
      }

      // Force fetch directly from Firestore server
      const snapshot = await getDocsFromServer(q);
      const fetched: Issue[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Issue);
      });

      // Merge local guest issues
      const localIssues = getLocalIssues().filter(i => activeCategory === 'All' || i.category === activeCategory);
      const allMerged = [...localIssues, ...fetched];

      const localUpvotes = getLocalUpvotes();
      const localVerifications = getLocalVerifications();

      const enriched = allMerged.map(issue => {
        let upvotes = issue.upvotes || 0;
        let verificationCount = issue.verification_count || 0;
        
        if (localUpvotes.includes(issue.id)) {
          if (currentUser?.isLocalGuest) {
            upvotes += 1;
          }
        }
        
        if (localVerifications.includes(issue.id)) {
          if (currentUser?.isLocalGuest) {
            verificationCount += 1;
          }
        }
        
        return {
          ...issue,
          upvotes,
          verification_count: verificationCount
        };
      });

      // Sort
      enriched.sort((a, b) => {
        const aEmergency = a.emergencyFlaggedBy?.length || 0;
        const bEmergency = b.emergencyFlaggedBy?.length || 0;
        
        if (aEmergency !== bEmergency) {
          return bEmergency - aEmergency;
        }
        
        if (sortBy === 'severity') {
          const priority: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
          return (priority[b.severity] || 0) - (priority[a.severity] || 0);
        } else if (sortBy === 'upvotes') {
          return (b.upvotes || 0) - (a.upvotes || 0);
        } else if (sortBy === 'status') {
          const statusOrder: Record<string, number> = {
            'Reported': 1,
            'In Progress': 2,
            'Resolved': 3,
            'Deprecated': 4
          };
          const orderA = statusOrder[a.status] || 99;
          const orderB = statusOrder[b.status] || 99;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

      setIssues(enriched);
      toast.success("Feed updated with the latest civic reports!");
    } catch (err) {
      console.error("Failed to force-fetch server data:", err);
      toast.error("Failed to fetch fresh data. Using offline cache.");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 800);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.uid;
    const isGuest = !!currentUser.isLocalGuest;

    if (isGuest) {
      setNotifications(getLocalNotifications());
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as AppNotification);
      });
      setNotifications(list);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.isLocalGuest]);

  // Create helper to trigger a notification
  const createNotification = async (
    issue: Issue,
    type: 'update' | 'comment' | 'resolution',
    message: string
  ) => {
    if (!issue.reporterId || (currentUser && issue.reporterId === currentUser.uid)) {
      return;
    }

    const notificationData = {
      userId: issue.reporterId,
      issueId: issue.id,
      issueTitle: issue.title,
      type,
      message,
      read: false,
      createdAt: new Date().toISOString()
    };

    if (issue.reporterId === 'local-guest' || !currentUser || currentUser.isLocalGuest) {
      const id = 'notif-' + Math.random().toString(36).substring(2, 11);
      saveLocalNotification({
        id,
        ...notificationData
      });
    }

    if (issue.reporterId && issue.reporterId !== 'local-guest' && issue.reporterId !== 'guest') {
      try {
        await addDoc(collection(db, 'notifications'), notificationData);
      } catch (err) {
        console.error("Failed to save notification to Firestore", err);
      }
    }
  };

  const handleMarkAsRead = async (notif: AppNotification) => {
    if (currentUser?.isLocalGuest) {
      markLocalNotificationRead(notif.id);
      setNotifications(getLocalNotifications());
    } else {
      try {
        const notifRef = doc(db, 'notifications', notif.id);
        await updateDoc(notifRef, { read: true });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (currentUser?.isLocalGuest) {
      markAllLocalNotificationsRead();
      setNotifications(getLocalNotifications());
    } else {
      const unread = notifications.filter(n => !n.read);
      for (const notif of unread) {
        try {
          const notifRef = doc(db, 'notifications', notif.id);
          await updateDoc(notifRef, { read: true });
        } catch (err) {
          console.error("Error marking notification as read:", err);
        }
      }
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    await handleMarkAsRead(notif);
    setShowNotifications(false);

    const issueToSelect = issues.find(i => i.id === notif.issueId);
    if (issueToSelect) {
      setSelectedIssue(issueToSelect);
    } else {
      if (currentUser?.isLocalGuest) {
        const localIssues = getLocalIssues();
        const found = localIssues.find(i => i.id === notif.issueId);
        if (found) setSelectedIssue(found);
      } else {
        try {
          const { getDoc } = await import('firebase/firestore');
          const issueRef = doc(db, 'issues', notif.issueId);
          const snap = await getDoc(issueRef);
          if (snap.exists()) {
            setSelectedIssue({ id: snap.id, ...snap.data() } as Issue);
          }
        } catch (err) {
          console.error("Failed to fetch clicked issue", err);
        }
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['All', 'Roads', 'Drainage', 'Streetlight', 'Sanitation', 'Water', 'Public Safety', 'Electrical', 'Other'];

  // Google Workspace integration states
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [chatSpaces, setChatSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [isChatSpacesLoading, setIsChatSpacesLoading] = useState(false);
  const [isWorkspaceActionLoading, setIsWorkspaceActionLoading] = useState(false);
  const [workspaceActionFeedback, setWorkspaceActionFeedback] = useState<string | null>(null);
  const [workspaceActionLink, setWorkspaceActionLink] = useState<string | null>(null);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to Google Workspace access token changes
    const unsubscribeToken = addTokenListener((token) => {
      setAccessToken(token);
    });
    return () => unsubscribeToken();
  }, []);

  // Auto-fetch spaces if logged in
  useEffect(() => {
    if (accessToken) {
      const fetchSpaces = async () => {
        try {
          setIsChatSpacesLoading(true);
          const spaces = await listChatSpaces(accessToken);
          setChatSpaces(spaces);
          if (spaces.length > 0) {
            setSelectedSpaceName(spaces[0].name);
          }
        } catch (err) {
          console.error("Failed to list Chat spaces:", err);
        } finally {
          setIsChatSpacesLoading(false);
        }
      };
      fetchSpaces();
    } else {
      setChatSpaces([]);
      setSelectedSpaceName('');
    }
  }, [accessToken]);


  // Subscribe to real-time issues
  useEffect(() => {
    let q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    
    if (activeCategory !== 'All') {
      q = query(collection(db, 'issues'), where('category', '==', activeCategory));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Issue[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Issue);
      });

      // Merge local guest issues if any
      const localIssues = getLocalIssues().filter(i => activeCategory === 'All' || i.category === activeCategory);
      const allMerged = [...localIssues, ...fetched];

      // Enrich with local upvotes and verifications
      const localUpvotes = getLocalUpvotes();
      const localVerifications = getLocalVerifications();

      const enriched = allMerged.map(issue => {
        let upvotes = issue.upvotes || 0;
        let verificationCount = issue.verification_count || 0;
        
        if (localUpvotes.includes(issue.id)) {
          if (currentUser?.isLocalGuest) {
            upvotes += 1;
          }
        }
        
        if (localVerifications.includes(issue.id)) {
          if (currentUser?.isLocalGuest) {
            verificationCount += 1;
          }
        }
        
        return {
          ...issue,
          upvotes,
          verification_count: verificationCount
        };
      });

      // Client-side sorting
      enriched.sort((a, b) => {
        const aEmergency = a.emergencyFlaggedBy?.length || 0;
        const bEmergency = b.emergencyFlaggedBy?.length || 0;
        
        if (aEmergency !== bEmergency) {
          return bEmergency - aEmergency; // More emergency flags first
        }
        
        if (sortBy === 'severity') {
          const priority: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
          return (priority[b.severity] || 0) - (priority[a.severity] || 0);
        } else if (sortBy === 'upvotes') {
          return (b.upvotes || 0) - (a.upvotes || 0);
        } else if (sortBy === 'status') {
          const statusOrder: Record<string, number> = {
            'Reported': 1,
            'In Progress': 2,
            'Resolved': 3,
            'Deprecated': 4
          };
          const orderA = statusOrder[a.status] || 99;
          const orderB = statusOrder[b.status] || 99;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

      setIssues(enriched);
      
      // Update selected issue details if open
      if (selectedIssue) {
        const updated = enriched.find(i => i.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    }, (error) => {
      console.error("Firestore onSnapshot error in FeedView:", error);
      // Fallback for offline or permission errors
      const localIssues = getLocalIssues().filter(i => activeCategory === 'All' || i.category === activeCategory);
      setIssues(localIssues);
    });

    return () => unsubscribe();
  }, [activeCategory, sortBy, selectedIssue?.id]);

  const filteredIssues = issues.filter(issue => {
    if (!searchQuery.trim()) return true;
    const queryLower = searchQuery.toLowerCase();
    return (
      (issue.title && issue.title.toLowerCase().includes(queryLower)) ||
      (issue.summary && issue.summary.toLowerCase().includes(queryLower)) ||
      (issue.address && issue.address.toLowerCase().includes(queryLower)) ||
      (issue.category && issue.category.toLowerCase().includes(queryLower))
    );
  });

  // Load comments
  useEffect(() => {
    if (!selectedIssue) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'comments'),
      where('issueId', '==', selectedIssue.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Comment[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Comment);
      });

      // Merge local comments for this issue
      const localComments = getLocalComments(selectedIssue.id);
      const merged = [...fetched, ...localComments];
      // Sort chronologically
      merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setComments(merged);
    }, (error) => {
      // Graceful fallback if onSnapshot fails (e.g. guest mode or permission rules)
      const localComments = getLocalComments(selectedIssue.id);
      setComments(localComments);
    });

    return () => unsubscribe();
  }, [selectedIssue]);

  // Handle upvoting
  const handleUpvote = async (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    
    // Tactile vibration click for upvoting/toggling
    triggerHaptic(45);
    
    const localUpvotes = getLocalUpvotes();
    const hasUpvoted = localUpvotes.includes(issue.id);
    
    if (currentUser.isLocalGuest) {
      if (hasUpvoted) {
        // Toggle off upvote
        const updated = localUpvotes.filter(id => id !== issue.id);
        localStorage.setItem('community_hero_local_upvotes', JSON.stringify(updated));
        setMyUpvotes(updated);
        updateLocalProfilePoints(-10);
        setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, upvotes: Math.max(0, (i.upvotes || 0) - 1) } : i));
        if (selectedIssue && selectedIssue.id === issue.id) {
          setSelectedIssue(prev => prev ? { ...prev, upvotes: Math.max(0, (prev.upvotes || 0) - 1) } : null);
        }
        toast.info("Upvote removed.");
      } else {
        // Upvote
        const added = saveLocalUpvote(issue.id);
        if (added) {
          setMyUpvotes(prev => [...prev, issue.id]);
          updateLocalProfilePoints(10);
          setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, upvotes: (i.upvotes || 0) + 1 } : i));
          if (selectedIssue && selectedIssue.id === issue.id) {
            setSelectedIssue(prev => prev ? { ...prev, upvotes: (prev.upvotes || 0) + 1 } : null);
          }
          createNotification(
            issue,
            'update',
            `Someone upvoted your reported issue "${issue.title}".`
          );
          toast.success("Issue upvoted! Thank you for supporting your community (+10 Points).");
        }
      }
      return;
    }
    
    // For registered users
    const issueRef = doc(db, 'issues', issue.id);
    if (hasUpvoted) {
      // Toggle off upvote
      const updated = localUpvotes.filter(id => id !== issue.id);
      localStorage.setItem('community_hero_local_upvotes', JSON.stringify(updated));
      setMyUpvotes(updated);
      
      await updateDoc(issueRef, {
        upvotes: increment(-1)
      });
      
      if (issue.reporterId) {
        const reporterRef = doc(db, 'users', issue.reporterId);
        await updateDoc(reporterRef, {
          points: increment(-10)
        }).catch(() => {});
      }
      toast.info("Upvote removed.");
    } else {
      // Upvote
      saveLocalUpvote(issue.id);
      setMyUpvotes(prev => [...prev, issue.id]);
      
      await updateDoc(issueRef, {
        upvotes: increment(1)
      });
      
      if (issue.reporterId) {
        const reporterRef = doc(db, 'users', issue.reporterId);
        await updateDoc(reporterRef, {
          points: increment(10)
        }).catch(() => {});
      }

      createNotification(
        issue,
        'update',
        `Someone upvoted your reported issue "${issue.title}".`
      );
      toast.success("Issue upvoted! Thank you for supporting your community (+10 Points).");
    }
  };

  // Handle +1 Verification
  const handleVerifyEyewitness = async (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    // Tactile vibration click for eyewitness verification
    triggerHaptic([30, 40, 30]);

    if (currentUser.isLocalGuest) {
      const added = saveLocalVerification(issue.id);
      if (added) {
        updateLocalProfilePoints(25, 'Verified Eyewitness');
        setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, verification_count: (i.verification_count || 0) + 1 } : i));
        if (selectedIssue && selectedIssue.id === issue.id) {
          setSelectedIssue(prev => prev ? { ...prev, verification_count: (prev.verification_count || 0) + 1 } : null);
        }
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 }
        });
        createNotification(
          issue,
          'update',
          `A citizen verified your reported issue "${issue.title}".`
        );
        toast.success("Eyewitness verification recorded! You earned +25 Civic points.");
      } else {
        toast.info("You have already verified this issue.");
      }
      return;
    }

    const issueRef = doc(db, 'issues', issue.id);
    await updateDoc(issueRef, {
      verification_count: increment(1),
      evidence_count: increment(1),
      trust_score: Math.min(100, (issue.trust_score || 50) + 10),
      contributors: arrayUnion(currentUser.uid)
    });

    // Add verification record
    await addDoc(collection(db, 'verifications'), {
      issueId: issue.id,
      userId: currentUser.uid,
      mediaUrl: issue.mediaUrls[0] || '',
      createdAt: new Date().toISOString()
    });

    // Award reputation points
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      points: increment(25),
      badges: arrayUnion('Verified Eyewitness')
    }).catch(() => {});

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.8 }
    });

    createNotification(
      issue,
      'update',
      `${currentUser.displayName || 'A citizen'} verified your reported issue "${issue.title}".`
    );
    toast.success("Eyewitness verification recorded! You earned +25 points & 'Verified Eyewitness' badge.");
  };

  // Handle Toggle Emergency Attention
  const handleToggleEmergencyAttention = async (issue: Issue) => {
    if (!currentUser) return;
    
    // Tactile vibration for emergency attention flags
    triggerHaptic([60, 45, 60]);
    
    const isFlagged = issue.emergencyFlaggedBy?.includes(currentUser.uid) || false;
    const tokensLeft = currentUserProfile?.emergencyAttentionsLeft ?? 3;
    
    let updatedFlags = [...(issue.emergencyFlaggedBy || [])];
    let tokenChange = 0;
    
    if (isFlagged) {
      // Unflag
      updatedFlags = updatedFlags.filter(uid => uid !== currentUser.uid);
      tokenChange = 1;
    } else {
      // Flag
      if (tokensLeft <= 0) {
        alert("🚨 You have used all 3 of your Emergency Attention tokens! Reclaim a token by resolving an issue, or unflag a different issue to free up a token.");
        return;
      }
      updatedFlags.push(currentUser.uid);
      tokenChange = -1;
    }
    
    // Update local / firebase issue
    if (currentUser.isLocalGuest) {
      updateLocalIssue(issue.id, { emergencyFlaggedBy: updatedFlags });
      // update issues state instantly
      setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, emergencyFlaggedBy: updatedFlags } : i));
      if (selectedIssue && selectedIssue.id === issue.id) {
        setSelectedIssue(prev => prev ? { ...prev, emergencyFlaggedBy: updatedFlags } : null);
      }
    } else {
      const issueRef = doc(db, 'issues', issue.id);
      await updateDoc(issueRef, { emergencyFlaggedBy: updatedFlags }).catch(() => {});
      
      // Update local feed state to render instantly
      setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, emergencyFlaggedBy: updatedFlags } : i));
      if (selectedIssue && selectedIssue.id === issue.id) {
        setSelectedIssue(prev => prev ? { ...prev, emergencyFlaggedBy: updatedFlags } : null);
      }
    }
    
    // Update user profile tokens
    if (onUpdateUserProfile) {
      onUpdateUserProfile({ emergencyAttentionsLeft: Math.max(0, Math.min(3, tokensLeft + tokenChange)) });
    }
    
    // Create notifications if flagging as emergency
    if (!isFlagged) {
      createNotification(
        issue,
        'update',
        `🚨 "${issue.title}" has been flagged as an EMERGENCY ATTENTION issue demanding immediate resolution.`
      );
    }
  };

  // Seed sample issues (1, 2, 3) into the database/state
  const handleSeedSampleIssues = async () => {
    if (!currentUser) return;
    
    const sampleIssuesToSeed: Issue[] = [
      {
        id: '', // Will be assigned or generated
        title: 'Hazardous Tarmac Pothole',
        category: 'Roads',
        severity: 'High' as const,
        severity_reason: 'Deep structural erosion causes severe safety danger to motorbike riders.',
        summary: 'A deep tarmac pothole near the central ward intersection. It poses a high accident risk for motorcyclists and bicycles, especially after dusk.',
        recommended_action: 'Avoid speeding through central zone; reported to road department for repair.',
        safety_warning: 'Caution: Deep hole can damage tires and cause sudden bike accidents!',
        address: 'Central Ward Intersection, Main St',
        lat: -1.2841,
        lng: 36.8220,
        reporterId: currentUser.uid,
        isAnonymous: false,
        status: 'Reported' as const,
        upvotes: 4,
        verification_count: 2,
        evidence_count: 2,
        amplify_count: 0,
        trust_score: 92,
        mediaUrls: ['https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop'],
        contributors: ['system-seed'],
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
        updatedAt: new Date().toISOString(),
        emergencyFlaggedBy: []
      },
      {
        id: '',
        title: 'Rapidly Flickering Streetlight',
        category: 'Streetlight',
        severity: 'Medium' as const,
        severity_reason: 'Blinking erratic light reduces pedestrian safety during night hours.',
        summary: 'The streetlight outside the primary gate has been blinking erratically or is completely dead. This compromises pedestrian security after twilight.',
        recommended_action: 'Walk in well-lit parallel lanes; utility crew notified.',
        safety_warning: null,
        address: 'Outside Primary Gate, Sector 3 Road',
        lat: -1.2855,
        lng: 36.8235,
        reporterId: currentUser.uid,
        isAnonymous: false,
        status: 'Reported' as const,
        upvotes: 2,
        verification_count: 1,
        evidence_count: 1,
        amplify_count: 0,
        trust_score: 85,
        mediaUrls: ['https://images.unsplash.com/photo-1509024644558-2f56ce76c490?q=80&w=600&auto=format&fit=crop'],
        contributors: ['system-seed'],
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
        updatedAt: new Date().toISOString(),
        emergencyFlaggedBy: []
      },
      {
        id: '',
        title: 'Sewage / Water Main Clog',
        category: 'Drainage',
        severity: 'Critical' as const,
        severity_reason: 'Clogged runoff creates unhygienic stagnant water accumulation.',
        summary: 'Debris and plastic rubbish have clogged the water runoff drain, causing slow drainage and stagnant pooling water near the walking sidewalk.',
        recommended_action: 'Avoid walking in contaminated pools; sanitation clearance ordered.',
        safety_warning: 'Warning: Standing wastewater poses biological hazard to children.',
        address: 'Runoff Drain, North Sidewalk Way',
        lat: -1.2830,
        lng: 36.8210,
        reporterId: currentUser.uid,
        isAnonymous: false,
        status: 'Reported' as const,
        upvotes: 8,
        verification_count: 4,
        evidence_count: 4,
        amplify_count: 0,
        trust_score: 96,
        mediaUrls: ['https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop'],
        contributors: ['system-seed'],
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
        updatedAt: new Date().toISOString(),
        emergencyFlaggedBy: []
      }
    ];
    
    if (currentUser.isLocalGuest) {
      sampleIssuesToSeed.forEach((issue) => {
        const id = 'seed-' + Math.random().toString(36).substring(2, 11);
        saveLocalIssue({ ...issue, id });
      });
      // trigger feed re-fetch
      const localIssues = getLocalIssues();
      setIssues(localIssues);
      confetti({ particleCount: 100, spread: 70 });
    } else {
      for (const issue of sampleIssuesToSeed) {
        await addDoc(collection(db, 'issues'), issue).catch((e) => console.error("Error seeding issue:", e));
      }
      confetti({ particleCount: 100, spread: 70 });
    }
  };

  // Submit standard comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedIssue || !currentUser) return;

    const commentText = newComment.trim();
    setNewComment('');

    const userComment = {
      id: 'local-' + Math.random().toString(36).substring(2, 11),
      issueId: selectedIssue.id,
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Anonymous Hero',
      userPhoto: currentUser.photoURL || '',
      text: commentText,
      isAI: false,
      createdAt: new Date().toISOString()
    };

    if (currentUser.isLocalGuest) {
      saveLocalComment(userComment);
      setComments(prev => [...prev, userComment]);

      // Trigger notification for local guest reporter
      createNotification(
        selectedIssue,
        'comment',
        `${currentUser.displayName || 'Anonymous Hero'} commented on your reported issue: "${selectedIssue.title}"`
      );

      // If matches @AI, call Nano
      const hasAiMention = commentText.toLowerCase().trim().startsWith('@ai') || 
                           commentText.toLowerCase().includes('@ai') ||
                           commentText.toLowerCase().trim().startsWith('nano');
      if (hasAiMention) {
        setIsAiLoading(true);
        try {
          const response = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              issueTitle: selectedIssue.title,
              issueSummary: selectedIssue.summary,
              commentText: commentText
            })
          });
          const data = await response.json();

          const aiComment = {
            id: 'local-ai-' + Math.random().toString(36).substring(2, 11),
            issueId: selectedIssue.id,
            userId: 'nano_ai_mascot',
            userName: 'Nano (AI Mascot)',
            userPhoto: NANO_MASCOT_URL,
            text: data.reply,
            isAI: true,
            createdAt: new Date().toISOString()
          };
          saveLocalComment(aiComment);
          setComments(prev => [...prev, aiComment]);

          // Trigger AI mascot notification
          createNotification(
            selectedIssue,
            'comment',
            `Nano (AI Mascot) commented on your reported issue: "${selectedIssue.title}"`
          );
        } catch (err) {
          console.error("AI reply failed", err);
          const aiCommentFallback = {
            id: 'local-ai-fallback-' + Math.random().toString(36).substring(2, 11),
            issueId: selectedIssue.id,
            userId: 'nano_ai_mascot',
            userName: 'Nano (AI Mascot)',
            userPhoto: NANO_MASCOT_URL,
            text: "Hi! Nano here. That sounds like an important concern. Let's make sure neighbors verify the photo so we can escalate this to the ward lead!",
            isAI: true,
            createdAt: new Date().toISOString()
          };
          saveLocalComment(aiCommentFallback);
          setComments(prev => [...prev, aiCommentFallback]);
        } finally {
          setIsAiLoading(false);
        }
      }
      return;
    }

    await addDoc(collection(db, 'comments'), {
      issueId: selectedIssue.id,
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Anonymous Hero',
      userPhoto: currentUser.photoURL || '',
      text: commentText,
      isAI: false,
      createdAt: new Date().toISOString()
    });

    // Trigger comment notification
    createNotification(
      selectedIssue,
      'comment',
      `${currentUser.displayName || 'Anonymous Hero'} commented on your reported issue: "${selectedIssue.title}"`
    );

    // If matches @AI, call Nano
    const hasRegisteredAiMention = commentText.toLowerCase().trim().startsWith('@ai') || 
                                   commentText.toLowerCase().includes('@ai') ||
                                   commentText.toLowerCase().trim().startsWith('nano');
    if (hasRegisteredAiMention) {
      setIsAiLoading(true);
      try {
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueTitle: selectedIssue.title,
            issueSummary: selectedIssue.summary,
            commentText: commentText
          })
        });
        const data = await response.json();

        await addDoc(collection(db, 'comments'), {
          issueId: selectedIssue.id,
          userId: 'nano_ai_mascot',
          userName: 'Nano (AI Mascot)',
          userPhoto: NANO_MASCOT_URL,
          text: data.reply,
          isAI: true,
          createdAt: new Date().toISOString()
        });

        // Trigger AI comment notification
        createNotification(
          selectedIssue,
          'comment',
          `Nano (AI Mascot) commented on your reported issue: "${selectedIssue.title}"`
        );
      } catch (err) {
        console.error("AI reply failed", err);
        const fallbackReply = "Hi! Nano here. That sounds like an important concern. Let's make sure neighbors verify the photo so we can escalate this to the ward lead!";
        
        try {
          await addDoc(collection(db, 'comments'), {
            issueId: selectedIssue.id,
            userId: 'nano_ai_mascot',
            userName: 'Nano (AI Mascot)',
            userPhoto: NANO_MASCOT_URL,
            text: fallbackReply,
            isAI: true,
            createdAt: new Date().toISOString()
          });
        } catch (dbErr) {
          const fallbackAiComment = {
            id: 'local-ai-fallback-' + Math.random().toString(36).substring(2, 11),
            issueId: selectedIssue.id,
            userId: 'nano_ai_mascot',
            userName: 'Nano (AI Mascot)',
            userPhoto: NANO_MASCOT_URL,
            text: fallbackReply,
            isAI: true,
            createdAt: new Date().toISOString()
          };
          setComments(prev => [...prev, fallbackAiComment]);
        }
      } finally {
        setIsAiLoading(false);
      }
    }
  };

  // Before/after fix validation
  const handleResolveProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setResolveMedia(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyResolution = async () => {
    if (!resolveMedia || !selectedIssue) return;
    setIsVerifyingFix(true);
    setFixVerdict(null);

    try {
      const response = await fetch('/api/verify-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalMedia: selectedIssue.mediaUrls[0] || '',
          newMedia: resolveMedia.split(',')[1],
          mimeType: 'image/jpeg'
        })
      });
      
      const verdict = await response.json();
      
      if (verdict.resolution === 'Verified Fixed') {
        if (currentUser.isLocalGuest) {
          updateLocalIssue(selectedIssue.id, {
            status: 'Resolved',
            resolvedAt: new Date().toISOString(),
            trust_score: 100,
            mediaUrls: [...(selectedIssue.mediaUrls || []), resolveMedia]
          });
          updateLocalProfilePoints(50, 'Fix Verifier');
        } else {
          // Update issue status to Resolved
          const issueRef = doc(db, 'issues', selectedIssue.id);
          await updateDoc(issueRef, {
            status: 'Resolved',
            resolvedAt: new Date().toISOString(),
            trust_score: 100,
            mediaUrls: arrayUnion(resolveMedia) // Add fix photo to media stack
          });

          // Award points
          if (currentUser) {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
              points: increment(50),
              badges: arrayUnion('Fix Verifier')
            }).catch(() => {});
          }
        }

        // Trigger resolution notification
        createNotification(
          selectedIssue,
          'resolution',
          `Your reported issue "${selectedIssue.title}" has been successfully verified and resolved!`
        );

        confetti({
          particleCount: 150,
          spread: 80,
          colors: ['#10B981', '#34D399', '#6EE7B7']
        });

        setFixVerdict("Success! Gemini verified the fix: " + verdict.explanation);
        setTimeout(() => {
          setIsResolving(false);
          setResolveMedia(null);
          setFixVerdict(null);
        }, 4000);
      } else {
        setFixVerdict("Failed Verification: " + verdict.explanation);
      }
    } catch (err) {
      setFixVerdict("Verification error occurred. Please try again.");
    } finally {
      setIsVerifyingFix(false);
    }
  };

  // Generate downloadable calendar recheck reminder event
  const generateICSFile = (issue: Issue) => {
    const startISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // tomorrow
    const endISO = new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CommunityHero//EN",
      "BEGIN:VEVENT",
      `DTSTART:${startISO.replace(/[-:]/g,"").split(".")[0]}Z`,
      `DTEND:${endISO.replace(/[-:]/g,"").split(".")[0]}Z`,
      `SUMMARY:Recheck: ${issue.title}`,
      `DESCRIPTION:Reminder to verify resolution status of reported civic issue. Category: ${issue.category}. Map link: https://maps.google.com/?q=${issue.lat},${issue.lng}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recheck-${issue.title.toLowerCase().replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Community Avalanche Message Pre-draft
  const handleAmplify = async (issue: Issue) => {
    // Tactile vibration for amplification action
    triggerHaptic(40);
    setIsAmplifying(true);
    try {
      const response = await fetch('/api/generate-amplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: issue.title,
          category: issue.category,
          address: issue.address,
          summary: issue.summary,
          link: window.location.href
        })
      });
      const data = await response.json();
      setAmplifiedMessage(data.message);
    } catch (err) {
      setAmplifiedMessage(`🚨 Help resolve: "${issue.title}" at ${issue.address}! Together we can push for a fix: ${window.location.href}`);
    } finally {
      setIsAmplifying(false);
    }
  };

  // Google Workspace Action Handlers
  const handleExportToDocs = async () => {
    if (!accessToken || !selectedIssue) return;
    try {
      setIsWorkspaceActionLoading(true);
      setWorkspaceActionError(null);
      setWorkspaceActionFeedback(null);
      setWorkspaceActionLink(null);
      const docUrl = await exportToDocs(accessToken, selectedIssue);
      setWorkspaceActionFeedback('Created Case File Document inside Google Drive folder: "Community Hero Cases"!');
      setWorkspaceActionLink(docUrl);
      toast.success("Successfully created Case File inside Google Drive!");
    } catch (err: any) {
      setWorkspaceActionError(err.message || 'Failed to export to Google Docs');
      toast.error(err.message || 'Failed to export to Google Docs');
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  const handleExportToSheets = async () => {
    if (!accessToken || !selectedIssue) return;
    try {
      setIsWorkspaceActionLoading(true);
      setWorkspaceActionError(null);
      setWorkspaceActionFeedback(null);
      setWorkspaceActionLink(null);
      const sheetUrl = await exportToSheets(accessToken, selectedIssue);
      setWorkspaceActionFeedback('Appended this case as a row to Community Hero - Ward Master Database!');
      setWorkspaceActionLink(sheetUrl);
      toast.success("Appended case file to Ward Master Database Sheet!");
    } catch (err: any) {
      setWorkspaceActionError(err.message || 'Failed to export to Google Sheets');
      toast.error(err.message || 'Failed to export to Google Sheets');
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  const handleScheduleCalendar = async () => {
    if (!accessToken || !selectedIssue) return;
    try {
      setIsWorkspaceActionLoading(true);
      setWorkspaceActionError(null);
      setWorkspaceActionFeedback(null);
      setWorkspaceActionLink(null);
      const calendarUrl = await scheduleOnCalendar(accessToken, selectedIssue);
      setWorkspaceActionFeedback('Scheduled Site Inspection meeting on your primary Calendar!');
      setWorkspaceActionLink(calendarUrl);
      toast.success("Site Inspection meeting scheduled in your Google Calendar!");
    } catch (err: any) {
      setWorkspaceActionError(err.message || 'Failed to schedule in Google Calendar');
      toast.error(err.message || 'Failed to schedule in Google Calendar');
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!accessToken || !selectedIssue) return;
    try {
      setIsWorkspaceActionLoading(true);
      setWorkspaceActionError(null);
      setWorkspaceActionFeedback(null);
      setWorkspaceActionLink(null);
      await createTaskItem(accessToken, selectedIssue);
      setWorkspaceActionFeedback('Successfully filed case as a task under Google Tasks list "@default"!');
      toast.success("Filed case as a task in Google Tasks!");
    } catch (err: any) {
      setWorkspaceActionError(err.message || 'Failed to file under Google Tasks');
      toast.error(err.message || 'Failed to file under Google Tasks');
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  const handleSendChatAlert = async () => {
    if (!accessToken || !selectedIssue || !selectedSpaceName) return;
    try {
      setIsWorkspaceActionLoading(true);
      setWorkspaceActionError(null);
      setWorkspaceActionFeedback(null);
      setWorkspaceActionLink(null);
      
      const alertMsg = `🚨 HAZARD DISPATCH WARNING 🚨\n` +
                       `==========================\n` +
                       `TITLE: ${selectedIssue.title}\n` +
                       `CATEGORY: ${selectedIssue.category} | SEVERITY: ${selectedIssue.severity}\n` +
                       `LOCATION: ${selectedIssue.address}\n` +
                       `RECOMMENDED ACTION: ${selectedIssue.recommended_action || 'Avoid the area and await municipal engineering resolution.'}\n` +
                       `DETAILS: ${selectedIssue.summary}`;
                       
                       await postChatMessage(accessToken, selectedSpaceName, alertMsg);
      setWorkspaceActionFeedback('Successfully posted safety hazard dispatch warning to selected Google Chat space!');
      toast.success("Successfully posted warning to Google Chat space!");
    } catch (err: any) {
      setWorkspaceActionError(err.message || 'Failed to broadcast dispatch warning');
      toast.error(err.message || 'Failed to broadcast dispatch warning');
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  const handleSaveKeepNote = async () => {
    if (!selectedIssue) return;
    try {
      setIsWorkspaceActionLoading(true);
      setWorkspaceActionError(null);
      setWorkspaceActionFeedback(null);
      setWorkspaceActionLink(null);
      
      if (accessToken) {
        try {
          await createKeepNote(accessToken, selectedIssue);
          setWorkspaceActionFeedback('Successfully dispatched note to your real Google Keep account!');
          toast.success("Dispatched note to your Google Keep account!");
        } catch (keepErr: any) {
          console.warn("Google Keep API failed (standard consumer account limitation), falling back to local simulation:", keepErr);
          
          // Save locally as fallback
          const notes = JSON.parse(localStorage.getItem('local_keep_notes') || '[]');
          const newNote = {
            id: selectedIssue.id,
            title: `Community Case Note: ${selectedIssue.title}`,
            category: selectedIssue.category,
            severity: selectedIssue.severity,
            body: `Address: ${selectedIssue.address}\nTrust rating: ${selectedIssue.trust_score || 50}%\nSummary: ${selectedIssue.summary}`,
            savedAt: new Date().toISOString()
          };
          notes.push(newNote);
          localStorage.setItem('local_keep_notes', JSON.stringify(notes));
          
          setWorkspaceActionFeedback(
            'Google Keep API is restricted to Google Workspace enterprise accounts and is not available for standard consumer Gmail (@gmail.com) accounts. We have safely compiled and archived this note inside your Passport Local Keep Note Index as an automated fallback!'
          );
          toast.success("Compiled and archived Keep Note locally!");
        }
      } else {
        // Fallback to local storage passport index
        const notes = JSON.parse(localStorage.getItem('local_keep_notes') || '[]');
        const newNote = {
          id: selectedIssue.id,
          title: `Community Case Note: ${selectedIssue.title}`,
          category: selectedIssue.category,
          severity: selectedIssue.severity,
          body: `Address: ${selectedIssue.address}\nTrust rating: ${selectedIssue.trust_score || 50}%\nSummary: ${selectedIssue.summary}`,
          savedAt: new Date().toISOString()
        };
        notes.push(newNote);
        localStorage.setItem('local_keep_notes', JSON.stringify(notes));
        setWorkspaceActionFeedback('Notes compiled and archived inside your Passport Local Keep Note index (Offline fallback)!');
        toast.success("Compiled and archived Keep Note locally!");
      }
    } catch (err: any) {
      setWorkspaceActionError(err.message || 'Failed to archive note');
      toast.error(err.message || 'Failed to archive note');
    } finally {
      setIsWorkspaceActionLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {

    switch (severity) {
      case 'Low': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'Medium': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'High': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'Critical': return 'bg-rose-500/10 text-rose-700 border-rose-500/20 animate-pulse';
      default: return 'bg-slate-500/10 text-slate-600';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const matchingCategories = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const queryLower = searchQuery.toLowerCase().trim();
    return categories.filter(cat => 
      cat !== 'All' && cat.toLowerCase().includes(queryLower)
    );
  }, [searchQuery, categories]);

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className="w-full h-full max-w-md mx-auto px-4 pt-4 pb-24 overflow-y-auto overscroll-y-contain relative"
    >
      {/* Pull To Refresh Indicator */}
      <div 
        className="overflow-hidden transition-all duration-200 flex flex-col items-center justify-center text-slate-500 text-xs shrink-0"
        style={{ 
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? Math.min(1, pullDistance / 60) : 0,
          marginBottom: pullDistance > 0 ? '12px' : '0px'
        }}
      >
        <div className="flex flex-col items-center gap-1 py-1.5">
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-beach-coral font-bold animate-pulse">
              <Loader className="w-4 h-4 animate-spin text-beach-coral" />
              <span>Fetching latest reports...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <RefreshCw 
                className="w-4 h-4 transition-transform duration-100 text-slate-400" 
                style={{ transform: `rotate(${pullDistance * 4}deg)` }}
              />
              <span>{pullDistance >= 60 ? "Release to update" : "Pull down to refresh"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Title, Slogan & Notifications Bell */}
      <div className="flex justify-between items-start mb-4 relative">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-beach-driftwood flex items-center gap-2">
            <Sparkles className="text-beach-coral w-6 h-6 animate-pulse" /> Community Hero
          </h1>
          <p className="text-xs text-slate-500 mt-1">A real-time, AI-validated community civic safety dashboard</p>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-full border border-beach-cream shadow-sm relative transition-all duration-200 cursor-pointer flex items-center justify-center"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-beach-coral text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-beach-cream rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-beach-cream/20 border-b border-beach-cream/50 flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-800">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] text-beach-coral font-bold hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-beach-cream/30">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                    <BellOff className="w-8 h-8 text-slate-300" />
                    <span>No notifications yet</span>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    let IconComponent = MessageSquare;
                    let iconBg = 'bg-blue-100 text-blue-600';
                    if (notif.type === 'resolution') {
                      IconComponent = CheckCircle;
                      iconBg = 'bg-emerald-100 text-emerald-600';
                    } else if (notif.type === 'update') {
                      IconComponent = RefreshCw;
                      iconBg = 'bg-amber-100 text-amber-600';
                    }

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 text-left transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-3 ${
                          !notif.read ? 'bg-beach-cream/10 font-medium' : ''
                        }`}
                      >
                        <div className={`p-1.5 rounded-xl ${iconBg} shrink-0`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-700 leading-normal break-words">
                            {notif.message}
                          </p>
                          <span className="text-[9px] text-slate-400 mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-beach-coral shrink-0 mt-2" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Attention Token Tracker Bar */}
      {currentUserProfile && (
        <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-3 mb-4 flex justify-between items-center text-left shadow-[0_2px_8px_rgba(239,68,68,0.03)]">
          <div className="flex items-center gap-2">
            <span className="text-sm">🚨</span>
            <div>
              <p className="text-[11px] font-bold text-rose-800">My Emergency Attention Tokens</p>
              <p className="text-[9px] text-slate-500 leading-normal">Use on urgent issues to pin them at the top of the community feed.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((val) => {
              const tokensLeft = currentUserProfile.emergencyAttentionsLeft ?? 3;
              const isActive = val <= tokensLeft;
              return (
                <span 
                  key={val} 
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[7px] font-bold shadow-sm transition-all duration-300 ${
                    isActive 
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  title={isActive ? "Available token" : "Used token"}
                >
                  {val}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-3">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          placeholder="Search by keyword, category, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white text-slate-700 placeholder-slate-400 border border-beach-cream rounded-2xl pl-10 pr-10 py-2.5 text-xs outline-none focus:border-beach-coral focus:ring-1 focus:ring-beach-coral transition-all duration-200 shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggested Matching Categories */}
      {matchingCategories.length > 0 && (
        <div className="mb-4 p-2.5 bg-beach-cream/20 border border-beach-cream/40 rounded-2xl text-left">
          <p className="text-[10px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
            <span className="text-xs">💡</span> Suggested Categories:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchingCategories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 bg-white hover:bg-beach-coral/10 hover:text-beach-coral hover:border-beach-coral/30 text-slate-600 text-[10px] font-semibold rounded-full border border-slate-200 transition-all cursor-pointer shadow-sm flex items-center gap-1"
              >
                <span>📂</span> {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories Horizontal Carousel */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
              activeCategory === cat
                ? 'bg-beach-coral text-white border-beach-coral font-bold shadow-sm'
                : 'bg-white text-slate-600 border-beach-cream hover:bg-beach-cream/40'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sorting Control */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs text-slate-500 font-medium">{filteredIssues.length} active issues found</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-white text-slate-600 border border-beach-cream rounded-lg px-2.5 py-1 text-xs outline-none focus:border-beach-coral cursor-pointer"
        >
          <option value="recent">Sort: Most Recent</option>
          <option value="upvotes">Sort: Highest Support</option>
          <option value="status">Sort: Status</option>
          <option value="severity">Sort: Severity</option>
        </select>
      </div>

      {/* Empty State with Mascot Nano */}
      {filteredIssues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/70 border border-beach-cream/80 rounded-2xl text-center shadow-sm">
          <img 
            src={NANO_MASCOT_URL} 
            alt="Nano Mascot" 
            className="w-16 h-16 rounded-full border border-beach-coral/30 object-cover mb-4 animate-bounce"
            referrerPolicy="no-referrer"
          />
          <h3 className="text-beach-driftwood font-bold">
            {issues.length === 0 ? "No issues reported yet!" : "No matching issues found!"}
          </h3>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            {issues.length === 0 
              ? "Nano is currently monitoring the ward. Tap the plus button below to snap your first report!" 
              : "Try adjusting your search terms or selecting a different category to find matching community issues."}
          </p>
          {issues.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="mt-4 px-4 py-2 bg-beach-coral text-white text-xs font-bold rounded-xl shadow-sm hover:bg-beach-coral/90 transition-all duration-200"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Suggestions for empty state to fill negative space */}
      {issues.length === 0 && filteredIssues.length === 0 && (
        <div className="mt-6 space-y-4 animate-scale-up">
          <div className="flex items-center gap-1.5 text-left pl-1">
            <Lightbulb className="w-4 h-4 text-amber-500 animate-pulse" />
            <h4 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider">
              Suggested Ward Issues to Report
            </h4>
          </div>
          <p className="text-[10px] text-slate-500 text-left -mt-2 pl-1 mb-2">
            Don't start from scratch! Tap a template below to instantly draft a prefilled report.
          </p>

          <div className="grid grid-cols-1 gap-3 text-left">
            {[
              {
                title: 'Hazardous Tarmac Pothole',
                desc: 'A deep tarmac pothole near the central ward intersection. It poses a high accident risk for motorcyclists and bicycles, especially after dusk.',
                category: 'Roads',
                badgeBg: 'bg-orange-50 text-orange-700 border-orange-100',
                icon: <AlertTriangle className="w-4 h-4 text-orange-600" />
              },
              {
                title: 'Rapidly Flickering Streetlight',
                desc: 'The streetlight outside the primary gate has been blinking erratically or is completely dead. This compromises pedestrian security after twilight.',
                category: 'Streetlight',
                badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                icon: <Lightbulb className="w-4 h-4 text-indigo-600" />
              },
              {
                title: 'Sewage/Water Main Clog',
                desc: 'Debris and plastic rubbish have clogged the water runoff drain, causing slow drainage and stagnant pooling water near the walking sidewalk.',
                category: 'Drainage',
                badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-100',
                icon: <Droplets className="w-4 h-4 text-cyan-600" />
              }
            ].map((sug, idx) => (
              <div
                key={idx}
                onClick={() => {
                  localStorage.setItem(
                    'report_prefill',
                    JSON.stringify({
                      title: sug.title,
                      description: sug.desc,
                      category: sug.category
                    })
                  );
                  if (onNavigateToTab) {
                    onNavigateToTab('report');
                  }
                }}
                className="group p-4 bg-white hover:bg-beach-cream/20 border border-beach-cream/80 hover:border-beach-coral/30 rounded-2xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex items-start gap-3"
              >
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-white shrink-0 shadow-inner flex items-center justify-center">
                  {sug.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="text-xs font-bold text-beach-driftwood group-hover:text-beach-coral transition-colors line-clamp-1">
                      {sug.title}
                    </h5>
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${sug.badgeBg}`}>
                      {sug.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {sug.desc}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-beach-coral font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Draft report with this template</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List Feed of Issues */}
      <div className="space-y-4">
        {filteredIssues.map(issue => (
          <div
            key={issue.id}
            onClick={() => setSelectedIssue(issue)}
            className={`group relative overflow-hidden transition-all duration-300 rounded-2xl p-4 cursor-pointer shadow-sm hover:shadow-md ${
              issue.emergencyFlaggedBy && issue.emergencyFlaggedBy.length > 0
                ? 'bg-rose-50/10 hover:bg-rose-50/25 border border-rose-400/30 hover:border-rose-500/60 shadow-[0_0_8px_rgba(239,68,68,0.04)] hover:shadow-[0_0_12px_rgba(239,68,68,0.08)]'
                : 'bg-white hover:bg-white/95 border border-beach-cream/80 hover:border-beach-coral/30'
            }`}
          >
            {/* Severity and category row */}
            <div className="flex justify-between items-center mb-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getSeverityColor(issue.severity)}`}>
                  {issue.severity}
                </span>
                {issue.emergencyFlaggedBy && issue.emergencyFlaggedBy.length > 0 && (
                  <span className="text-[9px] font-extrabold px-2 py-0.5 bg-rose-600 text-white rounded-full flex items-center gap-1 border border-rose-600 animate-pulse tracking-wide shadow-sm">
                    <span>🚨 URGENT</span>
                    <span className="bg-black/20 px-1 rounded text-[8px]">
                      {issue.emergencyFlaggedBy.length}
                    </span>
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-beach-cream/85 px-2 py-0.5 rounded-md">
                {issue.category}
              </span>
            </div>

            {/* Title & Address */}
            <h3 className="text-sm font-bold text-beach-driftwood group-hover:text-beach-coral transition-colors duration-150">
              {issue.title}
            </h3>
            
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {issue.address}
            </p>

            {/* Short summary sentence */}
            <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
              {issue.summary}
            </p>

            {/* Danger Warning Banner */}
            {issue.safety_warning && (
              <div className="mt-2.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-start gap-2 animate-pulse">
                <AlertTriangle className="text-rose-600 w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-700 font-semibold leading-normal">
                  {issue.safety_warning}
                </p>
              </div>
            )}

            {/* Media preview (only show if present) */}
            {issue.mediaUrls && issue.mediaUrls.length > 0 && (
              <div className="mt-3.5 h-32 rounded-xl overflow-hidden relative border border-beach-cream/50">
                <img 
                  src={issue.mediaUrls[0]} 
                  alt={issue.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg border border-beach-cream flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-beach-coral" />
                  <span className="text-[9px] font-bold text-slate-700">Trust Score: {issue.trust_score}%</span>
                </div>
              </div>
            )}

            {/* Footer engagement metrics */}
            <div className="mt-3.5 pt-3 border-t border-beach-cream/60 flex justify-between items-center text-slate-500">
              <button
                onClick={(e) => handleUpvote(issue, e)}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors py-1 px-2 rounded-lg ${
                  myUpvotes.includes(issue.id) 
                    ? 'text-beach-coral bg-beach-coral/10' 
                    : 'text-slate-500 hover:text-beach-coral hover:bg-beach-cream/40'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${myUpvotes.includes(issue.id) ? 'fill-beach-coral text-beach-coral' : ''}`} /> 
                <span>{issue.upvotes || 0}</span>
              </button>

              <button
                onClick={(e) => handleVerifyEyewitness(issue, e)}
                className="flex items-center gap-1.5 text-xs font-semibold text-beach-ocean hover:text-sky-700 transition-colors py-1 px-2 rounded-lg bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10"
              >
                <CheckCircle className="w-4 h-4" /> Confirm +1 ({issue.verification_count || 0})
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DETAILED MODAL COMPONENT */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          recentIssues={issues}
          onUpdateIssue={(updates) => {
            setSelectedIssue(prev => prev ? { ...prev, ...updates } : null);
            if (currentUser?.isLocalGuest) {
              const updatedIssues = issues.map(i => i.id === selectedIssue.id ? { ...i, ...updates } : i);
              setIssues(updatedIssues);
            }
          }}
          onAddCommentLocal={(newComment) => {
            setComments(prev => [...prev, newComment]);
          }}
          currentUserProfile={currentUserProfile}
          handleToggleEmergencyAttention={handleToggleEmergencyAttention}
          onClose={() => {
            setSelectedIssue(null);
            setIsResolving(false);
            setResolveMedia(null);
            setFixVerdict(null);
            setAmplifiedMessage(null);
          }}
          currentUser={currentUser}
          accessToken={accessToken}
          onSelectMapLocation={onSelectMapLocation}
          comments={comments}
          newComment={newComment}
          setNewComment={setNewComment}
          handleSubmitComment={handleSubmitComment}
          isAiLoading={isAiLoading}
          hasUpvoted={myUpvotes.includes(selectedIssue.id)}
          handleUpvote={handleUpvote}
          handleVerifyEyewitness={handleVerifyEyewitness}
          handleAmplify={handleAmplify}
          isAmplifying={isAmplifying}
          amplifiedMessage={amplifiedMessage}
          isResolving={isResolving}
          setIsResolving={setIsResolving}
          handleResolveProofUpload={handleResolveProofUpload}
          resolveMedia={resolveMedia}
          handleVerifyResolution={handleVerifyResolution}
          isVerifyingFix={isVerifyingFix}
          fixVerdict={fixVerdict}
          generateICSFile={generateICSFile}
          isWorkspaceActionLoading={isWorkspaceActionLoading}
          workspaceActionFeedback={workspaceActionFeedback}
          workspaceActionLink={workspaceActionLink}
          workspaceActionError={workspaceActionError}
          chatSpaces={chatSpaces}
          isChatSpacesLoading={isChatSpacesLoading}
          selectedSpaceName={selectedSpaceName}
          setSelectedSpaceName={setSelectedSpaceName}
          handleSendChatAlert={handleSendChatAlert}
          handleSaveKeepNote={handleSaveKeepNote}
          handleExportToDocs={handleExportToDocs}
          handleExportToSheets={handleExportToSheets}
          handleScheduleCalendar={handleScheduleCalendar}
          handleCreateTask={handleCreateTask}
          fileInputRef={fileInputRef}
        />
      )}
    </div>
  );
}
