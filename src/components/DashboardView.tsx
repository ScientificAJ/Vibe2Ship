import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue } from '../types';
import { 
  BarChart2, 
  Activity, 
  ThumbsUp, 
  CheckCircle, 
  Sparkles, 
  RefreshCw, 
  ShieldAlert,
  Download,
  Users,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info,
  Settings
} from 'lucide-react';
import { getLocalIssues } from '../utils/localPersistence';
import ImpactTrendsChart from './ImpactTrendsChart';
import IssuesLast30DaysChart from './IssuesLast30DaysChart';
import CoworkerChat from './CoworkerChat';
import ResolutionWatchdog from './ResolutionWatchdog';
import AgentActivityLog from './AgentActivityLog';
import { addTokenListener } from '../utils/googleAuth';

interface DashboardViewProps {
  currentUser?: any;
}

export default function DashboardView({ currentUser }: DashboardViewProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showFormulaConfig, setShowFormulaConfig] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    return addTokenListener((token) => {
      setAccessToken(token);
    });
  }, []);

  const [weights, setWeights] = useState(() => {
    const saved = localStorage.getItem('civic_pulse_weights');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore fallback
      }
    }
    return {
      critical: 250,
      high: 120,
      medium: 45,
      low: 15,
      upvote: 10,
      verification: 20,
      countResolvedOnly: false // Toggle between counting active issues or resolved issues
    };
  });

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    criticalCount: 0,
    impactedCount: 0,
    roadScore: 85,
    waterScore: 92,
    lightScore: 78,
    sanitationScore: 88,
    speedScore: 90
  });

  const [brief, setBrief] = useState<any>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  // Firestore sync for issues
  useEffect(() => {
    const q = query(collection(db, 'issues'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Issue[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Issue);
      });
      
      const localIssues = getLocalIssues();
      const allMerged = [...localIssues, ...fetched];
      setIssues(allMerged);
    }, (error) => {
      console.warn("Firestore access error, falling back to local issues:", error);
      const localIssues = getLocalIssues();
      setIssues(localIssues);
    });

    return () => unsubscribe();
  }, []);

  // Recalculate stats dynamically when issues or weights change
  useEffect(() => {
    const total = issues.length;
    const open = issues.filter(i => i.status !== 'Resolved').length;
    const resolved = issues.filter(i => i.status === 'Resolved').length;
    const criticalCount = issues.filter(i => i.severity === 'Critical' && i.status !== 'Resolved').length;

    // Calculate dynamic estimated neighbors helped/impacted
    let impactedCount = 0;
    issues.forEach(i => {
      // Determine if we are counting resolved or unresolved/active issues based on preference
      const isCountable = weights.countResolvedOnly ? (i.status === 'Resolved') : (i.status !== 'Resolved');
      
      if (isCountable) {
        let base = weights.low;
        if (i.severity === 'Critical') base = weights.critical;
        else if (i.severity === 'High') base = weights.high;
        else if (i.severity === 'Medium') base = weights.medium;

        const upvotes = i.upvotes || 0;
        const verifications = i.verification_count || 0;

        // Cumulative impact = Base severity impact + Upvotes weight + Verifications weight
        impactedCount += base + (upvotes * weights.upvote) + (verifications * weights.verification);
      }
    });

    // Simple Ward health calculations based on unresolved category counts
    const counts: Record<string, number> = { Roads: 0, Drainage: 0, Streetlight: 0, Sanitation: 0, Water: 0 };
    issues.forEach(i => {
      if (i.status !== 'Resolved') {
        counts[i.category] = (counts[i.category] || 0) + 1;
      }
    });

    setStats({
      total,
      open,
      resolved,
      criticalCount,
      impactedCount,
      roadScore: Math.max(40, 100 - (counts['Roads'] || 0) * 12),
      waterScore: Math.max(45, 100 - (counts['Water'] || 0) * 15),
      lightScore: Math.max(35, 100 - (counts['Streetlight'] || 0) * 18),
      sanitationScore: Math.max(50, 100 - (counts['Sanitation'] || 0) * 10),
      speedScore: total > 0 ? Math.min(100, Math.floor(55 + (resolved / total) * 45)) : 95
    });
  }, [issues, weights]);

  const handleWeightChange = (key: string, val: any) => {
    const updated = { ...weights, [key]: val };
    setWeights(updated);
    localStorage.setItem('civic_pulse_weights', JSON.stringify(updated));
  };

  // Request Ward Narrative Brief from backend Gemini
  const generateBrief = async () => {
    setIsGeneratingBrief(true);
    try {
      const response = await fetch('/api/ward-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats })
      });
      const data = await response.json();
      setBrief(data);
    } catch (err) {
      console.error("Brief generation failed", err);
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="w-full h-full max-w-md mx-auto px-4 pt-4 pb-24 overflow-y-auto space-y-4.5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-beach-driftwood flex items-center gap-1.5">
          <BarChart2 className="text-beach-coral w-5 h-5" /> Civic Pulse
        </h1>
        <p className="text-[10px] text-slate-500">Neighborhood improvement progress and summaries</p>
      </div>

      {/* AI Coworker Workspace Trigger Banner */}
      <div className="bg-gradient-to-r from-beach-coral to-amber-500 rounded-2xl p-4 text-left text-white shadow-md flex items-center justify-between relative overflow-hidden">
        <div className="absolute right-[-15px] bottom-[-15px] opacity-15 pointer-events-none">
          <Users className="w-24 h-24 stroke-[1.5]" />
        </div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded text-[8px] font-black uppercase tracking-wider">Colleague Workspace</span>
            <span className="text-[10px] font-bold text-amber-100 flex items-center gap-0.5"><Sparkles className="w-3.5 h-3.5 text-amber-200 fill-amber-200" /> AI Coworker</span>
          </div>
          <h3 className="text-sm font-bold">Consult AI Coworker Casey</h3>
          <p className="text-[10px] text-orange-50/90 leading-normal max-w-[85%]">
            Ask Casey to draft municipal emails, analyze reported posts, check ward performance, or prepare resident newsletters using real-time database context.
          </p>
        </div>
        <button
          onClick={() => setIsChatOpen(true)}
          className="bg-white hover:bg-orange-50 active:scale-95 text-beach-coral text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer relative z-20"
        >
          Open Chat
        </button>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-white border border-beach-cream p-3.5 rounded-2xl flex flex-col justify-between shadow-sm">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Active Issues</p>
          <div className="flex justify-between items-end mt-2">
            <h3 className="text-2xl font-bold text-slate-800">{stats.open}</h3>
            <span className="text-[9px] font-bold text-rose-700 px-2 py-0.5 bg-rose-500/10 rounded border border-rose-500/25 mb-1">
              {stats.criticalCount} Critical
            </span>
          </div>
        </div>

        <div className="bg-white border border-beach-cream p-3.5 rounded-2xl flex flex-col justify-between shadow-sm">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Issues Fixed</p>
          <div className="flex justify-between items-end mt-2">
            <h3 className="text-2xl font-bold text-emerald-600">{stats.resolved}</h3>
            <span className="text-[9px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/25 mb-1">
              {stats.total > 0 ? Math.floor((stats.resolved / stats.total) * 100) : 100}% Resolved
            </span>
          </div>
        </div>
      </div>

      {/* Impact Estimation Callout with Interactive Formula Configurator */}
      <div className="space-y-2">
        <div className="bg-sky-500/5 border border-sky-500/10 p-3.5 rounded-2xl flex items-center justify-between">
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-beach-ocean">Estimated Neighbors Helped</h4>
              <button 
                onClick={() => setShowFormulaConfig(!showFormulaConfig)}
                className="p-1 hover:bg-sky-500/10 active:scale-95 rounded transition-all text-beach-ocean cursor-pointer"
                title="Configure Calculation Formula"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {weights.countResolvedOnly 
                ? "Approximate number of local residents helped by resolved fixes" 
                : "Approximate number of local residents helped by active fixes"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black text-beach-ocean">{stats.impactedCount}</h3>
            <button 
              onClick={() => setShowFormulaConfig(!showFormulaConfig)}
              className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
            >
              {showFormulaConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showFormulaConfig && (
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5 text-left animate-slide-down">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-slate-500" /> Dynamic Formula Modeler
              </span>
              <button 
                onClick={() => {
                  const defaults = {
                    critical: 250,
                    high: 120,
                    medium: 45,
                    low: 15,
                    upvote: 10,
                    verification: 20,
                    countResolvedOnly: false
                  };
                  setWeights(defaults);
                  localStorage.setItem('civic_pulse_weights', JSON.stringify(defaults));
                }}
                className="text-[9px] font-bold text-beach-coral hover:underline cursor-pointer"
              >
                Reset Defaults
              </button>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Tweak the factors below to adjust how civic impact is projected. Instead of a hardcoded black box, this formula evaluates the severity of reported problems combined with citizen upvotes and verifications.
            </p>

            <div className="space-y-3">
              {/* Measure Basis Toggle */}
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                <span className="text-[10.5px] font-semibold text-slate-600">Measure impact of:</span>
                <button
                  type="button"
                  onClick={() => handleWeightChange('countResolvedOnly', !weights.countResolvedOnly)}
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                    weights.countResolvedOnly 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-sky-500 text-white'
                  }`}
                >
                  {weights.countResolvedOnly ? 'Resolved Fixes Only' : 'Active Issues Only'}
                </button>
              </div>

              {/* Base Severity sliders */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>🔴 Critical Base:</span>
                    <span>{weights.critical} pop</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="500" 
                    step="5"
                    value={weights.critical} 
                    onChange={(e) => handleWeightChange('critical', parseInt(e.target.value))}
                    className="w-full accent-rose-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>🟠 High Base:</span>
                    <span>{weights.high} pop</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="300" 
                    step="5"
                    value={weights.high} 
                    onChange={(e) => handleWeightChange('high', parseInt(e.target.value))}
                    className="w-full accent-orange-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>🟡 Medium Base:</span>
                    <span>{weights.medium} pop</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="150" 
                    step="1"
                    value={weights.medium} 
                    onChange={(e) => handleWeightChange('medium', parseInt(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>🟢 Low Base:</span>
                    <span>{weights.low} pop</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    step="1"
                    value={weights.low} 
                    onChange={(e) => handleWeightChange('low', parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Citizen Engagement Multipliers */}
              <div className="border-t border-slate-200/60 pt-3 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span className="flex items-center gap-1">👍 Neighbors per Upvote:</span>
                    <span className="text-beach-coral">+{weights.upvote}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="50" 
                    step="1"
                    value={weights.upvote} 
                    onChange={(e) => handleWeightChange('upvote', parseInt(e.target.value))}
                    className="w-full accent-beach-coral h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span className="flex items-center gap-1">✓ Neighbors per Verification:</span>
                    <span className="text-beach-ocean">+{weights.verification}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={weights.verification} 
                    onChange={(e) => handleWeightChange('verification', parseInt(e.target.value))}
                    className="w-full accent-beach-ocean h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-200/40 p-2 rounded-lg text-[9px] text-slate-500 italic flex items-start gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Calculation formula: <strong>Base Severity + (Upvotes × {weights.upvote}) + (Verifications × {weights.verification})</strong> per countable issue.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* D3-based Community Impact Trends Chart */}
      <ImpactTrendsChart issues={issues} weights={weights} />

      {/* D3-based 30-Day Frequency Chart */}
      <IssuesLast30DaysChart issues={issues} />

      {/* Autonomous Agent Proactive Operations */}
      <ResolutionWatchdog 
        issues={issues} 
        accessToken={accessToken} 
        currentUser={currentUser} 
      />

      {/* Live Agent activity trace */}
      <AgentActivityLog />

      {/* Ward Category Scores */}
      <div className="bg-white border border-beach-cream/80 p-4 rounded-2xl space-y-3.5 shadow-sm">
        <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-4.5 h-4.5 text-beach-coral" /> Neighborhood Status
        </h3>

        <div className="space-y-2.5">
          {/* Progress metric */}
          {[
            { label: 'Road Repair Progress', val: stats.roadScore },
            { label: 'Drainage & Water Clearance', val: stats.waterScore },
            { label: 'Working Streetlights', val: stats.lightScore },
            { label: 'Sanitation & Cleanup', val: stats.sanitationScore },
            { label: 'Overall Issue Fix Speed', val: stats.speedScore }
          ].map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-semibold">
                <span className="text-slate-600">{item.label}</span>
                <span className={`font-bold ${getHealthColor(item.val)}`}>{item.val}%</span>
              </div>
              <div className="h-1.5 bg-beach-cream/40 rounded-full overflow-hidden border border-beach-cream">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.val >= 80 ? 'bg-emerald-500' : item.val >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${item.val}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Ward Brief Generator */}
      <div className="bg-white border border-beach-cream/80 rounded-2xl p-4 text-left space-y-3.5 shadow-md relative overflow-hidden">
        <div className="absolute top-3 right-3 bg-beach-cream/70 px-2 py-0.5 rounded-lg border border-beach-cream flex items-center gap-1 shadow-sm">
          <Sparkles className="w-3 h-3 text-beach-coral" />
          <span className="text-[9px] font-bold text-beach-driftwood">AI Analyst</span>
        </div>

        <div>
          <h3 className="text-xs font-bold text-beach-driftwood">Local Neighborhood Summary</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">Let Nano summarize all reports into a simple list of priorities</p>
        </div>

        {!brief ? (
          <button
            onClick={generateBrief}
            disabled={isGeneratingBrief}
            className="w-full py-2.5 bg-beach-coral hover:bg-beach-coral/90 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isGeneratingBrief ? 'animate-spin' : ''}`} />
            {isGeneratingBrief ? 'Nano is summarizing reports...' : 'Generate AI Summary'}
          </button>
        ) : (
          <div className="space-y-3 animate-scale-up">
            <p className="text-xs text-slate-700 leading-relaxed italic bg-beach-cream/25 p-3 rounded-xl border border-beach-cream">
              "{brief.narrative}"
            </p>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-beach-coral">Top Action Priorities:</h4>
              <ul className="space-y-1.5">
                {brief.priorities.map((p: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5 leading-normal">
                    <span className="text-beach-coral font-bold shrink-0 mt-0.5">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setBrief(null)}
              className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear AI Summary
            </button>
          </div>
        )}
      </div>

      {/* Coworker Chat Modal */}
      <CoworkerChat 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        issues={issues}
        stats={{
          total: stats.total,
          open: stats.open,
          resolved: stats.resolved,
          categoryCounts: issues.reduce((acc, i) => {
            if (i.status !== 'Resolved') {
              acc[i.category] = (acc[i.category] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>),
          severityCounts: issues.reduce((acc, i) => {
            if (i.status !== 'Resolved') {
              acc[i.severity] = (acc[i.severity] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>),
        }}
      />
    </div>
  );
}
