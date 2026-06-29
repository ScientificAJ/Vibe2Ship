import React from 'react';
import { Home, MapPin, Plus, BarChart2, Award } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onReportClick: () => void;
}

export default function BottomNav({ activeTab, setActiveTab, onReportClick }: BottomNavProps) {
  const tabs = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'report', label: 'Report', icon: Plus, isAction: true },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'profile', label: 'Passport', icon: Award },
  ];

  return (
    <div id="bottom-nav-container" className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-1 pointer-events-none">
      <div 
        id="bottom-nav-bar"
        className="max-w-md mx-auto h-16 pointer-events-auto bg-white/90 backdrop-blur-xl border border-beach-cream/80 rounded-full shadow-xl flex items-center justify-between px-3"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                id="btn-nav-action-report"
                onClick={onReportClick}
                className="relative -top-5 w-14 h-14 bg-beach-coral hover:bg-beach-coral/90 active:scale-95 text-white rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(249,115,22,0.45)] transition-all duration-200 border-4 border-white group"
                aria-label="Submit a civic report"
              >
                <Icon className="w-7 h-7 stroke-[3px] group-hover:rotate-90 transition-transform duration-300" />
                <span className="absolute -bottom-7 text-[10px] font-bold text-beach-coral tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Lens
                </span>
              </button>
            );
          }

          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`btn-nav-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-150 ${
                isActive 
                  ? 'text-beach-coral' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5.5 h-5.5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
              <span className="text-[10px] mt-1 font-semibold tracking-wide">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
