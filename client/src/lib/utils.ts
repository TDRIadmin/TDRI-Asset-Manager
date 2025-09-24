import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { LatLngBounds } from "leaflet"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Debounce function to limit the rate of function execution
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// Helper function to expand bounds by a percentage for padding
export function expandBounds(bounds: LatLngBounds, paddingPercent: number): LatLngBounds {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  const latDiff = ne.lat - sw.lat;
  const lngDiff = ne.lng - sw.lng;
  
  const latPadding = latDiff * paddingPercent;
  const lngPadding = lngDiff * paddingPercent;
  
  return new LatLngBounds(
    [sw.lat - latPadding, sw.lng - lngPadding],
    [ne.lat + latPadding, ne.lng + lngPadding]
  );
}

// Helper function to check if current bounds are within loaded area
export function isWithinLoadedArea(currentBounds: LatLngBounds, loadedBounds: LatLngBounds): boolean {
  return loadedBounds.contains(currentBounds);
}
