import { Text, View } from 'react-native';
import NBHeader from '../components/NBHeader';

export default function PortfolioScreen() {
  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader title="Portfolio" />
      <View className="flex-1 justify-center items-center p-6">
        <View className="bg-white border-2 border-black p-8 rounded-xl shadow-neo items-center w-full">
          <Text className="text-black text-2xl font-black uppercase tracking-tighter mb-2">Analytics</Text>
          <Text className="text-gray-600 font-bold uppercase tracking-wide bg-neo-yellow px-2">Coming Soon</Text>
        </View>
      </View>
    </View>
  );
}
