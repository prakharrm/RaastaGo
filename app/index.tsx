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
    <View className="absolute top-full left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-b-xl shadow-lg z-10 max-h-40 overflow-hidden">
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={destSuggestions}
        keyExtractor={(item, index) => item.mapbox_id || item.address + index}
        renderItem={({ item }) => (
          <Pressable
            className="px-4 py-3 border-b border-zinc-800"
            onPress={() => handleSelectSuggestion(item)}
          >
            <Text className="font-medium text-white">{item.name}</Text>
            <Text className="text-gray-400 text-xs">{item.address}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  return (
    <SafeAreaView className="h-full bg-black">
      <Pressable
        onPress={() => {
          setFocusedInput(false);
          Keyboard.dismiss();
        }}
        className="flex-1 justify-between"
      >
        <View className="items-center pt-[10%] px-[10%] relative">
          {/* App Logo & Intro */}
          <View className="items-center mb-6">
            <Text className="text-4xl font-extrabold text-red-500 tracking-wider">
              RaastaGo
            </Text>
            <Text className="text-center text-xl text-gray-400 mt-10 px-4">
              🚦 India’s own smart यात्री साथी to navigate real-time road
              challenges — traffic jams, accidents, and hazards — all with a
              tap.
            </Text>
            <Text className="text-center text-gray-500 mt-2 px-4 text-lg italic">
              "Raasta dikhaaye, raasta badle" – Empowering your every move.
            </Text>
          </View>

          <Text className="text-2xl text-white mt-14 mb-6">
            Where are you heading to?
          </Text>

          {/* Destination Input */}
          <View className="w-full mb-5 relative z-10">
            <TextInput
              className="h-12 w-full border border-zinc-700 bg-zinc-900 text-white px-5 rounded-2xl"
              placeholder="Search destination"
              placeholderTextColor="#888"
              value={destination}
              onFocus={() => setFocusedInput(true)}
              onChangeText={(text) => setDestination(text)}
            />
            {focusedInput && renderSuggestions()}
          </View>

          {/* Start Button */}
          <TouchableOpacity
            className={`w-[50%] h-12 rounded-3xl flex items-center justify-center ${
              destinationCoords ? "bg-red-500" : "bg-zinc-800"
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
            <Text className="font-semibold text-lg text-white">Start</Text>
          </TouchableOpacity>

          {/* Founders Section */}
       
        </View>

        {/* Founders Section */}
        {/* Founders Section */}
        <View className="w-full py-6 px-6 bg-zinc-950 border-t border-zinc-800 mt-10">
          <Text className="text-center text-gray-500 text-sm mb-2">
            Curious who's behind RaastaGo?
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/about")}
            className="flex items-center justify-center"
          >
            <Text className="text-red-400 font-semibold text-base">
              🚀 Know the Founders →
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}
