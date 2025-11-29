import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NBButton from '../components/NBButton';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation();

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center items-center bg-neo-bg p-6">
        <Text className="text-black text-center mb-4 font-bold text-lg">We need your permission to show the camera</Text>
        <NBButton onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    alert(`Bar code with type ${type} and data ${data} has been scanned!`);
    
    setTimeout(() => {
        setScanned(false);
        navigation.goBack();
    }, 1000);
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
      
      <View className="absolute top-0 left-0 right-0 pt-16 pb-6 px-6 bg-neo-yellow border-b-4 border-black">
        <Text className="text-black text-2xl font-black text-center uppercase tracking-tighter">Scan UPI QR</Text>
        <Text className="text-black text-center text-sm mt-1 font-bold uppercase">Pay to start your SIP instantly</Text>
      </View>

      <View className="absolute bottom-10 left-0 right-0 items-center px-6">
        <NBButton 
            onPress={() => navigation.goBack()}
            title="Cancel"
            variant="danger"
            className="w-full"
        />
      </View>
    </View>
  );
}
