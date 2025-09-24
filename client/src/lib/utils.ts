import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { LatLngBounds } from "leaflet"
import { MoistureReading } from "@shared/schema"

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

// Multi-region cache data structure
export interface CachedRegion {
  id: string; // Unique identifier for the cached region
  bounds: LatLngBounds;
  data: Record<string, MoistureReading>;
  timestamp: number; // For LRU eviction
  accessCount: number; // Track how often this region is accessed
}

// Maximum number of cached regions (150 as requested)
export const MAX_CACHED_REGIONS = 150;

// Helper function to generate a unique ID for cached regions
export function generateRegionId(bounds: LatLngBounds): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lat.toFixed(4)}_${sw.lng.toFixed(4)}_${ne.lat.toFixed(4)}_${ne.lng.toFixed(4)}`;
}

// Check if viewport is fully covered by cached regions (read-only - no state mutations)
export function getCachedDataForViewport(
  viewport: LatLngBounds, 
  cachedRegions: CachedRegion[]
): { data: Record<string, MoistureReading>; isFullyCovered: boolean; overlappingRegionIds: string[] } {
  const overlappingRegions = cachedRegions.filter(region => 
    region.bounds.intersects(viewport)
  );
  
  if (overlappingRegions.length === 0) {
    return { data: {}, isFullyCovered: false, overlappingRegionIds: [] };
  }

  // Check if viewport is fully covered by union of overlapping regions
  const isFullyCovered = isViewportCoveredByRegionUnion(viewport, overlappingRegions);

  // Merge data from all overlapping regions (read-only operation)
  const mergedData: Record<string, MoistureReading> = {};
  overlappingRegions.forEach(region => {
    Object.assign(mergedData, region.data);
  });

  return { 
    data: mergedData, 
    isFullyCovered, 
    overlappingRegionIds: overlappingRegions.map(r => r.id)
  };
}

// Separate function to update access statistics (immutable)
export function updateCacheAccess(
  cachedRegions: CachedRegion[],
  overlappingRegionIds: string[]
): CachedRegion[] {
  if (overlappingRegionIds.length === 0) {
    return cachedRegions;
  }

  const timestamp = Date.now();
  return cachedRegions.map(region => {
    if (overlappingRegionIds.includes(region.id)) {
      return {
        ...region,
        timestamp,
        accessCount: region.accessCount + 1
      };
    }
    return region;
  });
}

// Helper function to check if viewport is covered by union of multiple regions
function isViewportCoveredByRegionUnion(
  viewport: LatLngBounds,
  regions: CachedRegion[]
): boolean {
  // Quick check: if any single region fully contains viewport, we're covered
  const singleRegionCovers = regions.some(region => region.bounds.contains(viewport));
  if (singleRegionCovers) {
    return true;
  }

  // For multiple regions, use interval-based coverage check
  // This ensures the entire viewport area is actually covered, not just corners
  return isViewportFullyCoveredByIntervals(viewport, regions);
}

// Deterministic coverage check using interval merging - guarantees no gaps are missed
function isViewportFullyCoveredByIntervals(
  viewport: LatLngBounds,
  regions: CachedRegion[]
): boolean {
  const vSouth = viewport.getSouth();
  const vNorth = viewport.getNorth();  
  const vWest = viewport.getWest();
  const vEast = viewport.getEast();
  
  // Get all regions that intersect with the viewport
  const overlappingRectangles = regions
    .filter(region => region.bounds.intersects(viewport))
    .map(region => ({
      south: Math.max(vSouth, region.bounds.getSouth()),
      north: Math.min(vNorth, region.bounds.getNorth()),
      west: Math.max(vWest, region.bounds.getWest()),
      east: Math.min(vEast, region.bounds.getEast())
    }))
    .filter(rect => rect.south < rect.north && rect.west < rect.east);

  if (overlappingRectangles.length === 0) {
    return false;
  }

  // Check coverage using deterministic interval merging for both dimensions
  return areIntervalsCoveredByRectangles(vSouth, vNorth, vWest, vEast, overlappingRectangles);
}

// Deterministic algorithm: check if rectangles completely cover the target area
function areIntervalsCoveredByRectangles(
  targetSouth: number,
  targetNorth: number, 
  targetWest: number,
  targetEast: number,
  rectangles: Array<{south: number, north: number, west: number, east: number}>
): boolean {
  // For each horizontal strip, check if longitude is fully covered
  const latitudes = Array.from(new Set([
    targetSouth, targetNorth,
    ...rectangles.flatMap(r => [r.south, r.north])
  ])).sort((a, b) => a - b);

  // Check each horizontal strip between consecutive latitude lines
  for (let i = 0; i < latitudes.length - 1; i++) {
    const stripSouth = latitudes[i];
    const stripNorth = latitudes[i + 1];
    
    // Skip strips outside our target area
    if (stripNorth <= targetSouth || stripSouth >= targetNorth) {
      continue;
    }
    
    // Find rectangles that cover this horizontal strip
    const coveringRects = rectangles.filter(rect => 
      rect.south <= stripSouth && rect.north >= stripNorth
    );
    
    if (coveringRects.length === 0) {
      return false; // No coverage for this strip
    }
    
    // Check if longitude intervals from covering rectangles span the full width
    const longIntervals = coveringRects
      .map(rect => ({ start: rect.west, end: rect.east }))
      .sort((a, b) => a.start - b.start);
      
    if (!doIntervalsSpanRange(longIntervals, targetWest, targetEast)) {
      return false; // Gap in longitude coverage for this strip
    }
  }
  
  return true;
}

// Check if sorted intervals completely span a range without gaps
function doIntervalsSpanRange(
  intervals: Array<{start: number, end: number}>, 
  rangeStart: number, 
  rangeEnd: number
): boolean {
  if (intervals.length === 0) return false;
  
  let coverage = rangeStart;
  
  for (const interval of intervals) {
    if (interval.start > coverage) {
      return false; // Gap found
    }
    coverage = Math.max(coverage, interval.end);
    if (coverage >= rangeEnd) {
      return true; // Full range covered
    }
  }
  
  return coverage >= rangeEnd;
}

// Add or update a cached region
export function addCachedRegion(
  cachedRegions: CachedRegion[],
  bounds: LatLngBounds,
  data: Record<string, MoistureReading>
): CachedRegion[] {
  const regionId = generateRegionId(bounds);
  const timestamp = Date.now();

  // Check if this region already exists (same bounds)
  const existingIndex = cachedRegions.findIndex(region => region.id === regionId);
  
  if (existingIndex >= 0) {
    // Update existing region
    const updatedRegions = [...cachedRegions];
    updatedRegions[existingIndex] = {
      ...updatedRegions[existingIndex],
      data: { ...updatedRegions[existingIndex].data, ...data },
      timestamp,
      accessCount: updatedRegions[existingIndex].accessCount + 1
    };
    return updatedRegions;
  }

  // Add new region
  const newRegion: CachedRegion = {
    id: regionId,
    bounds,
    data,
    timestamp,
    accessCount: 1
  };

  let updatedRegions = [...cachedRegions, newRegion];

  // Apply LRU eviction if we exceed MAX_CACHED_REGIONS
  if (updatedRegions.length > MAX_CACHED_REGIONS) {
    // Sort by timestamp (oldest first) and remove the oldest
    updatedRegions.sort((a, b) => a.timestamp - b.timestamp);
    updatedRegions = updatedRegions.slice(-MAX_CACHED_REGIONS);
  }

  return updatedRegions;
}

// Get cache statistics for debugging/monitoring
export function getCacheStats(cachedRegions: CachedRegion[]): {
  totalRegions: number;
  totalDataPoints: number;
  oldestCacheTime: number;
  newestCacheTime: number;
  averageAccessCount: number;
} {
  if (cachedRegions.length === 0) {
    return {
      totalRegions: 0,
      totalDataPoints: 0,
      oldestCacheTime: 0,
      newestCacheTime: 0,
      averageAccessCount: 0
    };
  }

  const totalDataPoints = cachedRegions.reduce(
    (sum, region) => sum + Object.keys(region.data).length, 0
  );
  
  const timestamps = cachedRegions.map(region => region.timestamp);
  const accessCounts = cachedRegions.map(region => region.accessCount);
  
  return {
    totalRegions: cachedRegions.length,
    totalDataPoints,
    oldestCacheTime: Math.min(...timestamps),
    newestCacheTime: Math.max(...timestamps),
    averageAccessCount: accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length
  };
}
