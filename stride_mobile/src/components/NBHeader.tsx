import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

interface NBHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export default function NBHeader({
  title,
  subtitle,
  rightElement,
  showBack,
  onBack,
}: NBHeaderProps) {
  return (
    <View className="pt-14 pb-6 px-6 bg-neo-bg border-b-2 border-black">
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-3 flex-1">
          {showBack && onBack && (
            <TouchableOpacity
              onPress={onBack}
              className="w-10 h-10 bg-white border-2 border-black rounded-full items-center justify-center shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Ionicons name="arrow-back" size={20} color="black" />
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Text className="text-black text-3xl font-black uppercase tracking-tighter shadow-black">
              {title}
            </Text>
            {subtitle && (
              <Text className="text-gray-600 font-bold text-sm mt-1 uppercase tracking-wide">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {rightElement && <View>{rightElement}</View>}
      </View>
    </View>
  );
}
