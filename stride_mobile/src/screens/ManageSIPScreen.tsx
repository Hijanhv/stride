import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import NBButton from "../components/NBButton";
import NBCard from "../components/NBCard";
import NBHeader from "../components/NBHeader";

interface ManageSIPScreenProps {
  route: {
    params: {
      sipId: string;
      sipData: {
        name?: string;
        amount: number;
        frequency: "hourly" | "daily" | "weekly" | "biweekly" | "monthly";
        tokenSymbol: string;
        status: "active" | "paused" | "cancelled";
        totalInvested: number;
        totalReceived: number;
        averagePrice: number;
        executionCount: number;
        nextExecution: number;
      };
    };
  };
}

export default function ManageSIPScreen({ route }: ManageSIPScreenProps) {
  const navigation = useNavigation();
  const { sipId, sipData } = route.params;

  const [amount, setAmount] = useState(sipData.amount.toString());
  const [frequency, setFrequency] = useState(sipData.frequency);
  const [isPaused, setIsPaused] = useState(sipData.status === "paused");
  const [loading, setLoading] = useState(false);

  const frequencies: Array<{
    value: "hourly" | "daily" | "weekly" | "biweekly" | "monthly";
    label: string;
  }> = [
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  const handleUpdateAmount = async () => {
    const newAmount = parseInt(amount);

    if (isNaN(newAmount) || newAmount < 100) {
      Alert.alert("Invalid Amount", "Minimum SIP amount is ₹100");
      return;
    }

    setLoading(true);

    try {
      // TODO: Call Convex mutation to update SIP amount
      // await convex.mutation(api.sips.updateAmount, { sipId, amount: newAmount });

      Alert.alert("Success", `SIP amount updated to ₹${newAmount}`);
    } catch (error) {
      Alert.alert("Error", "Failed to update amount");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFrequency = async (newFrequency: typeof frequency) => {
    setLoading(true);

    try {
      // TODO: Call Convex mutation to update frequency
      // await convex.mutation(api.sips.updateFrequency, { sipId, frequency: newFrequency });

      setFrequency(newFrequency);
      Alert.alert("Success", `Frequency updated to ${newFrequency}`);
    } catch (error) {
      Alert.alert("Error", "Failed to update frequency");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (value: boolean) => {
    setLoading(true);

    try {
      if (value) {
        // Pause SIP
        // await convex.mutation(api.sips.pause, { sipId });
        Alert.alert(
          "SIP Paused",
          "Your SIP has been paused. You can resume it anytime."
        );
      } else {
        // Resume SIP
        // await convex.mutation(api.sips.resume, { sipId });
        Alert.alert("SIP Resumed", "Your SIP is now active again.");
      }

      setIsPaused(value);
    } catch (error) {
      Alert.alert("Error", "Failed to update SIP status");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSIP = () => {
    Alert.alert(
      "Cancel SIP?",
      "Are you sure you want to cancel this SIP? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // await convex.mutation(api.sips.cancel, { sipId });
              Alert.alert("SIP Cancelled", "Your SIP has been cancelled.", [
                {
                  text: "OK",
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              Alert.alert("Error", "Failed to cancel SIP");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Calculate DCA statistics
  const avgPrice = sipData.averagePrice / 100000000; // Unscale
  const currentPrice = 10; // TODO: Get from price oracle
  const currentValue = sipData.totalReceived * currentPrice;
  const roi =
    sipData.totalInvested > 0
      ? ((currentValue - sipData.totalInvested) / sipData.totalInvested) * 100
      : 0;

  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader
        title="Manage SIP"
        subtitle={sipData.name || `${sipData.tokenSymbol} SIP`}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView className="flex-1 px-4 pt-6">
        {/* Status Card */}
        <NBCard className={`mb-6 ${isPaused ? "bg-gray-400" : "bg-neo-green"}`}>
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-black font-black text-xl uppercase">
                {isPaused ? "Paused" : "Active"}
              </Text>
              <Text className="text-black/70 font-bold text-sm uppercase">
                {sipData.executionCount} executions
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-black font-bold uppercase text-sm">
                {isPaused ? "Resume" : "Pause"}
              </Text>
              <Switch
                value={isPaused}
                onValueChange={handleTogglePause}
                disabled={loading}
                trackColor={{ false: "#10B981", true: "#9CA3AF" }}
                thumbColor="white"
              />
            </View>
          </View>

          {!isPaused && (
            <View className="bg-black/10 border-2 border-black/20 rounded-lg p-3">
              <Text className="text-black font-bold text-xs uppercase mb-1">
                Next Execution
              </Text>
              <Text className="text-black font-black text-lg">
                {new Date(sipData.nextExecution).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Text>
            </View>
          )}
        </NBCard>

        {/* DCA Statistics */}
        <NBCard className="mb-6 bg-neo-purple">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="stats-chart" size={24} color="white" />
            <Text className="text-white font-black text-xl uppercase tracking-tight">
              DCA Performance
            </Text>
          </View>

          <View className="gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-white/70 font-bold text-sm uppercase">
                Total Invested
              </Text>
              <Text className="text-white font-black text-lg">
                ₹{sipData.totalInvested.toLocaleString("en-IN")}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-white/70 font-bold text-sm uppercase">
                Tokens Received
              </Text>
              <Text className="text-white font-black text-lg">
                {sipData.totalReceived.toFixed(4)} {sipData.tokenSymbol}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-white/70 font-bold text-sm uppercase">
                Average Price
              </Text>
              <Text className="text-white font-black text-lg">
                ₹{avgPrice.toFixed(2)}
              </Text>
            </View>

            <View className="h-[1px] bg-white/20 my-1" />

            <View className="flex-row justify-between items-center">
              <Text className="text-white/70 font-bold text-sm uppercase">
                Current Value
              </Text>
              <Text className="text-white font-black text-lg">
                ₹{currentValue.toLocaleString("en-IN")}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-white/70 font-bold text-sm uppercase">
                ROI
              </Text>
              <Text
                className={`font-black text-lg ${
                  roi >= 0 ? "text-neo-green" : "text-red-500"
                }`}
              >
                {roi >= 0 ? "+" : ""}
                {roi.toFixed(2)}%
              </Text>
            </View>
          </View>
        </NBCard>

        {/* Update Amount */}
        <NBCard className="mb-6 bg-white">
          <Text className="text-black font-black text-lg mb-3 uppercase tracking-tight">
            Update Amount
          </Text>

          <View className="flex-row items-center border-2 border-black rounded-xl p-4 bg-neo-bg mb-4">
            <Text className="text-black font-black text-2xl mr-2">₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#999"
              className="flex-1 text-black font-black text-2xl"
              editable={!loading && !isPaused}
            />
          </View>

          <NBButton
            title="Update Amount"
            onPress={handleUpdateAmount}
            disabled={
              loading || isPaused || amount === sipData.amount.toString()
            }
            className="bg-neo-blue"
            icon={<Ionicons name="refresh" size={20} color="black" />}
          />
        </NBCard>

        {/* Update Frequency */}
        <NBCard className="mb-6 bg-white">
          <Text className="text-black font-black text-lg mb-3 uppercase tracking-tight">
            Update Frequency
          </Text>

          <View className="gap-2">
            {frequencies.map((freq) => (
              <TouchableOpacity
                key={freq.value}
                onPress={() => handleUpdateFrequency(freq.value)}
                disabled={loading || isPaused}
                className={`border-2 border-black rounded-xl p-4 ${
                  frequency === freq.value
                    ? "bg-neo-yellow shadow-neo"
                    : "bg-neo-bg"
                } ${loading || isPaused ? "opacity-50" : ""}`}
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-black font-bold text-lg uppercase">
                    {freq.label}
                  </Text>
                  {frequency === freq.value && (
                    <Ionicons name="checkmark-circle" size={24} color="black" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </NBCard>

        {/* Gas-Free Badge */}
        <NBCard className="mb-6 bg-neo-pink">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-black rounded-full items-center justify-center">
              <Ionicons name="flash" size={24} color="#FDE047" />
            </View>
            <View className="flex-1">
              <Text className="text-black font-black text-lg uppercase">
                ⚡ Gas-Free Updates
              </Text>
              <Text className="text-black/70 font-bold text-sm">
                All changes are free - no transaction fees!
              </Text>
            </View>
          </View>
        </NBCard>

        {/* Danger Zone */}
        <NBCard className="mb-6 bg-red-100 border-red-500">
          <Text className="text-red-800 font-black text-lg mb-3 uppercase tracking-tight">
            Danger Zone
          </Text>

          <NBButton
            title="Cancel SIP"
            onPress={handleCancelSIP}
            disabled={loading}
            className="bg-red-500 border-red-800"
            icon={<Ionicons name="trash" size={20} color="white" />}
          />

          <Text className="text-red-800/70 font-bold text-xs mt-2 uppercase text-center">
            This action cannot be undone
          </Text>
        </NBCard>

        {loading && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <View className="bg-white border-2 border-black rounded-xl p-6 shadow-neo">
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text className="text-black font-bold mt-3 uppercase">
                Updating...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
