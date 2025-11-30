import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DepositScreen from "../screens/DepositScreen";
import LoginScreen from "../screens/LoginScreen";
import ManageSIPScreen from "../screens/ManageSIPScreen";
import ReceiptsScreen from "../screens/ReceiptsScreen";
import TabNavigator from "./TabNavigator";

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Deposit: {
    userId: string;
    userName?: string;
    userPhone: string;
  };
  ManageSIP: {
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
  Receipts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="ManageSIP" component={ManageSIPScreen} />
      <Stack.Screen name="Receipts" component={ReceiptsScreen} />
    </Stack.Navigator>
  );
}
