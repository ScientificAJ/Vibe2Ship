import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Comment } from '../types';
import { Bot, Sparkles, Calendar, CheckSquare, FileText, MessageSquare, Clock } from 'lucide-react';

export default function AgentActivityLog() {
  const [activities, setActivities] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to Firestore comments where isAI == true
    const q = query(
      collection(db, 'comments'),
      where('isAI', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbActivities: Comment[] = [];
      snapshot.forEach((doc) => {
        dbActivities.push({ id: doc.id, ...doc.data() } as Comment);
      });

      // 2. Load Local Comments from localStorage
      let localActivities: Comment[] = [];
      try {
        const raw = localStorage.getItem('community_hero_local_comments');
        const allLocal: Comment[] = raw ? JSON.parse(raw) : [];
        localActivities = allLocal.filter(c => c.isAI === true);
      } catch (e) {
        console.error('Failed to parse local comments for activity feed', e);
      }

      // 3. Merge and sort by date descending
      const combined = [...dbActivities, ...localActivities];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Limit to last 15 actions to keep it high density and clean
      setActivities(combined.slice(0, 15));
      setLoading(false);
    }, (error) => {
      console.warn("Firestore error reading activity log, fallback to local:", error);
      try {
        const raw = localStorage.getItem('community_hero_local_comments');
        const allLocal: Comment[] = raw ? JSON.parse(raw) : [];
        const localOnly = allLocal.filter(c => c.isAI === true);
        localOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActivities(localOnly.slice(0, 15));
      } catch (e) {
        // ignore
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getIcon = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('google docs') || lower.includes('export_docs')) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    if (lower.includes('calendar') || lower.includes('schedule_calendar')) {
      return <Calendar className="h-4 w-4 text-rose-500" />;
    }
    if (lower.includes('task') || lower.includes('create_task')) {
      return <CheckSquare className="h-4 w-4 text-emerald-500" />;
    }
    if (lower.includes('chat') || lower.includes('post_chat')) {
      return <MessageSquare className="h-4 w-4 text-violet-500" />;
    }
    return <Sparkles className="h-4 w-4 text-indigo-500" />;
  };

  const cleanText = (rawText: string) => {
    // Strip markdown bold markers, bullet points etc for a clean feed item
    let text = rawText
      .replace(/\*\*/g, '')
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .replace(/•/g, '')
      .replace(/-\s+/g, '')
      .trim();
    if (text.length > 180) {
      return text.slice(0, 180) + '...';
    }
    return text;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-beach-cream p-4 rounded-2xl animate-pulse space-y-3">
        <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-50 rounded w-full"></div>
          <div className="h-3 bg-slate-50 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div id="agent-activity-log" className="bg-white border border-beach-cream/80 rounded-2xl p-4 text-left space-y-4.5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Bot className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-beach-driftwood uppercase tracking-wider">
              Agent Activity Log
            </h3>
            <p className="text-[9px] text-slate-400 font-medium">Real-time trace of autonomous integrations</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 font-bold rounded-full">
          {activities.length} Actions
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-[10px] text-slate-400 font-medium">No autonomous actions recorded yet.</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Run the Resolution Agent from any issue page to begin.</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
          {activities.map((act) => (
            <div key={act.id} className="flex items-start space-x-3 text-xs">
              <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg shrink-0 mt-0.5">
                {getIcon(act.text)}
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 truncate">
                    {act.userName || 'Resolution Agent'}
                  </span>
                  <span className="text-[9px] text-slate-400 flex items-center gap-0.5 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(act.createdAt)}
                  </span>
                </div>
                <p className="text-slate-500 font-medium leading-relaxed break-words whitespace-pre-wrap">
                  {cleanText(act.text)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
