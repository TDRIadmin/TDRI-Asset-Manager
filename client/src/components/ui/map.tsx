import { useEffect, useState, useMemo } from "react";
import { 
  MapContainer, 
  TileLayer, 
  Polyline, 
  Popup, 
  useMap, 
  LayersControl,
  CircleMarker
} from "react-leaflet";
import L from "leaflet";
import { RoadAsset, MoistureReading, getConditionState } from "@shared/schema";
import { getConditionColor, getMoistureColor, getRelativeMoistureColor } from "@/lib/utils/color-utils";
import MoistureRangeSlider from "@/components/MoistureRangeSlider";
import { motion, AnimatePresence } from "framer-motion";

// Define the GeoJSON structure for TypeScript
interface Coordinates {
  type: string;
  coordinates: [number, number][];
}

interface MapProps {
  roadAssets: RoadAsset[];
  height?: string;
  center?: [number, number];
  zoom?: number;
  onAssetClick?: (asset: RoadAsset) => void;
  initialLayer?: "pci" | "moisture";
  moistureReadings?: Record<string, MoistureReading>;
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
}

function MapController({ roadAssets, onBoundsChange }: { roadAssets: RoadAsset[], onBoundsChange?: (bounds: L.LatLngBounds) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (roadAssets.length > 0) {
      const bounds = new L.LatLngBounds([]);
      
      roadAssets.forEach(asset => {
        if (asset.geometry && typeof asset.geometry === 'object' && 'coordinates' in asset.geometry) {
          const coordinates = asset.geometry.coordinates as [number, number][];
          coordinates.forEach(coord => {
            bounds.extend([coord[1], coord[0]]);
          });
        }
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [map, roadAssets]);
  
  // Track bounds changes for viewport-based loading
  useEffect(() => {
    if (!onBoundsChange) return;
    
    const handleBoundsChange = () => {
      const bounds = map.getBounds();
      onBoundsChange(bounds);
    };
    
    // Initial bounds
    map.whenReady(() => {
      handleBoundsChange();
    });
    
    // Add event listeners for map interactions
    map.on('moveend', handleBoundsChange);
    map.on('zoomend', handleBoundsChange);
    
    return () => {
      map.off('moveend', handleBoundsChange);
      map.off('zoomend', handleBoundsChange);
    };
  }, [map, onBoundsChange]);
  
  return null;
}

// Define types for moisture range modes
type MoistureRangeMode = "local" | "global";

// Type for global moisture thresholds
interface MoistureThresholds {
  low: number;
  medium: number;
  high: number;
}

// Component for rendering moisture reading markers
function MoistureReadingsLayer({ 
  readings, 
  rangeMode, 
  thresholds 
}: { 
  readings: Record<string, MoistureReading>;
  rangeMode: MoistureRangeMode;
  thresholds: MoistureThresholds;
}) {
  // Moisture readings layer with optimized coordinate-based grouping
  
  // Memoize expensive road range calculations to prevent recalculation on zoom/pan
  const roadRanges = useMemo(() => {
    const ranges: Record<number, {min: number, max: number}> = {};
    
    if (rangeMode === "local" && Object.keys(readings).length > 0) {
      // Group readings by road asset ID to calculate ranges per road
      const readingsByRoad: Record<number, MoistureReading[]> = {};
      
      Object.values(readings).forEach(reading => {
        if (!readingsByRoad[reading.roadAssetId]) {
          readingsByRoad[reading.roadAssetId] = [];
        }
        readingsByRoad[reading.roadAssetId].push(reading);
      });
      
      // Calculate min/max for each road
      Object.entries(readingsByRoad).forEach(([roadId, roadReadings]) => {
        const moistureValues = roadReadings.map(r => r.moistureValue);
        let minMoisture = Math.min(...moistureValues);
        let maxMoisture = Math.max(...moistureValues);
        
        // Ensure we have some range to work with
        if (maxMoisture === minMoisture) {
          minMoisture = Math.max(0, minMoisture - 5);
          maxMoisture = Math.min(100, maxMoisture + 5);
        }
        
        ranges[parseInt(roadId)] = { min: minMoisture, max: maxMoisture };
      });
    }
    
    return ranges;
  }, [readings, rangeMode]); // Only recalculate when readings or rangeMode changes
  
  // Process readings based on selected range mode
  return (
    <>
      {Object.entries(readings).map(([coordinateKey, reading]) => {
        
        // Choose color based on range mode
        let readingColor: string;
        let rangeInfo: React.ReactNode;
        
        if (rangeMode === "local") {
          // Local mode uses per-road min/max for relative coloring
          const roadRange = roadRanges[reading.roadAssetId];
          if (roadRange) {
            readingColor = getRelativeMoistureColor(
              reading.moistureValue, 
              roadRange.min, 
              roadRange.max
            );
            
            // Calculate percentage within range for local mode
            const percentOfRange = roadRange.max === roadRange.min 
              ? 0 
              : ((reading.moistureValue - roadRange.min) / (roadRange.max - roadRange.min) * 100).toFixed(1);
              
            rangeInfo = (
              <>
                <p className="text-xs">
                  <span className="font-medium">Road Range:</span> {roadRange.min.toFixed(2)}% - {roadRange.max.toFixed(2)}%
                </p>
                <p className="text-xs">
                  <span className="font-medium">Relative:</span> {percentOfRange}% of road range
                </p>
              </>
            );
          } else {
            // Fallback if no road range calculated
            readingColor = getMoistureColor(reading.moistureValue, thresholds);
            rangeInfo = (
              <p className="text-xs">
                <span className="font-medium">Value:</span> {reading.moistureValue.toFixed(2)}%
              </p>
            );
          }
        } else {
          // Global mode uses user-defined thresholds
          readingColor = getMoistureColor(reading.moistureValue, thresholds);
          
          // Show threshold info for global mode
          rangeInfo = (
            <p className="text-xs">
              <span className="font-medium">Thresholds:</span> Low: {thresholds.low}%, Med: {thresholds.medium}%, High: {thresholds.high}%
            </p>
          );
        }
        
        return (
          <CircleMarker
            key={`moisture-point-${reading.id}`}
            center={[reading.latitude, reading.longitude]}
            radius={5}
            pathOptions={{
              color: readingColor,
              fillColor: readingColor,
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
              <Popup>
                <div className="p-2">
                  <h3 className="font-medium text-sm">Moisture Reading</h3>
                  <div className="flex flex-col gap-1 mt-1">
                    <p className="text-xs">
                      <span className="font-medium">Value:</span> {reading.moistureValue.toFixed(2)}%
                    </p>
                    <p className="text-xs">
                      <span className="font-medium">Mode:</span> {rangeMode === "local" ? "Local (per-street)" : "Global (fixed thresholds)"}
                    </p>
                    {rangeInfo}
                    <p className="text-xs">
                      <span className="font-medium">Date:</span> {new Date(reading.readingDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs">
                      <span className="font-medium">Coordinates:</span> {reading.latitude.toFixed(5)}, {reading.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </>
  );
}

export default function Map({ 
  roadAssets, 
  height = "h-80", 
  center = [40.7650, -73.9800], // Center on Midtown Manhattan
  zoom = 13, // Higher zoom to better see streets
  onAssetClick,
  initialLayer = "pci",
  moistureReadings = {},
  onBoundsChange
}: MapProps) {
  const [selectedAsset, setSelectedAsset] = useState<RoadAsset | null>(null);
  const [activeLayer, setActiveLayer] = useState<"pci" | "moisture">(initialLayer);
  
  // Add moisture range mode and threshold settings
  const [moistureRangeMode, setMoistureRangeMode] = useState<MoistureRangeMode>("local");
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [moistureThresholds, setMoistureThresholds] = useState<MoistureThresholds>({
    low: 8,
    medium: 15,
    high: 25
  });
  
  // Input fields for threshold settings
  const [lowThreshold, setLowThreshold] = useState(moistureThresholds.low.toString());
  const [mediumThreshold, setMediumThreshold] = useState(moistureThresholds.medium.toString());
  const [highThreshold, setHighThreshold] = useState(moistureThresholds.high.toString());
  
  // Update thresholds when input fields change
  const updateThresholds = () => {
    const low = parseFloat(lowThreshold);
    const medium = parseFloat(mediumThreshold);
    const high = parseFloat(highThreshold);
    
    // Validate numbers
    if (isNaN(low) || isNaN(medium) || isNaN(high)) {
      return; // Don't update if values are not valid numbers
    }
    
    // Validate ranges (low < medium < high)
    if (low >= medium || medium >= high) {
      return; // Don't update if ranges are invalid
    }
    
    setMoistureThresholds({
      low,
      medium,
      high
    });
  };
  
  // Update activeLayer when initialLayer prop changes
  useEffect(() => {
    setActiveLayer(initialLayer);
  }, [initialLayer]);
  
  const handleAssetClick = (asset: RoadAsset) => {
    setSelectedAsset(asset);
    if (onAssetClick) {
      onAssetClick(asset);
    }
  };
  
  // Helper function to extract coordinates from a road asset
  const getCoordinates = (asset: RoadAsset): [number, number][] => {
    if (asset.geometry && typeof asset.geometry === 'object' && 'coordinates' in asset.geometry) {
      const coordinates = asset.geometry.coordinates as [number, number][];
      
      // Convert the coordinates to Leaflet's [lat, lng] format from GeoJSON's [lng, lat]
      return coordinates.map(coord => [coord[1], coord[0]]);
    }
    return [];
  };
  
  // Check if we have moisture readings
  const hasMoistureReadings = Object.keys(moistureReadings).length > 0;
  console.log("Has moisture readings:", hasMoistureReadings, Object.keys(moistureReadings).length);
  
  return (
    <MapContainer 
      className={`${height} w-full rounded-lg`} 
      center={center} 
      zoom={zoom} 
      scrollWheelZoom={true}
    >
      <LayersControl position="topright">
        {/* Base Maps */}
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="Topographic">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      
      {/* Display PCI layer if activeLayer is pci */}
      {activeLayer === "pci" && roadAssets.map((asset) => {
        const coordinates = getCoordinates(asset);
        if (coordinates.length === 0) return null;
        
        const conditionColor = getConditionColor(asset.condition);
        
        return (
          <Polyline
            key={`pci-${asset.id}`}
            positions={coordinates}
            pathOptions={{
              color: conditionColor,
              weight: 6,
              opacity: 0.9,
              lineCap: "round", 
              lineJoin: "round"
            }}
            eventHandlers={{
              click: () => handleAssetClick(asset)
            }}
          />
        );
      })}
      
      {/* Display Moisture layer if activeLayer is moisture */}
      {activeLayer === "moisture" && (
        <>
          {roadAssets.map((asset) => {
            const coordinates = getCoordinates(asset);
            if (coordinates.length === 0) return null;
            
            // Choose color based on range mode
            const moistureColor = moistureRangeMode === "global" 
              ? getMoistureColor(asset.moistureLevel, moistureThresholds)
              : getMoistureColor(asset.moistureLevel); // Use default for "local" mode for the roads
            
            return (
              <Polyline
                key={`moisture-${asset.id}`}
                positions={coordinates}
                pathOptions={{
                  color: moistureColor,
                  weight: 6,
                  opacity: 0.8,
                  lineCap: "round", 
                  lineJoin: "round"
                }}
                eventHandlers={{
                  click: () => handleAssetClick(asset)
                }}
              />
            );
          })}
          
          {/* Render all the individual moisture reading markers */}
          {hasMoistureReadings && (
            <MoistureReadingsLayer 
              readings={moistureReadings} 
              rangeMode={moistureRangeMode} 
              thresholds={moistureThresholds} 
            />
          )}
        </>
      )}
      
      {/* Layer Toggle Control with Animation */}
      <div className="leaflet-top leaflet-left" style={{ top: '80px' }}>
        <motion.div 
          className="leaflet-control leaflet-bar bg-white p-2 shadow-md rounded-md overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ 
            width: activeLayer === "moisture" ? "auto" : "auto",
            height: "auto"
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 mb-1">
              <motion.button 
                onClick={() => setActiveLayer("pci")} 
                className={`px-2 py-1 text-xs rounded flex-1 ${activeLayer === "pci" ? 'bg-primary text-white' : 'bg-gray-100'}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                PCI View
              </motion.button>
              <motion.button 
                onClick={() => setActiveLayer("moisture")} 
                className={`px-2 py-1 text-xs rounded flex-1 ${activeLayer === "moisture" ? 'bg-primary text-white' : 'bg-gray-100'}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Moisture View
              </motion.button>
            </div>
            
            {/* Only show moisture options when in moisture view with animation */}
            <AnimatePresence>
              {activeLayer === "moisture" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="h-px bg-gray-200 my-1"></div>
                  
                  <div className="text-xs font-medium mb-1">Moisture Range Mode:</div>
                  <div className="flex gap-1">
                    <motion.button 
                      onClick={() => setMoistureRangeMode("local")} 
                      className={`px-2 py-1 text-xs rounded flex-1 ${moistureRangeMode === "local" ? 'bg-primary text-white' : 'bg-gray-100'}`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Local
                    </motion.button>
                    <motion.button 
                      onClick={() => setMoistureRangeMode("global")} 
                      className={`px-2 py-1 text-xs rounded flex-1 ${moistureRangeMode === "global" ? 'bg-primary text-white' : 'bg-gray-100'}`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Global
                    </motion.button>
                  </div>
                  
                  {/* Show threshold settings button when in global mode with animation */}
                  <AnimatePresence>
                    {moistureRangeMode === "global" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2"
                      >
                        <motion.button 
                          onClick={() => setShowThresholdSettings(!showThresholdSettings)} 
                          className="w-full px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center gap-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {showThresholdSettings ? (
                            <>
                              <span>Hide Thresholds</span>
                              <span className="text-sm">↑</span>
                            </>
                          ) : (
                            <>
                              <span>Set Thresholds</span>
                              <span className="text-sm">↓</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      
      {/* Global Threshold Settings Panel with Animated Slider */}
      <AnimatePresence>
        {activeLayer === "moisture" && 
         moistureRangeMode === "global" && 
         showThresholdSettings && (
          <div className="leaflet-bottom leaflet-left" style={{ bottom: '20px', left: '20px' }}>
            <motion.div 
              className="leaflet-control leaflet-bar bg-white p-3 shadow-md rounded-md"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              <div className="flex flex-col gap-2 min-w-[350px]">
                <motion.h3 
                  className="text-sm font-medium"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Global Moisture Thresholds
                </motion.h3>
                <motion.div 
                  className="text-xs text-gray-500 mb-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Adjust thresholds by dragging the sliders below
                </motion.div>
                
                {/* Import and use our new animated slider component */}
                <motion.div 
                  className="py-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <MoistureRangeSlider 
                    thresholds={moistureThresholds}
                    onChange={(newThresholds) => {
                      setMoistureThresholds(newThresholds);
                      
                      // Update the input field values too
                      setLowThreshold(newThresholds.low.toString());
                      setMediumThreshold(newThresholds.medium.toString());
                      setHighThreshold(newThresholds.high.toString());
                    }}
                    maxValue={40}
                  />
                </motion.div>
                
                {/* Keep manual input fields for precise adjustments */}
                <motion.div 
                  className="flex flex-col gap-2 mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs">Low Threshold:</label>
                    <input 
                      type="number" 
                      value={lowThreshold} 
                      onChange={(e) => setLowThreshold(e.target.value)}
                      className="w-20 text-xs p-1 border rounded" 
                      min="0" 
                      max={mediumThreshold}
                      step="0.1"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-xs">Medium Threshold:</label>
                    <input 
                      type="number" 
                      value={mediumThreshold} 
                      onChange={(e) => setMediumThreshold(e.target.value)}
                      className="w-20 text-xs p-1 border rounded" 
                      min={lowThreshold} 
                      max={highThreshold}
                      step="0.1"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-xs">High Threshold:</label>
                    <input 
                      type="number" 
                      value={highThreshold} 
                      onChange={(e) => setHighThreshold(e.target.value)}
                      className="w-20 text-xs p-1 border rounded" 
                      min={mediumThreshold}
                      step="0.1"
                    />
                  </div>
                </motion.div>
                
                <motion.div 
                  className="flex justify-between mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <motion.button 
                    onClick={() => setShowThresholdSettings(false)} 
                    className="px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Close
                  </motion.button>
                  <motion.button 
                    onClick={updateThresholds} 
                    className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Apply
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <MapController roadAssets={roadAssets} onBoundsChange={onBoundsChange} />
      
      {selectedAsset && selectedAsset.geometry && 
        typeof selectedAsset.geometry === 'object' && 
        'coordinates' in selectedAsset.geometry && 
        Array.isArray(selectedAsset.geometry.coordinates) && 
        selectedAsset.geometry.coordinates.length > 0 && (
        <Popup
          position={[
            (selectedAsset.geometry.coordinates[0][1] as number),
            (selectedAsset.geometry.coordinates[0][0] as number)
          ]}
          eventHandlers={{
            popupclose: () => setSelectedAsset(null)
          }}
        >
          <div className="p-2">
            <h3 className="font-medium text-sm">{selectedAsset.name}</h3>
            <p className="text-xs text-gray-600">{selectedAsset.location}</p>
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-xs">
                <span className="font-medium">Condition:</span> {getConditionState(selectedAsset.condition).toUpperCase()} ({selectedAsset.condition}/100)
              </p>
              <p className="text-xs">
                <span className="font-medium">Moisture:</span> {selectedAsset.moistureLevel !== null ? `${selectedAsset.moistureLevel.toFixed(1)}%` : 'Not measured'}
              </p>
              <p className="text-xs">
                <span className="font-medium">Last Inspection:</span> {new Date(selectedAsset.lastInspection).toLocaleDateString()}
              </p>
              {selectedAsset.lastMoistureReading && (
                <p className="text-xs">
                  <span className="font-medium">Last Moisture Reading:</span> {new Date(selectedAsset.lastMoistureReading).toLocaleDateString()}
                </p>
              )}
            </div>
            <button 
              onClick={() => onAssetClick && onAssetClick(selectedAsset)}
              className="text-xs text-primary hover:text-secondary mt-2"
            >
              View Details
            </button>
          </div>
        </Popup>
      )}
    </MapContainer>
  );
}
