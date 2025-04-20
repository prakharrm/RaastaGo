import { searchLocation } from "@/hooks/mapbox";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import debounce from "lodash/debounce";
import * as Location from "expo-location";

export default function HomeScreen() {
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<
    [number, number] | null
  >(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [focusedInput, setFocusedInput] = useState<boolean>(false);

  const router = useRouter();

  // Get user's current location on mount
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          alert("Location permission not granted");
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const coords: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        setUserCoords(coords);
      } catch (err) {
        console.error("Location error:", err);
      }
    };

    getCurrentLocation();
  }, []);

  const debouncedDestSuggestions = debounce(async (query: string) => {
    if (query.trim() === "") return;
    const res = await searchLocation(query);
    setDestSuggestions(res);
  }, 300);

  useEffect(() => {
    if (focusedInput) debouncedDestSuggestions(destination);
  }, [destination]);

  const handleSelectSuggestion = (item: any) => {
    const coords: [number, number] = [item.coordinates[0], item.coordinates[1]];
    setDestination(`${item.name} ${item.address}`);
    setDestinationCoords(coords);
    setDestSuggestions([]);
    setFocusedInput(false);
  };

  const renderSuggestions = () => (
    <View className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-xl shadow-lg z-10 max-h-40 overflow-hidden">
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={destSuggestions}
        keyExtractor={(item, index) => item.mapbox_id || item.address + index}
        renderItem={({ item }) => (
          <Pressable
            className="px-4 py-3 border-b border-gray-100"
            onPress={() => handleSelectSuggestion(item)}
          >
            <Text className="font-medium text-black">{item.name}</Text>
            <Text className="text-gray-500 text-xs">{item.address}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  return (
    <SafeAreaView className="h-full bg-white">
      <Pressable
        onPress={() => {
          setFocusedInput(false);
          Keyboard.dismiss();
        }}
        className="flex-1"
      >
        <View className="items-center pt-[50%] px-[10%] relative">
          <Text className="text-2xl mb-6">Where are you heading to?</Text>

          {/* Destination Input */}
          <View className="w-full mb-5 relative z-10">
            <TextInput
              className="h-12 w-full border px-5 rounded-2xl"
              placeholder="Search destination"
              value={destination}
              onFocus={() => setFocusedInput(true)}
              onChangeText={(text) => setDestination(text)}
            />
            {focusedInput && renderSuggestions()}
          </View>

          <TouchableOpacity
            className={`w-[50%] h-12 rounded-3xl flex items-center justify-center ${
              destinationCoords ? "bg-red-500" : "bg-gray-300"
            }`}
            disabled={!userCoords || !destinationCoords}
            onPress={() => {
              router.push({
                pathname: "/route",
                params: {
                  userCoords: JSON.stringify(userCoords),
                  destinationCoords: JSON.stringify(destinationCoords),
                },
              });
            }}
          >
            <Text className="font-medium text-lg text-white">Start</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}
