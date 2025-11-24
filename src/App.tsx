import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvent,
  Circle,
} from "react-leaflet";
import { Menu, X, Search } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom SVG icons for markers
const createSvgIcon = (bgColor: string, svgInner: string) => {
  const svg = `
    <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#s)">
        <path d="M17 0 C26 0 34 8 34 17 C34 28 17 42 17 42 C17 42 0 28 0 17 C0 8 8 0 17 0 Z" fill="${bgColor}" />
        ${svgInner}
      </g>
    </svg>
  `;

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="width:34px;height:42px;display:flex;align-items:center;justify-content:center">${svg}</div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  });
};

// Microwave icon (simple microwave door + waves)
const microwaveSvgInner = `
  <rect x="6" y="10" width="22" height="16" rx="2" fill="white" opacity="0.95" />
  <rect x="8" y="12" width="6" height="12" rx="1" fill="#f3f4f6" />
  <g fill="none" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round">
    <path d="M16 20c1-1 3-1 4 0" />
    <path d="M16 23c1-1 3-1 4 0" />
  </g>
`;

// Fridge icon (tall fridge with handle)
const fridgeSvgInner = `
  <rect x="8" y="6" width="18" height="28" rx="2" fill="white" opacity="0.95" />
  <rect x="8" y="18" width="18" height="4" fill="#e6edf8" />
  <rect x="24" y="12" width="2" height="6" rx="1" fill="#cbd5e1" />
`;

const microwaveIcon = createSvgIcon("#ef4444", microwaveSvgInner);
const fridgeIcon = createSvgIcon("#3b82f6", fridgeSvgInner);

interface Appliance {
  id: string;
  type: "Microwave" | "Fridge";
  building: string;
  confidence: number;
  lat: number;
  lng: number;
  floor?: string;
  room?: string;
}

// Default appliances
const defaultAppliances: Appliance[] = [];

