import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  Alert,
} from "react-native";
import MapboxGL, {
  Camera,
  LineLayer,
  ShapeSource,
  UserLocation, // Import UserLocation
} from "@rnmapbox/maps";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getDirection } from "../hooks/mapbox";
import type { Feature } from "geojson";
import {
  IncidentReportModal,
  getIncidentsNearPoint, // Corrected import
  IncidentMarker,
  INCIDENT_TYPES,
  confirmIncident,
} from "./incident";

// Define types for route segments and incidents
interface RouteSegment extends Feature {
  properties: {
    congestion: string;
    isAlternate: boolean;
    routeId: string;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

interface Route {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  legs: {
    annotation: {
      congestion: string[];
    };
  }[];
  routeId?: string;
}

interface Incident {
  id: string;
  type: string;
  location: any;
  coordinates: [number, number];
  description: string;
  reportedBy: string;
  reportedAt: any;
  active: boolean;
  upvotes: number;
  confirmedBy: string[];
  distance?: number;
}

MapboxGL.setAccessToken(
  "pk.eyJ1IjoicHJha2hhcnJtIiwiYSI6ImNtOWR5aGRhMjBpZ2wyaXI3ZDRiazJpa3UifQ.1_XXxtXUZD_YH67ADDy5Mw"
);

export default function RouteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [from, setFrom] = useState<[number, number] | null>(null);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const alertAnim = useRef(new Animated.Value(-100)).current;
  const [preferLessTrafficRoute, setPreferLessTrafficRoute] = useState(false);
  const [highlightedRoute, setHighlightedRoute] = useState<string | null>(null);
  const [manualDismiss, setManualDismiss] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showIncidentDetails, setShowIncidentDetails] = useState(false);

  // Safely parse coordinates from params
  const parseCoords = (
    coordsParam: string | string[] | undefined
  ): [number, number] | null => {
    if (!coordsParam) return null;

    try {
      let parsed;
      if (Array.isArray(coordsParam)) {
        parsed = JSON.parse(coordsParam[0]);
      } else {
        parsed = JSON.parse(coordsParam);
      }

      if (
        Array.isArray(parsed) &&
        parsed.length === 2 &&
        typeof parsed[0] === "number" &&
        typeof parsed[1] === "number"
      ) {
        return [parsed[0], parsed[1]];
      }
      return null;
    } catch (e) {
      console.warn("Failed to parse coords", coordsParam);
      return null;
    }
  };

  const userCoordinates = parseCoords(params.userCoords);
  const destCoordinates = parseCoords(params.destinationCoords);

  // Fetch incidents near the route
  const fetchIncidentsNearRoute = async (routeCoords: [number, number][]) => {
    try {
      const nearbyIncidents = await getIncidentsNearPoint(routeCoords[0], 0.5); // Corrected usage
      setIncidents(nearbyIncidents);

      if (nearbyIncidents.length > 0 && !manualDismiss) {
        showIncidentAlert();
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  // Show incident alert animation
  const showIncidentAlert = () => {
    setShowAlert(true);
    Animated.timing(alertAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(alertAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowAlert(false));
      }, 4000);
    });
  };

