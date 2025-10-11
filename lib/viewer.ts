// Client-side viewer data management
export interface ViewerData {
  id: string;
  email: string;
  displayName: string;
  registeredAt: number;
}

const VIEWER_STORAGE_KEY = 'after_party_viewer';

export function generateViewerId(): string {
  return `viewer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function saveViewerData(email: string, displayName: string): ViewerData {
  const viewerData: ViewerData = {
    id: generateViewerId(),
    email,
    displayName,
    registeredAt: Date.now(),
  };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify(viewerData));
  }
  
  return viewerData;
}

export function getViewerData(): ViewerData | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(VIEWER_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as ViewerData;
  } catch {
    return null;
  }
}

export function clearViewerData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(VIEWER_STORAGE_KEY);
  }
}

export function isViewerRegistered(): boolean {
  return getViewerData() !== null;
}