function MapUpdater({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// Capture clicks on the map (not on markers) and forward the lat/lng
function MapClickHandler({
  onClick,
}: {
  onClick: (coords: [number, number]) => void;
}) {
  useMapEvent("click", (e: any) => {
    const { lat, lng } = e.latlng;
    onClick([lat, lng]);
  });
  return null;
}

// Haversine formula for distance in meters
function getDistanceFromLatLonInM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [appliances, setAppliances] = useState<Appliance[]>(defaultAppliances);
  const [filteredAppliances, setFilteredAppliances] =
    useState<Appliance[]>(defaultAppliances);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "Microwave",
    "Fridge",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    44.6369, -63.5903,
  ]);
  const [mapZoom, setMapZoom] = useState(17);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [maxDistance, setMaxDistance] = useState(1000); // meters

  // Filter appliances by type, search, and distance
  useEffect(() => {
    if (!userLocation) {
      // just filter by type and search until user location known
      const filtered = appliances.filter((app) => {
        const typeMatch = selectedTypes.includes(app.type);
        const searchMatch =
          searchQuery === "" ||
          app.building.toLowerCase().includes(searchQuery.toLowerCase());
        return typeMatch && searchMatch;
      });
      setFilteredAppliances(filtered);
      return;
    }

    const filtered = appliances.filter((app) => {
      const typeMatch = selectedTypes.includes(app.type);
      const searchMatch =
        searchQuery === "" ||
        app.building.toLowerCase().includes(searchQuery.toLowerCase());
      const distanceM = getDistanceFromLatLonInM(
        userLocation[0],
        userLocation[1],
        app.lat,
        app.lng
      );
      return typeMatch && searchMatch && distanceM <= maxDistance;
    });
    setFilteredAppliances(filtered);
  }, [appliances, selectedTypes, searchQuery, userLocation, maxDistance]);

  // Get user's location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setUserLocation([latitude, longitude]);
          setMapZoom(18);
        },
        () => console.warn("Location access denied. Using default coordinates.")
      );
    }
  }, []);

  // Load appliances from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("http://localhost:4000/appliances");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          // ensure types: map numeric fields
          const normalized: Appliance[] = data.map((d: any) => {
            const rawType = String(d.type || "").toLowerCase();
            let typeVal: "Microwave" | "Fridge" = "Microwave";
            if (rawType.includes("fridge")) typeVal = "Fridge";
            else if (rawType.includes("microwave")) typeVal = "Microwave";
            else {
              // fallback: capitalize first letter
              const t = String(d.type || "");
              typeVal = (t.charAt(0).toUpperCase() + t.slice(1)) as any;
            }
            return {
              id: String(d.id),
              type: typeVal,
              building: d.building,
              confidence: Number(d.confidence) || 0,
              lat: Number(d.lat),
              lng: Number(d.lng),
              floor: d.floor || undefined,
              room: d.room || undefined,
            };
          });
          setAppliances(normalized);
        }
      } catch (e) {
        console.warn("Failed to load appliances from server:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleApplianceClick = (appliance: Appliance) => {
    setMapCenter([appliance.lat, appliance.lng]);
    setMapZoom(18);
    // mark this clicked appliance as the user's current location
    setUserLocation([appliance.lat, appliance.lng]);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm z-10 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium text-blue-600">Applifind</span>
          <span>/</span>
          <span>Dalhousie University</span>
          <span>/</span>
          <span className="font-medium">Studley Campus</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={24} />
          </button> */}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:relative z-20 w-80 bg-white shadow-lg transition-transform duration-300 h-full flex flex-col`}
        >
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold mb-4">Appliances</h2>

            {/* Type Filters */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Type</p>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleType("Fridge")}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTypes.includes("Fridge")
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Fridge
                </button>
                <button
                  onClick={() => toggleType("Microwave")}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTypes.includes("Microwave")
                      ? "bg-red-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Microwave
                </button>
                <button
                  onClick={() => setSelectedTypes(["Microwave", "Fridge"])}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTypes.length === 2
                      ? "bg-gray-700 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Distance Slider */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Max Distance (meters)
              </p>
              <input
                type="range"
                min="0"
                max="1000"
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs mt-1">{maxDistance} m</p>
            </div>
          </div>

          {/* Appliance List */}
          <div className="flex-1 overflow-y-auto">
            {filteredAppliances.map((appliance) => (
              <button
                key={appliance.id}
                onClick={() => handleApplianceClick(appliance)}
                className="w-full p-4 border-b hover:bg-gray-50 text-left transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {appliance.type}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {appliance.building}
                    </p>
                    {appliance.floor && (
                      <p className="text-xs text-gray-500">{appliance.floor}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Confidence: {appliance.confidence}%
                    </p>
                    {userLocation && (
                      <p className="text-xs text-gray-500 mt-1">
                        Distance:{" "}
                        {Math.round(
                          getDistanceFromLatLonInM(
                            userLocation[0],
                            userLocation[1],
                            appliance.lat,
                            appliance.lng
                          )
                        )}{" "}
                        m
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {userLocation
                        ? `${Math.round(
                            getDistanceFromLatLonInM(
                              userLocation[0],
                              userLocation[1],
                              appliance.lat,
                              appliance.lng
                            )
                          )} m`
                        : "— m"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="h-full w-full"
            zoomControl={true}
          >
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            <MapClickHandler
              onClick={(coords) => {
                // clicking on the map (not markers) marks that spot as the user's location
                setUserLocation(coords);
                setMapCenter(coords);
                setMapZoom(18);
              }}
            />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {filteredAppliances.map((appliance) => (
              <Marker
                key={appliance.id}
                position={[appliance.lat, appliance.lng]}
                icon={
                  appliance.type === "Microwave" ? microwaveIcon : fridgeIcon
                }
                eventHandlers={{
                  click: () => {
                    // clicking a marker marks that location as the user's current location
                    setUserLocation([appliance.lat, appliance.lng]);
                    setMapCenter([appliance.lat, appliance.lng]);
                    setMapZoom(18);
                  },
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold">{appliance.type}</h3>
                    <p className="text-sm">{appliance.building}</p>
                    {appliance.floor && (
                      <p className="text-xs">{appliance.floor}</p>
                    )}
                    {appliance.room && (
                      <p className="text-xs">{appliance.room}</p>
                    )}
                    <p className="text-xs mt-1">
                      Distance:{" "}
                      {userLocation
                        ? Math.round(
                            getDistanceFromLatLonInM(
                              userLocation[0],
                              userLocation[1],
                              appliance.lat,
                              appliance.lng
                            )
                          )
                        : "—"}{" "}
                      m
                    </p>
                    <p className="text-xs">
                      Confidence: {appliance.confidence}%
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              "http://localhost:4000/report",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  applianceId: appliance.id,
                                  atLocation: true,
                                }),
                              }
                            );
                            if (res.ok) {
                              alert(
                                "Thanks — reported present at this location."
                              );
                            } else {
                              alert("Failed to send report");
                            }
                          } catch (e) {
                            alert(
                              "Error sending report. Is the server running?"
                            );
                          }
                        }}
                        className="px-3 py-1 bg-green-500 text-white rounded"
                      >
                        Yes — it's here
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              "http://localhost:4000/report",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  applianceId: appliance.id,
                                  atLocation: false,
                                }),
                              }
                            );
                            if (res.ok) {
                              alert(
                                "Thanks — reported not present at this location."
                              );
                            } else {
                              alert("Failed to send report");
                            }
                          } catch (e) {
                            alert(
                              "Error sending report. Is the server running?"
                            );
                          }
                        }}
                        className="px-3 py-1 bg-red-500 text-white rounded"
                      >
                        No — not here
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* User Location Marker */}
            {userLocation && (
              <>
                <Marker position={userLocation}>
                  <Popup>You are here</Popup>
                </Marker>
                <Circle
                  center={userLocation}
                  radius={maxDistance}
                  pathOptions={{ color: "blue", fillOpacity: 0.1 }}
                />
              </>
            )}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg">
            <p className="text-xs font-medium text-gray-700 mb-2">Legend</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-xs">Microwave</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span className="text-xs">Fridge</span>
              </div>
            </div>
          </div>

          {/* Find My Location Button */}
          <button
            onClick={() => {
              if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((position) => {
                  const { latitude, longitude } = position.coords;
                  setMapCenter([latitude, longitude]);
                  setUserLocation([latitude, longitude]);
                  setMapZoom(18);
                });
              }
            }}
            // fixed so it's visible above the map and sidebar at all times
            // absolute so it's positioned relative to the map/main area (top-right of map)
            className="absolute top-4 right-4 z-50 bg-white px-4 py-2 shadow rounded-lg hover:bg-gray-100"
          >
            Find My Location
          </button>
        </main>
      </div>
    </div>
  );
}
