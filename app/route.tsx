import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import MapboxGL, {
  Camera,
  LineLayer,
  LocationPuck,
  ShapeSource,
} from "@rnmapbox/maps";
import { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";


MapboxGL.setAccessToken(
  "pk.eyJ1IjoicHJha2hhcnJtIiwiYSI6ImNtOWR5aGRhMjBpZ2wyaXI3ZDRiazJpa3UifQ.1_XXxtXUZD_YH67ADDy5Mw"
);

export default function RouteScreen() {
  const router = useRouter();
  const { userCoords, destinationCoords } = useLocalSearchParams();

  const [from, setFrom] = useState<[number, number] | null>(null);
  const [routeSegments, setRouteSegments] = useState<any[]>([]);

  const [notificationToken, setNotificationToken] = useState<string | null>(null);

useEffect(() => {
  const registerForPushNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const token = await Notifications.getExpoPushTokenAsync();
        setNotificationToken(token.data);
      } else {
        console.log("Notification permission not granted");
      }
    } catch (e) {
      console.error("Error getting push notification token", e);
    }
  };

  registerForPushNotifications();
}, []);


  const parseCoords = (
    coordsParam: string | string[] | undefined
  ): [number, number] | null => {
    try {
      const parsed = Array.isArray(coordsParam)
        ? JSON.parse(coordsParam[0])
        : JSON.parse(coordsParam || "");
      if (!Array.isArray(parsed) || parsed.length !== 2) return null;
      return [parsed[0], parsed[1]];
    } catch (e) {
      console.warn("Failed to parse coords", coordsParam);
      return null;
    }
  };

  const getDirection = async (from: [number, number], to: [number, number]) => {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&steps=true&annotations=congestion&access_token=pk.eyJ1IjoicHJha2hhcnJtIiwiYSI6ImNtOWR5aGRhMjBpZ2wyaXI3ZDRiazJpa3UifQ.1_XXxtXUZD_YH67ADDy5Mw`;
    const res = await fetch(url);
    return await res.json();
  };

  useEffect(() => {
    const fromCoords = parseCoords(userCoords);
    const toCoords = parseCoords(destinationCoords);

    if (!fromCoords || !toCoords) {
      console.error("Invalid or missing coordinates", { fromCoords, toCoords });
      return;
    }

    setFrom(fromCoords);

    const fetchRoute = async () => {
      const data = await getDirection(fromCoords, toCoords);
      const routes = data.routes || [];
    
      const mainRoute = routes[0];
      const altRoutes = routes.slice(1); // remaining alternate routes
    
      const segments: any[] = [];
    
      // Process main route with congestion
      const mainCoords = mainRoute?.geometry?.coordinates;
      const mainCongestion = mainRoute?.legs?.[0]?.annotation?.congestion || [];
    
      let trafficAhead = false;
    
      for (let i = 0; i < mainCoords.length - 1; i++) {
        const congestion = mainCongestion[i] || "unknown";
        if (congestion === "heavy" || congestion === "severe") {
          trafficAhead = true;
        }
    
        segments.push({
          type: "Feature",
          properties: {
            congestion: congestion,
            isAlternate: false,
          },
          geometry: {
            type: "LineString",
            coordinates: [mainCoords[i], mainCoords[i + 1]],
          },
        });
      }
    
      // Add alternate routes in gray
      for (const alt of altRoutes) {
        const altCoords = alt.geometry?.coordinates;
        if (!altCoords || altCoords.length < 2) continue;
    
        for (let i = 0; i < altCoords.length - 1; i++) {
          segments.push({
            type: "Feature",
            properties: {
              isAlternate: true,
            },
            geometry: {
              type: "LineString",
              coordinates: [altCoords[i], altCoords[i + 1]],
            },
          });
        }
      }
    
      setRouteSegments(segments);
    
      // If there is traffic ahead, send a push notification
      if (trafficAhead && notificationToken) {
        sendTrafficNotification();
      }
    };
    
    // Function to send a push notification
    const sendTrafficNotification = async () => {
      if (!notificationToken) return;
    
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Traffic Ahead!",
            body: "There's heavy or severe traffic on your route. Consider taking an alternate route.",
          },
          trigger: null, // immediate notification
        });
      } catch (e) {
        console.error("Error sending notification", e);
      }
    };
    ;

    fetchRoute();
  }, [userCoords, destinationCoords]);

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
          >
            <LineLayer
              id="routeLine"
              style={{
                lineWidth: 5,
                lineJoin: "round",
                lineColor: [
                  "case",
                  ["==", ["get", "isAlternate"], true],
                  "#aaaaaa", // gray for alternate
                  [
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
                    "#2ecc71",
                    "#2ecc71",
                  ],
                ],
              }}
            />
          </ShapeSource>
        )}

        <LocationPuck puckBearing="heading" />
      </MapboxGL.MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      
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
  backButton: {
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
  legend: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "#000000aa",
    padding: 10,
    borderRadius: 8,
  },
});
