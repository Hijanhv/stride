import { Text, TextInput, TextInputProps, View } from 'react-native';

interface NBInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export default function NBInput({ 
  label, 
  error, 
  containerClassName = '',
  className = '',
  ...props 
}: NBInputProps) {
  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && (
        <Text className="text-black font-bold mb-2 uppercase tracking-wide text-sm">
          {label}
        </Text>
      )}
      <TextInput
        className={`
          bg-white
          border-2 border-black
          rounded-xl
          px-4 py-3
          text-black text-lg font-medium
          shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
          focus:bg-neo-blue
          ${className}
        `}
        placeholderTextColor="#666"
        {...props}
      />
      {error && (
        <Text className="text-red-600 font-bold mt-1 text-sm">
          {error}
        </Text>
      )}
    </View>
  );
}
