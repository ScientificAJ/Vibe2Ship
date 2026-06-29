export interface Issue {
  id: string;
  title: string;
  category: 'Roads' | 'Drainage' | 'Streetlight' | 'Sanitation' | 'Water' | 'Public Safety' | 'Electrical' | 'Other';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  severity_reason: string;
  summary: string;
  recommended_action: string;
  safety_warning: string | null;
  status: 'Reported' | 'In Progress' | 'Resolved' | 'Deprecated';
  lat: number;
  lng: number;
  address: string;
  mediaUrls: string[];
  trust_score: number;
  verification_count: number;
  evidence_count: number;
  upvotes: number;
  amplify_count: number;
  reporterId: string;
  isAnonymous: boolean;
  contributors: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  emergencyFlaggedBy?: string[]; // list of user IDs who flagged this as emergency attention
  urgency?: 'Low' | 'Medium' | 'High' | 'Immediate';
  ai_confidence?: number;
}

export interface Verification {
  id: string;
  issueId: string;
  userId: string;
  mediaUrl: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  isAI: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  photoURL: string;
  points: number;
  badges: string[];
  isAnonymous: boolean;
  dailyReportCount: number;
  emergencyAttentionsLeft?: number;
}

export interface Ward {
  id: string;
  name: string;
  healthScore: number;
  categoryScores: {
    roadSafety: number;
    water: number;
    streetlights: number;
    cleanliness: number;
    responseSpeed: number;
  };
}

export interface AppNotification {
  id: string;
  userId: string; // The reporter who gets notified
  issueId: string;
  issueTitle: string;
  type: 'update' | 'comment' | 'resolution';
  message: string;
  read: boolean;
  createdAt: string;
}

