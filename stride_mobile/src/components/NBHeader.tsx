import { Text, View } from 'react-native';

interface NBHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}

export default function NBHeader({ title, subtitle, rightElement }: NBHeaderProps) {
  return (
    <View className="pt-14 pb-6 px-6 bg-neo-bg border-b-2 border-black flex-row justify-between items-center">
      <View>
        <Text className="text-black text-3xl font-black uppercase tracking-tighter shadow-black">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-gray-600 font-bold text-sm mt-1 uppercase tracking-wide">
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement && (
        <View>
          {rightElement}
        </View>
      )}
    </View>
  );
}
