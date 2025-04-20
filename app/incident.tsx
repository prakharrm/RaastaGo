import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  GeoPoint,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import { FirebaseApp } from "firebase/app";
import { Analytics } from "firebase/analytics";
import { Firestore } from "firebase/firestore";
import { Auth } from "firebase/auth";
import { FirebaseStorage } from "firebase/storage";
import MapboxGL from "@rnmapbox/maps";

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyAAVHN3_e8FocA1207ChvdatZL7z5Yspls",
  authDomain: "navigation-application-f25c9.firebaseapp.com",
  projectId: "navigation-application-f25c9",
  storageBucket: "navigation-application-f25c9.firebasestorage.app",
  messagingSenderId: "238385563870",
  appId: "1:238385563870:web:18b258e37ec97221a61a4f",
  measurementId: "G-MTE1VX6B9J",
};

let app: FirebaseApp;
let analytics: Analytics;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Incident types
export const INCIDENT_TYPES = [
  { id: "accident", name: "Accident", icon: "🚗" },
  { id: "damaged_road", name: "Damaged Road", icon: "🚧" },
  { id: "blocked_road", name: "Road Blocked", icon: "🚫" },
  { id: "flooding", name: "Road Flooding", icon: "💧" },
  { id: "police", name: "Police Activity", icon: "👮" },
  { id: "construction", name: "Construction", icon: "🏗️" },
  { id: "heavy_traffic", name: "Heavy Traffic", icon: "🚦" },
  { id: "hazard", name: "Road Hazard", icon: "⚠️" },
];

// TypeScript interfaces
export interface Incident {
  id: string;
  type: string;
  location: GeoPoint;
  coordinates: [number, number];
  description: string;
  reportedBy: string;
  reportedAt: any;
  active: boolean;
  upvotes: number;
  confirmedBy: string[];
  distance?: number;
}

export interface IncidentReportModalProps {
  visible: boolean;
  onClose: () => void;
  userLocation: [number, number];
  onIncidentReported?: (incidentId: string) => void;
}

interface IncidentType {
  id: string;
  name: string;
  icon: string;
}

// Function to report an incident
export const reportIncident = async (
  incidentType: string,
  coordinates: [number, number],
  description: string = "",
  userId: string = "anonymous"
): Promise<string> => {
  try {
    if (!db) throw new Error("Firebase DB not initialized");

    const incidentRef = await addDoc(collection(db, "incidents"), {
      type: incidentType,
      location: new GeoPoint(coordinates[1], coordinates[0]), // Lat, Lng format for GeoPoint
      coordinates: coordinates,
      description: description,
      reportedBy: userId,
      reportedAt: serverTimestamp(),
      active: true,
      upvotes: 0,
      confirmedBy: [],
    });

    console.log("Incident reported with ID: ", incidentRef.id);
    return incidentRef.id;
  } catch (error) {
    console.error("Error adding incident: ", error);
    throw error;
  }
};

// Function to confirm an incident
export const confirmIncident = async (
  incidentId: string,
  userId: string = "anonymous"
): Promise<boolean> => {
  try {
    if (!db) throw new Error("Firebase DB not initialized");

    const incidentRef = doc(db, "incidents", incidentId);
    const incidentSnap = await getDocs(query(collection(db, "incidents"), where("id", "==", incidentId)));
    
    if (incidentSnap.empty) {
      return false;
    }
    
    const incidentData = incidentSnap.docs[0].data();
    const confirmedBy = incidentData.confirmedBy || [];
    
    // Check if user already confirmed this incident
    if (confirmedBy.includes(userId)) {
      return false;
    }
    
    // Add user to confirmedBy array and increment upvotes
    await updateDoc(incidentRef, {
      confirmedBy: [...confirmedBy, userId],
      upvotes: (incidentData.upvotes || 0) + 1
    });
    
    return true;
  } catch (error) {
    console.error("Error confirming incident: ", error);
    return false;
  }
};

// Function to calculate distance between coordinates (in km)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Function to get incidents near a point
export const getIncidentsNearPoint = async (
  coordinates: [number, number],
  radiusKm: number = 5
): Promise<Incident[]> => {
  try {
    if (!db) throw new Error("Firebase DB not initialized");

    const incidentsRef = collection(db, "incidents");
    const q = query(incidentsRef, where("active", "==", true));
    const querySnapshot = await getDocs(q);

    const incidents: Incident[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const incident = {
        id: doc.id,
        ...data,
        coordinates: data.coordinates as [number, number],
      } as Incident;

      const distance = calculateDistance(
        incident.coordinates[1],
        incident.coordinates[0],
        coordinates[1],
        coordinates[0]
      );

      if (distance <= radiusKm) {
        incident.distance = distance; // Add distance information
        incidents.push(incident);
      }
    });

    incidents.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return incidents;
  } catch (error) {
    console.error("Error getting incidents: ", error);
    return [];
  }
};