  // Handle incident report submission
  const handleIncidentReported = async (incidentId: string) => {
    try {
      if (routeSegments.length > 0 && highlightedRoute) {
        const routeCoords = routeSegments
          .filter((seg) => seg.properties.routeId === highlightedRoute)
          .flatMap((seg) => seg.geometry.coordinates);

        await fetchIncidentsNearRoute(routeCoords);
      }

      Alert.alert(
        "Incident Reported",
        "Your incident report has been added to the map. Thank you for contributing!",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error refreshing incidents after report:", error);
      Alert.alert("Error", "Failed to refresh incidents. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  // Handle incident marker press
  const handleIncidentPress = (incident: Incident) => {
    setSelectedIncident(incident);
    setShowIncidentDetails(true);
  };

  // Handle incident confirmation
  const handleConfirmIncident = async () => {
    if (!selectedIncident) return;

    try {
      // Replace with actual user ID if authentication is implemented
      const userId = "anonymous";
      const confirmed = await confirmIncident(selectedIncident.id, userId);

      if (confirmed) {
        Alert.alert(
          "Thank You!",
          "You've confirmed this incident. This helps other drivers stay informed.",
          [{ text: "OK", onPress: () => setShowIncidentDetails(false) }]
        );

        if (routeSegments.length > 0 && highlightedRoute) {
          const routeCoords = routeSegments
            .filter((seg) => seg.properties.routeId === highlightedRoute)
            .flatMap((seg) => seg.geometry.coordinates);

          await fetchIncidentsNearRoute(routeCoords);
        }
      } else {
        Alert.alert("Already Confirmed", "You've already confirmed this incident.", [
          { text: "OK" },
        ]);
      }
    } catch (error) {
      console.error("Error confirming incident:", error);
      Alert.alert("Error", "Failed to confirm incident. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  // Fetch and process routes on coordinate change
  useEffect(() => {
    if (!userCoordinates || !destCoordinates) {
      console.error("Invalid or missing coordinates");
      return;
    }

    setFrom(userCoordinates);

    const fetchRoute = async () => {
      try {
        const data = await getDirection(userCoordinates, destCoordinates);

        if (!data.routes || data.routes.length === 0) {
          console.error("No routes returned");
          return;
        }

        const mainRoute = data.routes[0];
        const altRoutes = data.routes.slice(1);

        const segments: RouteSegment[] = [];
        let trafficAhead = false;

        // Process main route segments
        if (mainRoute?.geometry?.coordinates) {
          const mainCoords = mainRoute.geometry.coordinates;
          const mainCongestion = mainRoute.legs?.[0]?.annotation?.congestion || [];

          for (let i = 0; i < mainCoords.length - 1; i++) {
            if (
              !Array.isArray(mainCoords[i]) ||
              !Array.isArray(mainCoords[i + 1]) ||
              mainCoords[i].length < 2 ||
              mainCoords[i + 1].length < 2
            ) {
              continue;
            }

            const start: [number, number] = [mainCoords[i][0], mainCoords[i][1]];
            const end: [number, number] = [mainCoords[i + 1][0], mainCoords[i + 1][1]];

            const congestion = i < mainCongestion.length ? mainCongestion[i] : "unknown";
            if (congestion === "heavy" || congestion === "severe") {
              trafficAhead = true;
            }

            segments.push({
              type: "Feature",
              properties: {
                congestion,
                isAlternate: false,
                routeId: "main",
              },
              geometry: {
                type: "LineString",
                coordinates: [start, end],
              },
            });
          }
        }

        // Process alternate routes
        altRoutes.forEach((alt: Route, index: number) => {
          if (alt?.geometry?.coordinates) {
            const altCoords = alt.geometry.coordinates;
            const altCongestion = alt.legs?.[0]?.annotation?.congestion || [];

            for (let i = 0; i < altCoords.length - 1; i++) {
              if (
                !Array.isArray(altCoords[i]) ||
                !Array.isArray(altCoords[i + 1]) ||
                altCoords[i].length < 2 ||
                altCoords[i + 1].length < 2
              ) {
                continue;
              }

              const start: [number, number] = [altCoords[i][0], altCoords[i][1]];
              const end: [number, number] = [altCoords[i + 1][0], altCoords[i + 1][1]];

              const congestion = i < altCongestion.length ? altCongestion[i] : "unknown";

              segments.push({
                type: "Feature",
                properties: {
                  congestion,
                  isAlternate: true,
                  routeId: `alt_${index}`,
                },
                geometry: {
                  type: "LineString",
                  coordinates: [start, end],
                },
              });
            }
          }
        });

        setRouteSegments(segments);
        setHighlightedRoute("main");
        setPreferLessTrafficRoute(altRoutes.length > 0);

        if (trafficAhead && !manualDismiss) {
          setShowAlert(true);
          Animated.timing(alertAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setTimeout(() => {
              Animated.timing(alertAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
              }).start(() => setShowAlert(false));
            }, 4000);
          });
        }
      } catch (error) {
        console.error("Error fetching directions:", error);
      }
    };

    fetchRoute();
  }, [params.userCoords, params.destinationCoords]);

  // Fetch incidents when route or highlighted route changes
  useEffect(() => {
    if (routeSegments.length > 0 && highlightedRoute) {
      const routeCoords = routeSegments
        .filter((seg) => seg.properties.routeId === highlightedRoute)
        .flatMap((seg) => seg.geometry.coordinates);

      fetchIncidentsNearRoute(routeCoords);
    }
  }, [routeSegments, highlightedRoute]);

  // Format timestamp for display
  const formatTime = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) return "Just now";

    try {
      const date = timestamp.toDate();
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "Just now";
    }
  };

  // Render incident details card
  const renderIncidentDetailsCard = () => {
    if (!selectedIncident || !showIncidentDetails) return null;

    const incidentType = INCIDENT_TYPES.find((type) => type.id === selectedIncident.type);
    const typeName = incidentType ? incidentType.name : "Unknown";
    const time = selectedIncident.reportedAt ? formatTime(selectedIncident.reportedAt) : "Just now";

    return (
      <View style={styles.incidentCard}>
        <View style={styles.incidentCardHeader}>
          <Text style={styles.incidentCardTitle}>Incident Report</Text>
          <TouchableOpacity
            style={styles.closeCardButton}
            onPress={() => setShowIncidentDetails(false)}
          >
            <Text style={styles.closeButtonText}>✖</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.incidentCardContent}>
          <Text style={styles.incidentCardTime}>Reported at {time}</Text>
          <Text style={styles.incidentCardType}>
            {incidentType?.icon || "⚠️"} {typeName}
          </Text>
          {selectedIncident.description ? (
            <Text style={styles.incidentCardDescription}>
              "{selectedIncident.description}"
            </Text>
          ) : null}
          <Text style={styles.incidentCardConfirmed}>
            Confirmed by {selectedIncident.confirmedBy?.length || 0} drivers
          </Text>
        </View>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmIncident}>
          <Text style={styles.confirmButtonText}>Confirm This Incident</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <MapboxGL.MapView styleURL={MapboxGL.StyleURL.Dark} style={styles.map}>
        {from && (
          <Camera
            centerCoordinate={from}
            zoomLevel={13}
            animationMode="flyTo"
            animationDuration={1000}
          />
        )}

        {routeSegments.length > 0 && (
          <ShapeSource
            id="routeSource"
            shape={{
              type: "FeatureCollection",
              features: routeSegments,
            }}
            onPress={(e) => {
              const pressedFeature = e.features?.[0];
              if (pressedFeature?.properties?.routeId) {
                setHighlightedRoute(pressedFeature.properties.routeId);
              }
            }}
          >
            {/* Base white line for highlighted route */}
            <LineLayer
              id="highlightedBase"
              style={{
                lineJoin: "round",
                lineColor: "#ffffff",
                lineWidth: [
                  "case",
                  ["==", ["get", "routeId"], highlightedRoute],
                  6,
                  0,
                ],
              }}
            />

            {/* Colored congestion line for highlighted route */}
            <LineLayer
              id="highlightedTraffic"
              style={{
                lineJoin: "round",
                lineColor: [
                  "match",
                  ["get", "congestion"],
                  "low",
                  "#2ecc71",
                  "moderate",
                  "#f1c40f",
                  "heavy",
                  "#e67e22",
                  "severe",
                  "#e74c3c",
                  "unknown",
                  "#95a5a6",
                  "#34495e",
                ],
                lineWidth: [
                  "case",
                  ["==", ["get", "routeId"], highlightedRoute],
                  4,
                  0,
                ],
              }}
            />

            {/* Dimmed lines for unselected routes */}
            <LineLayer
              id="unselectedRoutes"
              style={{
                lineJoin: "round",
                lineColor: [
                  "case",
                  ["!=", ["get", "routeId"], highlightedRoute],
                  "#888888",
                  "transparent",
                ],
                lineWidth: [
                  "case",
                  ["!=", ["get", "routeId"], highlightedRoute],
                  3,
                  0,
                ],
              }}
            />
          </ShapeSource>
        )}

        {/* Incident markers */}
        {incidents.map((incident) => (
          <IncidentMarker
            key={incident.id}
            incident={incident}
            onPress={() => handleIncidentPress(incident)}
          />
        ))}

        {/* User location puck */}
        <UserLocation visible={true} showsUserHeading={true} androidRenderMode="normal" />
      </MapboxGL.MapView>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      {/* Alert banner for traffic or incidents */}
      {showAlert && (
        <Animated.View
          style={[
            styles.alertBanner,
            { transform: [{ translateY: alertAnim }] },
          ]}
        >
          <Text style={styles.alertText}>
            Traffic congestion or incidents ahead. Drive carefully!
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowAlert(false);
              setManualDismiss(true);
            }}
          >
            <Text style={styles.alertDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Button to report a new incident */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setShowIncidentModal(true)}
      >
        <Text style={styles.reportButtonText}>Report Incident</Text>
      </TouchableOpacity>

      {/* Incident report modal */}
      {showIncidentModal && (
        <IncidentReportModal
          onClose={() => setShowIncidentModal(false)}
          onIncidentReported={handleIncidentReported}
          userCoordinates={userCoordinates}
        />
      )}

      {/* Incident details card */}
      {renderIncidentDetailsCard()}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  alertBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#e74c3c",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  alertText: {
    color: "#fff",
    fontWeight: "bold",
  },
  alertDismiss: {
    color: "#fff",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  reportButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#3498db",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    zIndex: 10,
  },
  reportButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  incidentCard: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 15,
    zIndex: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  incidentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  incidentCardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  closeCardButton: {
    padding: 5,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 20,
  },
  incidentCardContent: {
    marginTop: 10,
  },
  incidentCardTime: {
    color: "#aaa",
    fontSize: 12,
  },
  incidentCardType: {
    color: "#fff",
    fontSize: 16,
    marginVertical: 5,
  },
  incidentCardDescription: {
    color: "#ddd",
    fontStyle: "italic",
    marginBottom: 5,
  },
  incidentCardConfirmed: {
    color: "#bbb",
    fontSize: 12,
  },
  confirmButton: {
    marginTop: 10,
    backgroundColor: "#27ae60",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "#000000aa",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
