import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import NBButton from '../components/NBButton';
import NBCard from '../components/NBCard';
import NBHeader from '../components/NBHeader';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();
  
  // Mock balance for now
  const balance = 12500; 

  const onRefresh = async () => {
    setRefreshing(true);
    // Refetch queries
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader 
        title="Dashboard" 
        subtitle="Welcome Back"
        rightElement={
          <View className="bg-neo-green px-3 py-1 border-2 border-black shadow-neo-sm rounded-full">
            <Text className="text-black text-xs font-bold uppercase">Photon Active</Text>
          </View>
        }
      />

      <ScrollView 
        className="flex-1 px-4 pt-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
      >
        {/* Portfolio Card */}
        <NBCard variant="highlight" className="mb-6 bg-neo-purple">
          <Text className="text-black text-sm font-bold mb-1 uppercase tracking-wider">Total Portfolio Value</Text>
          <Text className="text-white text-5xl font-black mb-6 shadow-black drop-shadow-md">
            ₹{balance.toLocaleString('en-IN')}
          </Text>
          
          <View className="flex-row gap-4">
            <NBButton 
              title="Invest" 
              onPress={() => navigation.navigate('Scan')}
              className="flex-1 bg-neo-yellow"
              icon={<Ionicons name="add-circle" size={20} color="black" />}
            />
            <NBButton 
              title="Withdraw" 
              onPress={() => {}}
              className="flex-1 bg-neo-white"
              icon={<Ionicons name="arrow-down-circle" size={20} color="black" />}
            />
          </View>
        </NBCard>

        {/* Photon Rewards */}
        <NBCard className="mb-6 bg-neo-yellow">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="trophy" size={24} color="black" />
              <Text className="text-black font-black text-xl uppercase">Rewards</Text>
            </View>
            <Text className="text-black font-black text-xl">1,250 PTS</Text>
          </View>
          
          <View className="h-4 bg-white border-2 border-black rounded-full overflow-hidden mb-2">
            <View className="h-full w-[65%] bg-neo-pink border-r-2 border-black" />
          </View>
          <Text className="text-black text-xs font-bold text-right uppercase">750 pts to next tier</Text>
        </NBCard>

        {/* Active SIPs */}
        <Text className="text-black font-black text-2xl mb-4 uppercase tracking-tighter">Your SIPs</Text>
        
        <NBCard className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-neo-blue border-2 border-black rounded-full items-center justify-center shadow-neo-sm">
              <Text className="text-black font-black text-lg">A</Text>
            </View>
            <View>
              <Text className="text-black font-bold text-lg">Aptos (APT)</Text>
              <Text className="text-gray-600 text-xs font-bold uppercase">Daily • ₹100</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-neo-green font-black text-lg bg-black px-2 py-1 rounded-md">+12.5%</Text>
            <Text className="text-gray-600 text-xs font-bold mt-1 uppercase">Next: 2h 15m</Text>
          </View>
        </NBCard>

      </ScrollView>
    </View>
  );
}
