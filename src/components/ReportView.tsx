import React, { useState, useRef, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, increment, arrayUnion } from 'firebase/firestore';
import { saveLocalIssue, saveLocalVerification, updateLocalProfilePoints } from '../utils/localPersistence';
import { triggerHaptic } from '../utils/haptics';
import { useToast } from './Toast';
import { 
  Camera, 
  Mic, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Sparkles, 
  ArrowRight, 
  X,
  Upload,
  RefreshCw,
  Heart,
  Crop,
  Video,
  Scissors
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ImageStudio from './ImageStudio';

export const CIVIC_FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#FAF9F5" />
  <circle cx="200" cy="140" r="90" fill="none" stroke="#2DD4BF" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
  <circle cx="200" cy="140" r="80" fill="none" stroke="#2DD4BF" stroke-width="1" opacity="0.6" />
  <g transform="translate(160, 90)">
    <path d="M40 0 L75 15 L75 55 C75 80 40 100 40 100 C40 100 5 80 5 55 L5 15 Z" fill="#E6FDF9" stroke="#14B8A6" stroke-width="4" stroke-linejoin="round" />
    <path d="M23 48 L34 59 L57 32" fill="none" stroke="#0D9488" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
  </g>
  <path d="M185 200 L200 220 L215 200" fill="none" stroke="#14B8A6" stroke-width="2" />
  <text x="200" y="235" font-family="'Outfit', 'Inter', system-ui, sans-serif" font-size="12" font-weight="800" fill="#0F766E" letter-spacing="2" text-anchor="middle">
    EYEWITNESS VERIFIED
  </text>
  <text x="200" y="252" font-family="'Inter', system-ui, sans-serif" font-size="10" font-weight="500" fill="#64748B" text-anchor="middle">
    Community Hero Audited Case
  </text>
</svg>
`.trim())}`;

interface ReportViewProps {
  onReportSuccess: () => void;
  currentUser: any;
}

export default function ReportView({ onReportSuccess, currentUser }: ReportViewProps) {
  const toast = useToast();
  // Capture inputs
  const [media, setMedia] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [voiceText, setVoiceText] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  
  // Custom manual reporting states
  const [reportMode, setReportMode] = useState<'ai' | 'manual'>('ai');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  
  // Geolocation
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Detecting location...');

  // AI Response structure
  const [isLoading, setIsLoading] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-verification AI analysis state hooks
  const [preVerifyData, setPreVerifyData] = useState<any>(null);
  const [isPreVerifying, setIsPreVerifying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera & Image Studio states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  // Post-submit summary states
  const [submittedIssue, setSubmittedIssue] = useState<any | null>(null);
  const [submitSummary, setSubmitSummary] = useState<any | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const fetchAndGenerateSummary = async (newIssue: any) => {
    setIsSummaryLoading(true);
    setSubmitSummary(null);
    try {
      let allIssues: any[] = [];
      if (currentUser?.isLocalGuest) {
        const guestIssuesStr = localStorage.getItem('community_hero_local_issues');
        if (guestIssuesStr) {
          try {
            allIssues = JSON.parse(guestIssuesStr);
          } catch (e) {}
        }
      } else {
        const q = query(collection(db, 'issues'));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          allIssues.push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      const res = await fetch('/api/submit-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newIssue,
          allIssues
        })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch AI summary');
      }

      const summaryData = await res.json();
      setSubmitSummary(summaryData);
    } catch (err) {
      console.error("Failed to generate AI summary after submit:", err);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  // Stop camera stream cleanly on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Rear camera failed, fallback to default camera source:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (fallbackErr: any) {
        console.error("Camera access failed completely:", fallbackErr);
        setCameraError("Unable to access camera stream. Please grant permissions or upload a saved file instead.");
        setIsCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setMedia(dataUrl);
        setMimeType('image/jpeg');
        stopCamera();
        
        // Immediately trigger our highlight studio for the user to crop & annotate!
        setIsStudioOpen(true);
      }
    } catch (e) {
      console.error("Failed to capture frame:", e);
    }
  };

  const renderMediaPicker = (label: string = "Attach Proof (Required)") => {
    if (isCameraActive) {
      return (
        <div className="space-y-2 text-left">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{label}</label>
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-inner flex flex-col justify-end min-h-[220px]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Camera Overlay HUD */}
            <div className="absolute inset-0 border-2 border-beach-coral/30 pointer-events-none rounded-2xl flex items-center justify-center">
              <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center">
                <div className="w-12 h-12 border border-dashed border-white/50 rounded-full animate-spin" style={{ animationDuration: '8s' }} />
              </div>
            </div>
            
            {/* Shutter controls */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4 z-10 px-4">
              <button
                type="button"
                onClick={stopCamera}
                className="py-1.5 px-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-xs font-bold text-white border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="w-12 h-12 rounded-full bg-beach-coral hover:bg-beach-coral/90 border-4 border-white shadow-lg flex items-center justify-center transition-all transform active:scale-90 cursor-pointer animate-pulse"
                title="Take Photo"
              >
                <div className="w-4 h-4 bg-white rounded-full" />
              </button>
              <div className="w-[52px]" /> {/* Spacer for symmetry */}
            </div>
          </div>
          {cameraError && (
            <p className="text-[10px] text-rose-500 font-semibold mt-1">{cameraError}</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1.5 text-left animate-scale-up">
        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{label}</label>
        <div className="grid grid-cols-2 gap-3">
          {/* File input trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-28 bg-white border-2 border-dashed border-beach-cream hover:border-beach-coral/30 hover:bg-beach-cream/10 rounded-2xl flex flex-col items-center justify-center p-4 transition-all cursor-pointer group shadow-sm"
          >
            <Upload className="w-5 h-5 text-slate-400 group-hover:text-beach-coral transition-all" />
            <span className="text-[10px] font-bold text-slate-500 mt-2">Upload File</span>
            <span className="text-[8px] text-slate-400 mt-0.5">JPEG, PNG, Video</span>
          </button>

          {/* Camera stream trigger */}
          <button
            type="button"
            onClick={startCamera}
            className="h-28 bg-white border-2 border-dashed border-beach-cream hover:border-beach-coral/30 hover:bg-beach-cream/10 rounded-2xl flex flex-col items-center justify-center p-4 transition-all cursor-pointer group shadow-sm"
          >
            <Camera className="w-5 h-5 text-slate-400 group-hover:text-beach-coral transition-all" />
            <span className="text-[10px] font-bold text-slate-500 mt-2">Live Camera</span>
            <span className="text-[8px] text-slate-400 mt-0.5">Capture with phone</span>
          </button>
        </div>
        <input
          type="file"
          accept="image/*,video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  };

  // Auto-detect geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });

          // Try reverse geocoding with standard openstreetmap api
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            if (data && data.display_name) {
              setAddress(data.display_name.split(',').slice(0, 3).join(', '));
            } else {
              setAddress(`Ward Block (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            }
          } catch (err) {
            setAddress(`Ward Block (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          }
        },
        () => {
          setAddress('Standard Ward Center (GPS access denied)');
          setLocation({ lat: 12.9716, lng: 77.5946 }); // Default Bangalore coords
        },
        { enableHighAccuracy: true }
      );
    } else {
      setAddress('Standard Ward Center (GPS not supported)');
      setLocation({ lat: 12.9716, lng: 77.5946 });
    }
  }, []);

  // Check for prefilled data from suggestions
  useEffect(() => {
    const prefillStr = localStorage.getItem('report_prefill');
    if (prefillStr) {
      try {
        const prefill = JSON.parse(prefillStr);
        if (prefill && prefill.title) {
          setReportMode('manual');
          setManualTitle(prefill.title);
          setManualDescription(prefill.description);
          setEditedTitle(prefill.title);
          setEditedCategory(prefill.category || 'Other');
        }
      } catch (e) {
        console.error("Failed to load prefilled data", e);
      } finally {
        localStorage.removeItem('report_prefill');
      }
    }
  }, []);

  // Handle media file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type || 'image/jpeg';
    setMimeType(fileType);
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultData = reader.result as string;
      setMedia(resultData);
      
      if (reportMode === 'ai') {
        // Trigger AI analysis automatically on capture!
        triggerAiAnalysis(resultData, fileType);
      }
    };
    reader.readAsDataURL(file);
  };

  // Call the backend endpoint `/api/analyze-report`
  const triggerAiAnalysis = async (
    base64Media?: string,
    type?: string,
    mTitle?: string,
    mDesc?: string
  ) => {
    setIsLoading(true);
    setAiReport(null);

    const base64DataOnly = base64Media ? base64Media.split(',')[1] : undefined;

    try {
      const response = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media: base64DataOnly,
          mimeType: type,
          manualTitle: mTitle,
          manualDescription: mDesc,
        })
      });

      const data = await response.json();
      setAiReport(data);
      setEditedTitle(data.title);
      setEditedCategory(data.category);
    } catch (error) {
      console.error("AI report analysis failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setVoiceText(currentTranscript);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not natively supported on this browser/environment. Please type your description directly in the input box!");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        setVoiceText('');
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Handle voice-based reporting (using a transcribed text helper or typing)
  const handleVoiceReport = async () => {
    if (!voiceText.trim()) return;
    setIsLoading(true);
    setAiReport(null);

    try {
      const response = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceText: voiceText,
          isVoiceOnly: true
        })
      });

      const data = await response.json();
      setAiReport(data);
      setEditedTitle(data.title);
      setEditedCategory(data.category);
    } catch (error) {
      console.error("Voice interpretation failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPreVerification = async () => {
    setIsPreVerifying(true);
    setErrorMessage(null);
    triggerHaptic(45);
    try {
      const response = await fetch('/api/pre-verify-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle,
          category: editedCategory,
          severity: aiReport?.severity || 'Medium',
          summary: aiReport?.summary || ''
        })
      });
      const data = await response.json();
      setPreVerifyData(data);
    } catch (error) {
      console.error("Pre-verification analysis API call failed:", error);
      setErrorMessage("Could not complete AI pre-verification. Please try again.");
    } finally {
      setIsPreVerifying(false);
    }
  };

  // Submit and check for duplicates (Silent Merger)
  const handleSubmit = async (
    finalCategory?: string,
    finalSeverity?: string,
    finalUrgency?: string,
    finalConfidence?: number
  ) => {
    if (!aiReport || !location || !currentUser) return;
    
    // Instant haptic feedback for pressing the submit button
    triggerHaptic(45);
    
    setSubmitStatus('submitting');
    setErrorMessage(null);

    const actualCategory = finalCategory || editedCategory || 'Other';
    const actualSeverity = finalSeverity || aiReport.severity || 'Medium';
    const actualUrgency = finalUrgency || 'Medium';
    const actualConfidence = finalConfidence !== undefined ? finalConfidence : 1.0;

    try {
      // 1. Silent Merger check
      // Fetch open issues in the last 2 hours near this radius (allowed for guests too)
      const issuesQuery = query(collection(db, 'issues'), where('status', '!=', 'Resolved'));
      const querySnapshot = await getDocs(issuesQuery).catch(() => null);
      
      let duplicateIssueId = null;
      let existingIssueData: any = null;

      // Haversine distance calculator
      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // in meters
      };

      if (querySnapshot) {
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const dist = getDistance(location.lat, location.lng, data.lat, data.lng);
          
          // If within 60 meters and categories match, we qualify as potential duplicate
          if (dist <= 60 && data.category === actualCategory) {
            duplicateIssueId = docSnap.id;
            existingIssueData = data;
          }
        });
      }

      if (duplicateIssueId) {
        if (currentUser.isLocalGuest) {
          saveLocalVerification(duplicateIssueId);
          updateLocalProfilePoints(25, 'Verified Eyewitness');
        } else {
          // MERGE: Attach as +1 verification instead of creating new issue!
          const docRef = doc(db, 'issues', duplicateIssueId);
          await updateDoc(docRef, {
            verification_count: increment(1),
            evidence_count: increment(1),
            mediaUrls: arrayUnion(media || CIVIC_FALLBACK_IMAGE),
            contributors: arrayUnion(currentUser.uid)
          });

          // Add verification doc
          await addDoc(collection(db, 'verifications'), {
            issueId: duplicateIssueId,
            userId: currentUser.uid,
            mediaUrl: media || '',
            createdAt: new Date().toISOString()
          });
        }

        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Double-vibration tactile response for successful duplication merge
        triggerHaptic([40, 45, 80]);

        toast.success("Similar issue detected nearby! Merged your eyewitness account into the existing report.");
        const mergedIssue = {
          ...existingIssueData,
          id: duplicateIssueId,
          title: existingIssueData.title || 'Untitled Civic Issue',
          category: actualCategory,
          severity: actualSeverity,
          summary: existingIssueData.summary || '',
          mediaUrls: existingIssueData.mediaUrls || []
        };
        setSubmittedIssue(mergedIssue);
        setSubmitStatus('success');
        fetchAndGenerateSummary(mergedIssue);
        return;
      }

      // 2. Trust Engine Scoring
      let mediaMatches = true;
      let spamRisk = 'low';
      if (media) {
        try {
          const trustRes = await fetch('/api/verify-trust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              media: media.split(',')[1],
              mimeType: mimeType,
              title: editedTitle,
              category: actualCategory
            })
          });
          const trustData = await trustRes.json();
          mediaMatches = trustData.media_matches_claim;
          spamRisk = trustData.spam_risk;
        } catch (err) {
          console.warn("Trust scoring skipped", err);
        }
      }

      let trustScore = Math.floor(
        35 * (mediaMatches ? 1 : 0) +
        25 * (1/5) +
        15 * 0.8 + // Standard local rep
        15 * 1.0 + // High accuracy location
        10 * 1.0
      );
      if (spamRisk === 'high') trustScore = Math.max(0, trustScore - 30);

      // Save new issue to Firestore or Local Storage
      const newIssueDoc: any = {
        title: editedTitle || 'Untitled Civic Issue',
        category: actualCategory,
        severity: actualSeverity,
        severity_reason: aiReport.severity_reason || '',
        summary: aiReport.summary || '',
        recommended_action: aiReport.recommended_action || '',
        safety_warning: aiReport.safety_warning || null,
        status: 'Reported',
        lat: location.lat,
        lng: location.lng,
        address: address || '',
        mediaUrls: media ? [media] : [],
        trust_score: trustScore,
        verification_count: 0,
        evidence_count: media ? 1 : 0,
        upvotes: 0,
        amplify_count: 0,
        reporterId: currentUser.uid || '',
        isAnonymous: currentUser.isAnonymous || false,
        contributors: [currentUser.uid || ''],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        urgency: actualUrgency,
        ai_confidence: actualConfidence
      };

      if (currentUser.isLocalGuest) {
        newIssueDoc.id = 'local-issue-' + Math.random().toString(36).substring(2, 11);
        saveLocalIssue(newIssueDoc);
        updateLocalProfilePoints(15);
      } else {
        await addDoc(collection(db, 'issues'), newIssueDoc);

        // Award Points
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          points: increment(15),
          dailyReportCount: increment(1)
        }).catch(() => {});
      }

      confetti({
        particleCount: 150,
        spread: 80,
        colors: ['#10B981', '#34D399']
      });

      // Double-vibration tactile response for successful new report creation
      triggerHaptic([40, 45, 80]);

      toast.success("Civic report submitted successfully! You earned +15 Civic points.");
      setSubmittedIssue(newIssueDoc);
      setSubmitStatus('success');
      fetchAndGenerateSummary(newIssueDoc);
    } catch (err) {
      console.error("Submission failed", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(errMsg);
      toast.error("Failed to submit civic report: " + errMsg);
      setSubmitStatus('idle');
    }
  };

  return (
    <div className="w-full h-full max-w-md mx-auto px-4 pt-4 pb-24 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-beach-driftwood flex items-center gap-1.5">
            <Camera className="text-beach-coral w-5 h-5" /> Civic Lens
          </h1>
          <p className="text-[10px] text-slate-500">Zero-form AI-assisted reporting scanner</p>
        </div>
        <button
          onClick={onReportSuccess}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-beach-cream rounded-full"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {submitStatus === 'success' && (
        <div className="space-y-5 animate-scale-up">
          {/* Top success badge */}
          <div className="text-center py-8 px-6 bg-white border border-beach-cream rounded-3xl space-y-3 shadow-md">
            <CheckCircle className="text-beach-coral w-14 h-14 mx-auto animate-bounce" />
            <h2 className="text-beach-driftwood font-bold text-lg">Civic Proof Loaded!</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Nano analyzed and cataloged your proof. Neighbors nearby can now upvote, verify, or amplify to solve this together.
            </p>
          </div>

          {/* Submitted Report Details Card */}
          {submittedIssue && (
            <div className="bg-white border border-beach-cream rounded-2xl p-4 shadow-md text-left space-y-3">
              <div className="flex items-center justify-between border-b border-beach-cream/50 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submitted Report</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  submittedIssue.severity === 'Critical' || submittedIssue.severity === 'High'
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  {submittedIssue.severity || 'Medium'} Severity
                </span>
              </div>
              
              <div>
                <h3 className="font-extrabold text-sm text-beach-driftwood leading-tight">{submittedIssue.title}</h3>
                <p className="text-[10px] text-beach-ocean font-bold mt-1 uppercase tracking-wide">{submittedIssue.category}</p>
              </div>

              {submittedIssue.mediaUrls && submittedIssue.mediaUrls.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-beach-cream max-h-36">
                  <img 
                    src={submittedIssue.mediaUrls[0]} 
                    alt="Submitted proof" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed bg-beach-cream/10 p-2.5 rounded-lg border border-beach-cream/40">
                {submittedIssue.summary || 'No description provided.'}
              </p>

              {submittedIssue.address && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{submittedIssue.address}</span>
                </div>
              )}
            </div>
          )}

          {/* AI generated summary just below the report */}
          <div className="bg-gradient-to-br from-beach-cream/30 to-white border border-beach-cream rounded-2xl p-4.5 shadow-md text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-beach-coral animate-pulse" />
                <h3 className="font-extrabold text-xs text-beach-driftwood uppercase tracking-wider">AI Neighborhood Ward Analysis</h3>
              </div>
              {submitSummary && (
                <span className="text-[9px] bg-beach-coral/10 text-beach-coral px-2 py-0.5 rounded-full font-bold">
                  {submitSummary.wardStatusHeadline || "Ward Analytics"}
                </span>
              )}
            </div>

            {isSummaryLoading ? (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 animate-pulse">
                  <RefreshCw className="text-beach-coral w-4 h-4 animate-spin" />
                  <span className="text-xs font-semibold text-slate-500">Synthesizing ward-wide trends...</span>
                </div>
                <div className="h-3 bg-beach-cream/35 rounded animate-pulse w-full" />
                <div className="h-3 bg-beach-cream/35 rounded animate-pulse w-5/6" />
                <div className="h-3 bg-beach-cream/35 rounded animate-pulse w-2/3" />
              </div>
            ) : submitSummary ? (
              <div className="space-y-3.5 animate-scale-up">
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {submitSummary.summaryText}
                </p>

                <div className="border-t border-beach-cream/60 pt-3 space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Key Takeaways & Impact</p>
                  <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                    {submitSummary.keyTakeaways?.map((takeaway: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-beach-coral font-bold mt-0.5 shrink-0">•</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No summary generated.</p>
            )}
          </div>

          <button
            onClick={onReportSuccess}
            className="w-full py-3 bg-beach-coral hover:bg-beach-coral/90 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Return to Feed
          </button>
        </div>
      )}

      {submitStatus !== 'success' && (
        <div className="space-y-5">
          {/* Geolocation badge */}
          <div className="bg-beach-cream/20 px-3.5 py-2.5 rounded-2xl border border-beach-cream/70 flex items-start gap-2.5">
            <MapPin className="text-beach-ocean w-4.5 h-4.5 mt-0.5 shrink-0" />
            <div className="text-left">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Device Location</p>
              <p className="text-xs text-slate-700 mt-0.5 font-bold">{address}</p>
            </div>
          </div>

          {/* Report Mode Tabs */}
          {!aiReport && (
            <div className="flex bg-beach-cream/35 p-1 rounded-xl border border-beach-cream/70 mb-1">
              <button
                type="button"
                onClick={() => setReportMode('ai')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  reportMode === 'ai'
                    ? 'bg-white text-beach-driftwood shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Instant AI Scan
              </button>
              <button
                type="button"
                onClick={() => setReportMode('manual')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  reportMode === 'manual'
                    ? 'bg-white text-beach-driftwood shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Manual Form
              </button>
            </div>
          )}

          {/* Capture Stage - AI Mode */}
          {!media && !aiReport && reportMode === 'ai' && (
            <div className="space-y-4">
              {renderMediaPicker("Point Camera at Hazard or Upload Proof")}

              {/* Or divider */}
              <div className="flex items-center text-slate-400 my-1 text-xs font-bold uppercase tracking-wider">
                <hr className="flex-1 border-beach-cream" />
                <span className="px-2 text-[9px] text-slate-400">Or voice report</span>
                <hr className="flex-1 border-beach-cream" />
              </div>

              {/* Voice Note Input */}
              <div className="bg-white p-4 border border-beach-cream rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-beach-coral" /> Real-time Speech-to-Text
                  </span>
                  {isRecording && (
                    <div className="flex items-center gap-1 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider">Listening</span>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    value={voiceText}
                    onChange={(e) => setVoiceText(e.target.value)}
                    placeholder="Tap the mic to start speaking, or type your complaint here..."
                    className="w-full bg-white text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-3 pr-12 py-3 border border-beach-cream outline-none focus:border-beach-coral min-h-[85px] resize-none"
                  />
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`absolute right-3 bottom-3 p-2.5 rounded-full transition-all duration-300 flex items-center justify-center shadow-md ${
                      isRecording 
                        ? 'bg-rose-500 text-white animate-bounce' 
                        : 'bg-beach-cream text-slate-500 hover:bg-beach-cream/80 border border-beach-cream/50'
                    }`}
                    title={isRecording ? "Stop recording" : "Start speaking"}
                  >
                    <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                  </button>
                </div>

                {isRecording && (
                  <div className="flex items-center justify-center gap-1.5 py-1">
                    <div className="w-1 bg-beach-coral h-3 rounded animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1 bg-beach-coral h-5 rounded animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1 bg-beach-coral h-4 rounded animate-bounce" style={{ animationDelay: '0.3s' }} />
                    <div className="w-1 bg-beach-coral h-6 rounded animate-bounce" style={{ animationDelay: '0.4s' }} />
                    <div className="w-1 bg-beach-coral h-3 rounded animate-bounce" style={{ animationDelay: '0.5s' }} />
                    <span className="text-[10px] text-slate-400 ml-1.5">Speak clearly into your microphone...</span>
                  </div>
                )}

                <button
                  onClick={handleVoiceReport}
                  disabled={!voiceText.trim() || isRecording}
                  className="w-full py-2.5 bg-beach-coral/10 border border-beach-coral/20 hover:bg-beach-coral text-beach-coral hover:text-white disabled:opacity-50 disabled:hover:bg-beach-coral/10 disabled:hover:text-beach-coral font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Process with Nano AI
                </button>
              </div>
            </div>
          )}

          {/* Capture Stage - Manual Form Mode */}
          {!aiReport && reportMode === 'manual' && (
            <div className="bg-white border border-beach-cream rounded-3xl p-5 space-y-4 shadow-sm text-left animate-scale-up">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-beach-coral animate-pulse" /> Custom Civic Report
              </span>

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Report Title</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g., Broken Water Pipe, Pothole, Exposed Wires"
                  className="w-full bg-white text-xs text-slate-800 rounded-xl p-3 border border-beach-cream outline-none focus:border-beach-coral font-semibold"
                />
              </div>

              {/* Description textarea */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Detailed Description</label>
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Provide precise details, landmark info, or any active risk involved..."
                  className="w-full bg-white text-xs text-slate-800 placeholder-slate-400 rounded-xl px-3 py-3 border border-beach-cream outline-none focus:border-beach-coral min-h-[95px] resize-none font-semibold"
                />
              </div>

              {/* Media input/attachment button */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Attach Proof (Required)</label>
                {media ? (
                  <div className="space-y-2">
                    <div className="relative rounded-2xl overflow-hidden border border-beach-cream group shadow-md bg-slate-50">
                      <img src={media} alt="Attached proof" className="w-full h-36 object-cover" />
                      
                      {/* Highlight Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/75 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[7px] font-extrabold uppercase text-white">Captured</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMedia(null)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-600 backdrop-blur-md rounded-full border border-white/10 text-white shadow-sm transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Tool Actions */}
                      <div className="absolute bottom-2 left-2 right-2">
                        <button
                          type="button"
                          onClick={() => setIsStudioOpen(true)}
                          className="w-full py-1.5 bg-white/95 hover:bg-white text-beach-driftwood font-bold text-[9px] rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer border border-slate-100"
                        >
                          <Crop className="w-3.5 h-3.5 text-beach-coral" />
                          Crop & Highlight Hazard
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  renderMediaPicker("Attach Proof (Required)")
                )}
              </div>

              <button
                type="button"
                onClick={() => triggerAiAnalysis(media || undefined, mimeType, manualTitle, manualDescription)}
                disabled={!manualTitle.trim() || !manualDescription.trim() || !media || isLoading}
                className="w-full py-3 bg-beach-coral hover:bg-beach-coral/90 text-white disabled:opacity-50 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" /> Analyze with Gemini AI
              </button>
            </div>
          )}

          {/* Uploaded media preview */}
          {media && !aiReport && reportMode === 'ai' && (
            <div className="space-y-3 animate-scale-up">
              <div className="rounded-3xl overflow-hidden relative border border-beach-cream/80 group shadow-md bg-slate-50">
                <img src={media} alt="Civic lens capture" className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
                
                {/* Highlight Label Tag */}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-black/75 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-1.5 shadow-md">
                  <span className="w-1.5 h-1.5 bg-beach-coral rounded-full animate-ping" />
                  <span className="text-[8px] font-extrabold tracking-wider uppercase text-white">Capture Armed</span>
                </div>

                <button
                  onClick={() => {
                    setMedia(null);
                    setAiReport(null);
                  }}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-rose-600 backdrop-blur-md rounded-full border border-white/10 text-white shadow-sm transition-all cursor-pointer"
                  title="Remove capture"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Bottom Overlay Actions */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => setIsStudioOpen(true)}
                    className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 text-beach-driftwood font-black text-[10px] rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer border border-beach-cream"
                  >
                    <Crop className="w-3.5 h-3.5 text-beach-coral" />
                    Crop & Highlight
                  </button>
                  
                  <button
                    onClick={() => triggerAiAnalysis(media, mimeType)}
                    className="flex-1 py-2 px-3 bg-beach-coral hover:bg-beach-coral/95 text-white font-black text-[10px] rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Scan Hazard
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-center text-slate-400 font-medium italic">
                Tap "Crop & Highlight" to circle/draw arrows directly on the pothole/leak!
              </p>
            </div>
          )}

          {/* AI Analyzing Shimmer Loading State */}
          {isLoading && (
            <div className="p-5 bg-white border border-beach-cream rounded-2xl space-y-4 animate-pulse shadow-sm">
              <div className="flex items-center gap-2">
                <RefreshCw className="text-beach-ocean w-5 h-5 animate-spin" />
                <p className="text-xs font-bold text-slate-700">Nano AI is analyzing evidence...</p>
              </div>
              <div className="h-4 bg-beach-cream/40 rounded-md w-3/4 animate-pulse"></div>
              <div className="h-3 bg-beach-cream/40 rounded-md w-5/6 animate-pulse"></div>
              <div className="h-3 bg-beach-cream/40 rounded-md w-1/2 animate-pulse"></div>
            </div>
          )}

          {/* Interactive AI Review Card */}
          {aiReport && !isPreVerifying && !preVerifyData && (
            <div className="bg-white border border-beach-cream rounded-2xl p-4.5 space-y-4 animate-scale-up shadow-md">
              {/* Validation Check */}
              {!aiReport.is_civic_issue ? (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2.5 text-left">
                  <AlertTriangle className="text-amber-700 w-5 h-5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-800">Nano Couldn't Spot A Civic Issue</h4>
                    <p className="text-[10px] text-amber-700/90 mt-0.5">Please try taking a clear photo pointing directly at the broken road, streetlight, or community hazard.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-beach-coral text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 animate-pulse" /> Gemini Drafted Report
                  </div>

                  {/* Safety Danger Warning Banner */}
                  {aiReport.safety_warning && (
                    <div className="bg-rose-500/10 border border-rose-500/15 p-3 rounded-xl flex items-start gap-2.5 animate-pulse text-left">
                      <AlertTriangle className="text-rose-600 w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-700">⚠️ Active Safety Warning</h4>
                        <p className="text-[10px] text-rose-800 mt-0.5 leading-relaxed">{aiReport.safety_warning}</p>
                      </div>
                    </div>
                  )}

                  {/* Editable Title */}
                  <div className="text-left space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Report Title</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full bg-white text-xs text-slate-800 rounded-lg p-2.5 border border-beach-cream font-bold outline-none focus:border-beach-coral"
                    />
                  </div>

                  {/* Editable Category & Severity row */}
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Category</label>
                      <select
                        value={editedCategory}
                        onChange={(e) => setEditedCategory(e.target.value)}
                        className="w-full bg-white text-xs text-slate-800 rounded-lg p-2.5 border border-beach-cream outline-none focus:border-beach-coral font-semibold"
                      >
                        <option value="Roads">Roads</option>
                        <option value="Drainage">Drainage</option>
                        <option value="Streetlight">Streetlight</option>
                        <option value="Sanitation">Sanitation</option>
                        <option value="Water">Water</option>
                        <option value="Public Safety">Public Safety</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Severity Verdict</label>
                      <div className="bg-beach-cream/35 text-xs text-slate-700 rounded-lg p-2.5 border border-beach-cream/80 font-bold">
                        {aiReport.severity}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="text-left">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Gemini Summary</label>
                    <p className="text-xs text-slate-600 mt-1 bg-beach-cream/20 p-2.5 rounded-lg border border-beach-cream">
                      {aiReport.summary}
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs text-left">
                      <strong>Submission Error:</strong> {errorMessage}
                    </div>
                  )}

                  {/* Pre-Verification Analysis submit trigger button */}
                  <button
                    onClick={handleStartPreVerification}
                    className="w-full py-3.5 bg-beach-coral hover:bg-beach-coral/90 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(249,115,22,0.25)] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse" /> 
                    Analyze & Pre-Verify Report
                  </button>
                </>
              )}
            </div>
          )}

          {/* Pre-Verification AI Loading State */}
          {isPreVerifying && (
            <div className="p-6 bg-white border border-beach-cream rounded-2xl space-y-6 text-center shadow-md animate-scale-up">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-beach-coral/10" />
                <div className="absolute inset-0 rounded-full border-4 border-beach-coral border-t-transparent animate-spin" />
                <div className="absolute inset-2 bg-beach-coral/10 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-beach-coral animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-sm text-beach-driftwood">AI Pre-Verification Audit</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Auditing category taxonomy alignment, calculating safety hazard levels, and determining official urgency indexes...
                </p>
              </div>
              
              <div className="flex flex-col gap-2.5 max-w-xs mx-auto text-left text-[10px] text-slate-400 font-semibold bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Checking category: <strong className="text-slate-600">{editedCategory}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Checking severity: <strong className="text-slate-600">{aiReport?.severity}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-beach-ocean animate-pulse" />
                  <span>Calculating AI confidence score...</span>
                </div>
              </div>
            </div>
          )}

          {/* Pre-Verification AI Analysis Results Card */}
          {preVerifyData && !isPreVerifying && (
            <div className="bg-white border border-beach-cream rounded-2xl p-5 space-y-5 animate-scale-up shadow-lg text-left">
              <div className="flex items-center justify-between border-b border-beach-cream/75 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-beach-coral/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-beach-coral" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-beach-driftwood">AI Pre-Verification Audit</h3>
                    <p className="text-[10px] text-slate-400">Verifying civic correctness & classification</p>
                  </div>
                </div>
                {/* Confidence Score Badge */}
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">AI Confidence</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-2 w-12 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                      <div 
                        className={`h-full rounded-full ${
                          preVerifyData.confidence_score >= 0.85 
                            ? 'bg-emerald-500' 
                            : preVerifyData.confidence_score >= 0.70 
                              ? 'bg-amber-500' 
                              : 'bg-rose-500'
                        }`} 
                        style={{ width: `${(preVerifyData.confidence_score * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black ${
                      preVerifyData.confidence_score >= 0.85 
                        ? 'text-emerald-600' 
                        : preVerifyData.confidence_score >= 0.70 
                          ? 'text-amber-600' 
                          : 'text-rose-600'
                    }`}>
                      {(preVerifyData.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Validation Check */}
              {!preVerifyData.is_valid_report && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2 text-left">
                  <AlertTriangle className="text-amber-700 w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-800">Low Civic Relevance Detected</h4>
                    <p className="text-[10px] text-amber-700/90 leading-relaxed">The AI believes this might not be an actionable community issue. Double check your descriptions before continuing.</p>
                  </div>
                </div>
              )}

              {/* Side-by-Side Comparison */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Verification Metrics</p>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Category */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Category</span>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-slate-500 line-through text-[11px]">Draft: {editedCategory}</span>
                      <span className="font-extrabold text-beach-ocean text-[11px]">AI Recommended: {preVerifyData.recommended_category}</span>
                    </div>
                  </div>

                  {/* Severity */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Severity</span>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-slate-500 line-through text-[11px]">Draft: {aiReport.severity}</span>
                      <span className="font-extrabold text-beach-coral text-[11px]">AI Recommended: {preVerifyData.recommended_severity}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Determined Urgency</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black mt-1 ${
                      preVerifyData.determined_urgency === 'Immediate' 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : preVerifyData.determined_urgency === 'High' 
                          ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                          : preVerifyData.determined_urgency === 'Medium' 
                            ? 'bg-sky-100 text-sky-700 border border-sky-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        preVerifyData.determined_urgency === 'Immediate' 
                          ? 'bg-rose-500' 
                          : preVerifyData.determined_urgency === 'High' 
                            ? 'bg-amber-500' 
                            : preVerifyData.determined_urgency === 'Medium' 
                              ? 'bg-sky-500' 
                              : 'bg-slate-400'
                      }`} />
                      {preVerifyData.determined_urgency}
                    </span>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">System Action</span>
                    <span className="text-[11px] font-bold text-slate-500 mt-1 block">Prioritized dispatch</span>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="bg-beach-cream/15 border border-beach-cream/40 p-3.5 rounded-xl text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">AI Audit Feedback</span>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium italic">
                  "{preVerifyData.feedback}"
                </p>
              </div>

              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => handleSubmit(
                    preVerifyData.recommended_category,
                    preVerifyData.recommended_severity,
                    preVerifyData.determined_urgency,
                    preVerifyData.confidence_score
                  )}
                  disabled={submitStatus === 'submitting'}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-55 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer animate-pulse"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept AI Optimization & Submit
                </button>

                <button
                  onClick={() => handleSubmit(
                    editedCategory,
                    aiReport.severity,
                    preVerifyData.determined_urgency,
                    preVerifyData.confidence_score
                  )}
                  disabled={submitStatus === 'submitting'}
                  className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Submit with Original Choices
                </button>

                <button
                  onClick={() => setPreVerifyData(null)}
                  disabled={submitStatus === 'submitting'}
                  className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  Go Back & Edit Draft
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isStudioOpen && media && (
        <ImageStudio
          imageSrc={media}
          onSave={(finalBase64) => {
            setMedia(finalBase64);
            setIsStudioOpen(false);
            
            // In AI mode, if we haven't drafted a report yet, auto-trigger the analysis on save!
            if (reportMode === 'ai' && !aiReport) {
              triggerAiAnalysis(finalBase64, mimeType);
            }
          }}
          onClose={() => setIsStudioOpen(false)}
        />
      )}
    </div>
  );
}
