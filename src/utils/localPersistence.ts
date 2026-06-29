import { Issue, Comment, UserProfile, AppNotification } from '../types';

export function getLocalIssues(): Issue[] {
  try {
    const raw = localStorage.getItem('community_hero_local_issues');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading local issues', e);
    return [];
  }
}

export function saveLocalIssue(issue: Issue) {
  try {
    const issues = getLocalIssues();
    issues.unshift(issue);
    localStorage.setItem('community_hero_local_issues', JSON.stringify(issues));
  } catch (e) {
    console.error('Error saving local issue', e);
  }
}

export function updateLocalIssue(issueId: string, updates: Partial<Issue>) {
  try {
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = { ...issues[index], ...updates };
      localStorage.setItem('community_hero_local_issues', JSON.stringify(issues));
    }
  } catch (e) {
    console.error('Error updating local issue', e);
  }
}

export function getLocalComments(issueId: string): Comment[] {
  try {
    const raw = localStorage.getItem('community_hero_local_comments');
    const allComments: Comment[] = raw ? JSON.parse(raw) : [];
    return allComments.filter(c => c.issueId === issueId);
  } catch (e) {
    console.error('Error reading local comments', e);
    return [];
  }
}

export function saveLocalComment(comment: Comment) {
  try {
    const raw = localStorage.getItem('community_hero_local_comments');
    const allComments: Comment[] = raw ? JSON.parse(raw) : [];
    allComments.push(comment);
    localStorage.setItem('community_hero_local_comments', JSON.stringify(allComments));
  } catch (e) {
    console.error('Error saving local comment', e);
  }
}

export function getLocalUpvotes(): string[] {
  try {
    const raw = localStorage.getItem('community_hero_local_upvotes');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalUpvote(issueId: string): boolean {
  try {
    const upvotes = getLocalUpvotes();
    if (!upvotes.includes(issueId)) {
      upvotes.push(issueId);
      localStorage.setItem('community_hero_local_upvotes', JSON.stringify(upvotes));
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function getLocalVerifications(): string[] {
  try {
    const raw = localStorage.getItem('community_hero_local_verifications');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalVerification(issueId: string): boolean {
  try {
    const verifications = getLocalVerifications();
    if (!verifications.includes(issueId)) {
      verifications.push(issueId);
      localStorage.setItem('community_hero_local_verifications', JSON.stringify(verifications));
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function updateLocalProfilePoints(pointsToAdd: number, badgeToEarn?: string): UserProfile | null {
  try {
    const profileStr = localStorage.getItem('community_hero_guest_profile');
    if (!profileStr) return null;
    
    const profile: UserProfile = JSON.parse(profileStr);
    profile.points = (profile.points || 0) + pointsToAdd;
    
    if (badgeToEarn && (!profile.badges || !profile.badges.includes(badgeToEarn))) {
      profile.badges = [...(profile.badges || []), badgeToEarn];
    }
    
    // Add Community Hero badge if points are high
    if (profile.points >= 100 && (!profile.badges || !profile.badges.includes('Community Hero'))) {
      profile.badges = [...(profile.badges || []), 'Community Hero'];
    }
    
    localStorage.setItem('community_hero_guest_profile', JSON.stringify(profile));
    return profile;
  } catch (e) {
    console.error('Error updating local profile points', e);
    return null;
  }
}

export function getLocalNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem('community_hero_local_notifications');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading local notifications', e);
    return [];
  }
}

export function saveLocalNotification(notification: AppNotification) {
  try {
    const notifications = getLocalNotifications();
    notifications.unshift(notification);
    localStorage.setItem('community_hero_local_notifications', JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving local notification', e);
  }
}

export function markLocalNotificationRead(notificationId: string) {
  try {
    const notifications = getLocalNotifications();
    const index = notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      notifications[index].read = true;
      localStorage.setItem('community_hero_local_notifications', JSON.stringify(notifications));
    }
  } catch (e) {
    console.error('Error marking local notification read', e);
  }
}

export function markAllLocalNotificationsRead() {
  try {
    const notifications = getLocalNotifications();
    notifications.forEach(n => n.read = true);
    localStorage.setItem('community_hero_local_notifications', JSON.stringify(notifications));
  } catch (e) {
    console.error('Error marking all local notifications read', e);
  }
}

export function updateLocalProfileEmergencyAttentions(change: number): UserProfile | null {
  try {
    const profileStr = localStorage.getItem('community_hero_guest_profile');
    if (!profileStr) return null;
    
    const profile: UserProfile = JSON.parse(profileStr);
    const current = profile.emergencyAttentionsLeft !== undefined ? profile.emergencyAttentionsLeft : 3;
    profile.emergencyAttentionsLeft = Math.max(0, Math.min(3, current + change));
    
    localStorage.setItem('community_hero_guest_profile', JSON.stringify(profile));
    return profile;
  } catch (e) {
    console.error('Error updating local profile emergency attentions', e);
    return null;
  }
}

