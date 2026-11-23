import { Text, View } from "react-native";

export default function IndexScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-chovia-background px-6">
      <Text className="text-3xl font-bold text-chovia-green">CHOVIA</Text>
      <Text className="mt-3 text-center text-base text-chovia-deep">
        Customer app foundation is ready.
      </Text>
    </View>
  );
}
