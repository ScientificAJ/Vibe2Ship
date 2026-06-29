import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue } from '../types';
import { MapPin, AlertTriangle, Sparkles, X, Compass, Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLocalIssues } from '../utils/localPersistence';

interface MapViewProps {
  onSelectIssue?: (issue: Issue) => void;
}

export default function MapView({ onSelectIssue }: MapViewProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [nearYouOnly, setNearYouOnly] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [nearYouCount, setNearYouCount] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Calculate distance in meters between two points
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          
          if (mapRef.current) {
            mapRef.current.setView([lat, lng], 14);
            setHasCentered(true);
          }
        },
        () => {
          // Default Bangalore coordinate
          setUserLocation({ lat: 12.9716, lng: 77.5946 });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setUserLocation({ lat: 12.9716, lng: 77.5946 });
    }
  }, []);

  // Fetch issues
  useEffect(() => {
    const q = query(collection(db, 'issues'), where('status', '!=', 'Resolved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Issue[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Issue);
      });
      
      // Merge local guest reported issues
      const localIssues = getLocalIssues().filter(i => i.status !== 'Resolved');
      const allMerged = [...localIssues, ...fetched];
      setIssues(allMerged);
    }, (error) => {
      // Fallback for offline or permission errors
      const localIssues = getLocalIssues().filter(i => i.status !== 'Resolved');
      setIssues(localIssues);
    });

    return () => unsubscribe();
  }, []);

  // Calculate near you count
  useEffect(() => {
    if (userLocation && issues.length > 0) {
      const near = issues.filter(issue => {
        const dist = getDistance(userLocation.lat, userLocation.lng, issue.lat, issue.lng);
        return dist <= 500; // 500 meters
      });
      setNearYouCount(near.length);
    }
  }, [userLocation, issues]);

  // Initialize and update map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map instance if not exists
    if (!mapRef.current) {
      const startCenter: [number, number] = userLocation 
        ? [userLocation.lat, userLocation.lng] 
        : [12.9716, 77.5946];

      mapRef.current = L.map(mapContainerRef.current, {
        center: startCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // Add elegant warm Voyager beachy light theme tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(mapRef.current);

      // Instantly trigger invalidateSize on mount/load
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }

    // Handle user location centering if just loaded
    if (userLocation && !hasCentered && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 14);
      mapRef.current.invalidateSize();
      setHasCentered(true);
    }

    // Update user marker position
    if (userLocation && mapRef.current) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const userIcon = L.divIcon({
          className: 'user-location-marker-container',
          html: `
            <div style="
              position: relative;
              width: 18px;
              height: 18px;
              background: #3B82F6;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
            ">
              <div style="
                position: absolute;
                inset: -6px;
                border: 2.5px solid #3B82F6;
                border-radius: 50%;
                animation: pulse-ring 1.8s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
                opacity: 0.6;
                pointer-events: none;
              "></div>
            </div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { 
          icon: userIcon,
          zIndexOffset: 1000 
        }).addTo(mapRef.current);
      }
    }

    // Refresh markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const visibleIssues = nearYouOnly && userLocation
      ? issues.filter(issue => getDistance(userLocation.lat, userLocation.lng, issue.lat, issue.lng) <= 500)
      : issues;

    visibleIssues.forEach(issue => {
      let color = '#3B82F6'; // Blue for info
      if (issue.severity === 'Critical') color = '#EF4444';
      else if (issue.severity === 'High') color = '#F97316';
      else if (issue.severity === 'Medium') color = '#F59E0B';
      else if (issue.severity === 'Low') color = '#22C55E';

      // Create beautiful custom canvas glass pins
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            background: rgba(255, 255, 255, 0.95);
            border: 2px solid ${color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(8px);
          ">
            <span style="
              width: 10px;
              height: 10px;
              background-color: ${color};
              border-radius: 50%;
              box-shadow: 0 0 10px ${color};
            "></span>
            <div style="
              position: absolute;
              bottom: -6px;
              left: 12px;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${color};
            "></div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      });

      const marker = L.marker([issue.lat, issue.lng], { icon: customIcon })
        .addTo(mapRef.current!)
        .on('click', () => {
          setSelectedIssue(issue);
          mapRef.current?.setView([issue.lat, issue.lng], 15);
        });

      markersRef.current.push(marker);
    });

  }, [userLocation, issues, nearYouOnly, hasCentered]);

  const handleCenterUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          
          if (mapRef.current) {
            mapRef.current.setView([lat, lng], 15);
            mapRef.current.invalidateSize();
          }
        },
        (error) => {
          console.error("Error retrieving position:", error);
          if (userLocation && mapRef.current) {
            mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
            mapRef.current.invalidateSize();
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
      mapRef.current.invalidateSize();
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Critical': return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          80%, 100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
      {/* Leaflet DOM container */}
      <div 
        ref={mapContainerRef} 
        id="leaflet-map-element"
        className="w-full h-full absolute inset-0 z-0" 
      />

      {/* Floating Header Search Panel */}
      <div className="absolute top-4 left-4 right-4 z-10 max-w-md mx-auto space-y-2">
        <div className="bg-white border border-beach-cream rounded-2xl p-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Compass className="text-beach-coral w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            <div className="text-left">
              <h2 className="text-xs font-bold text-beach-driftwood">Active Civic Radar</h2>
              <p className="text-[9px] text-slate-500">Monitoring reported hazards in your neighborhood</p>
            </div>
          </div>
          
          {/* Centering crosshair button */}
          <button
            onClick={handleCenterUser}
            className="p-1.5 bg-beach-cream hover:bg-beach-cream/80 rounded-xl text-slate-700 transition-colors border border-beach-cream"
            aria-label="Center map on current location"
          >
            <Crosshair className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Near You toggle button */}
        <div className="flex gap-2">
          <button
            onClick={() => setNearYouOnly(!nearYouOnly)}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 transition-all shadow-sm ${
              nearYouOnly
                ? 'bg-beach-coral text-white border-beach-coral font-bold'
                : 'bg-white/95 text-slate-600 border-beach-cream cursor-pointer'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            {nearYouOnly ? 'Showing Near You' : `Near You (${nearYouCount} items)`}
          </button>
        </div>
      </div>

      {/* Glass Bottom Sheet Issue Preview */}
      {selectedIssue && (
        <div className="absolute bottom-20 left-4 right-4 z-10 max-w-md mx-auto animate-slide-up">
          <div className="bg-white border border-beach-cream rounded-2xl p-4 shadow-lg relative overflow-hidden">
            <button
              onClick={() => setSelectedIssue(null)}
              className="absolute top-3 right-3 p-1 hover:bg-beach-cream rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3">
              {/* Image Preview */}
              {selectedIssue.mediaUrls && selectedIssue.mediaUrls.length > 0 && (
                <img
                  src={selectedIssue.mediaUrls[0]}
                  alt="Issue"
                  className="w-20 h-20 object-cover rounded-xl border border-beach-cream shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}

              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadgeColor(selectedIssue.severity)}`}>
                    {selectedIssue.severity}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                    {selectedIssue.category}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-beach-driftwood truncate mt-1">
                  {selectedIssue.title}
                </h3>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {selectedIssue.address}
                </p>
                <p className="text-[10px] text-slate-600 line-clamp-2 mt-1.5">
                  {selectedIssue.summary}
                </p>
              </div>
            </div>

            {/* Bottom Sheet CTA buttons */}
            <div className="flex gap-2 mt-3.5 pt-3 border-t border-beach-cream">
              <button
                onClick={() => {
                  if (onSelectIssue) onSelectIssue(selectedIssue);
                  setSelectedIssue(null);
                }}
                className="flex-1 py-1.5 bg-beach-coral hover:bg-beach-coral/95 text-white text-[10px] font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Open Proof File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