// Function to get incidents near a route
export const getIncidentsNearRoute = async (
  routeCoordinates: [number, number][],
  radiusKm: number = 0.5
): Promise<Incident[]> => {
  try {
    if (!db || !routeCoordinates.length) throw new Error("Firebase DB not initialized or invalid route");

    const incidentsRef = collection(db, "incidents");
    const q = query(incidentsRef, where("active", "==", true));
    const querySnapshot = await getDocs(q);

    const incidents: Incident[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const incident = {
        id: doc.id,
        ...data,
        coordinates: data.coordinates as [number, number],
      } as Incident;

      // Find minimum distance to any point on the route
      let minDistance = Infinity;
      for (const routePoint of routeCoordinates) {
        const distance = calculateDistance(
          incident.coordinates[1],
          incident.coordinates[0],
          routePoint[1],
          routePoint[0]
        );
        minDistance = Math.min(minDistance, distance);
      }

      if (minDistance <= radiusKm) {
        incident.distance = minDistance;
        incidents.push(incident);
      }
    });

    incidents.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return incidents;
  } catch (error) {
    console.error("Error getting incidents near route:", error);
    return [];
  }
};

// Incident Marker Component
export const IncidentMarker: React.FC<{
  incident: Incident;
  onPress: () => void;
}> = ({ incident, onPress }) => {
  const incidentType = INCIDENT_TYPES.find(type => type.id === incident.type);
  
  return (
    <MapboxGL.PointAnnotation
      id={`incident-${incident.id}`}
      coordinate={incident.coordinates}
      onSelected={onPress}
    >
      <View style={styles.markerContainer}>
        <Text style={styles.markerIcon}>
          {incidentType?.icon || "⚠️"}
        </Text>
      </View>
    </MapboxGL.PointAnnotation>
  );
};

// Incident report modal component
export const IncidentReportModal: React.FC<{
  onClose: () => void;
  onIncidentReported: (incidentId: string) => Promise<void>;
  userCoordinates: [number, number] | null;
}> = ({
  onClose,
  onIncidentReported,
  userCoordinates,
}) => {
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    try {
      if (!selectedType || !userCoordinates) {
        Alert.alert("Error", "Please select an incident type and ensure location is available");
        return;
      }

      setIsSubmitting(true);

      const userId = auth?.currentUser?.uid || "anonymous";
      const incidentId = await reportIncident(
        selectedType.id,
        userCoordinates,
        description,
        userId
      );

      setIsSubmitting(false);
      onClose();
      await onIncidentReported(incidentId);
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to submit report. Please try again.");
      console.error(error);
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report Road Incident</Text>
            <Text style={styles.modalSubtitle}>
              What type of incident did you encounter?
            </Text>

            <FlatList
              data={INCIDENT_TYPES}
              numColumns={2}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.typeList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.typeItem,
                    selectedType?.id === item.id && styles.selectedType,
                  ]}
                  onPress={() => setSelectedType(item)}
                >
                  <Text style={styles.typeIcon}>{item.icon}</Text>
                  <Text style={styles.typeName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <TextInput
              style={styles.descriptionInput}
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Provide additional details about the incident..."
              maxLength={150}
              editable={!isSubmitting}
            />

            <Text style={styles.charCount}>{description.length}/150</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={isSubmitting || !selectedType}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalBox: {
    backgroundColor: "white",
    width: "80%",
    maxWidth: 400,
    borderRadius: 10,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalContent: {
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 15,
    color: "#666",
    textAlign: "center",
  },
  typeList: {
    width: "100%",
  },
  typeItem: {
    alignItems: "center",
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    width: "45%",
    height: 80,
    justifyContent: "center",
  },
  selectedType: {
    backgroundColor: "#e0f7fa",
    borderColor: "#0288d1",
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  typeName: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
  },
  descriptionInput: {
    width: "100%",
    height: 100,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    textAlignVertical: "top",
    marginTop: 15,
  },
  charCount: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  cancelButton: {
    backgroundColor: "#d32f2f",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  backButton: {
    backgroundColor: "#0288d1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  nextButton: {
    backgroundColor: "#0288d1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  disabledButton: {
    backgroundColor: "#b0bec5",
  },
  nextButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  submitButton: {
    backgroundColor: "#4caf50",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  markerIcon: {
    fontSize: 16,
  },
});
