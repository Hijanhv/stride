import { Text, TouchableOpacity, View } from 'react-native';

interface NBButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export default function NBButton({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled = false,
  className = '',
  icon
}: NBButtonProps) {
  
  const getBgColor = () => {
    if (disabled) return 'bg-gray-400';
    switch (variant) {
      case 'primary': return 'bg-neo-yellow';
      case 'secondary': return 'bg-neo-white';
      case 'danger': return 'bg-neo-pink';
      default: return 'bg-neo-yellow';
    }
  };

  const getTextColor = () => {
    return 'text-black';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`
        ${getBgColor()} 
        border-2 border-black 
        px-6 py-4 
        rounded-xl
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
        flex-row justify-center items-center gap-2
        ${className}
      `}
    >
      {icon && <View>{icon}</View>}
      <Text className={`${getTextColor()} font-bold text-lg uppercase tracking-wider`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
