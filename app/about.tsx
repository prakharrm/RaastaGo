import { View, Text, ScrollView, TouchableOpacity,Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function AboutScreen() {
  const router = useRouter();

  const founders = [
    {
      name: "Deepak",
      role: "Founder",
      bio: "Visionary behind RaastaGo — building tech to improve road safety and smart navigation across India.",
      image: require("@/assets/founders/deepak.jpg"), // Replace with updated image
    },
    {
      name: "Devansh Sharma",
      role: "Co-Founder",
      bio: "Focused on seamless user experience and powerful real-time systems to make journeys smarter.",
    },
    { 
      name: "Mahi Swami",
      role: "Co-Founder",
      bio: "Driven to integrate smart mapping with community-led road safety, ensuring no traveler is left behind.",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="px-6">
        <TouchableOpacity onPress={() => router.back()} className="mt-2 mb-6">
          <Text className="text-red-400 text-base">← Go Back</Text>
        </TouchableOpacity>

        <Text className="text-4xl font-extrabold text-red-500 mb-2">RaastaGo</Text>
        <Text className="text-lg text-gray-400 mb-6">
          Built with ❤️ by a passionate team committed to revolutionizing road navigation and safety in India.
        </Text>

        {/* Deepak's Section with Image */}
        <View className="mb-8 items-center">
          <View className="w-36 h-36 rounded-full bg-zinc-800 mb-4 overflow-hidden">
            <Image
              source={founders[0].image}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
          <Text className="text-xl font-semibold text-white text-center">{founders[0].name}</Text>
          <Text className="text-sm text-red-400 mb-2 text-center">{founders[0].role}</Text>
          <Text className="text-center text-gray-400 text-base px-4">
            {founders[0].bio}
          </Text>
        </View>

        {/* Devansh's Section */}
        <View className="mb-8">
          <Text className="text-xl font-semibold text-white text-center">{founders[1].name}</Text>
          <Text className="text-sm text-red-400 mb-2 text-center ">{founders[1].role}</Text>
          <Text className="text-center text-gray-400 text-base px-4">
            {founders[1].bio}
          </Text>
        </View>

        {/* Mahi's Section */}
        <View className="mb-8">
          <Text className="text-xl font-semibold text-white text-center">{founders[2].name}</Text>
          <Text className="text-sm text-red-400 mb-2 text-center">{founders[2].role}</Text>
          <Text className="text-center text-gray-400 text-base px-4">
            {founders[2].bio}
          </Text>
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
