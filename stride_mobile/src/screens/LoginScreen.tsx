import { api } from "@convex/_generated/api";
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useAction } from "convex/react";
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RootStackParamList } from "../navigation/AppNavigator";

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const registerUser = useAction(api.actions.photon.registerUser);

  const handleLogin = async () => {
    if (!phone || !email) {
      Alert.alert('Error', 'Please enter both your phone number and email');
      return;
    }

    setLoading(true);
    try {
      // @ts-ignore - Convex types might not be updated yet
      const data = await registerUser({ phone, email });

      if (data.walletAddress) {
        await SecureStore.setItemAsync('photon_wallet', data.walletAddress);
        await SecureStore.setItemAsync('photon_id', data.photonId);
        await SecureStore.setItemAsync('photon_token', data.accessToken);
        
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      }
    } catch (error) {
      console.error('Login Error:', error);
      Alert.alert('Login Failed', 'Could not register with Photon. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F5F5F5] justify-center items-center px-6">
      <View className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-lg border-4 border-black mb-10">
        <Text className="text-3xl font-black text-black mb-2 text-center">
          RUPAYA RAIL
        </Text>
        <Text className="text-gray-500 text-center mb-8 font-bold">
          UPI to Crypto SIPs
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-xs font-bold mb-1 ml-1">PHONE NUMBER</Text>
            <TextInput
              className="w-full bg-gray-100 border-2 border-black p-4 rounded-xl font-bold text-lg"
              placeholder="+91 98765 43210"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View>
            <Text className="text-xs font-bold mb-1 ml-1">EMAIL ADDRESS</Text>
            <TextInput
              className="w-full bg-gray-100 border-2 border-black p-4 rounded-xl font-bold text-lg"
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <TouchableOpacity
            className={`w-full bg-[#FFD700] border-2 border-black p-4 rounded-xl items-center mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none ${
              loading ? "opacity-50" : ""
            }`}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text className="text-black font-black text-lg">
                LOGIN WITH PHOTON
              </Text>
            )}
          </TouchableOpacity>
          
          <Text className="text-center text-gray-500 text-xs mt-6 font-bold uppercase">
            Powered by Aptos • Photon • Decibel
          </Text>
        </View>
      </View>
    </View>
  );
}
