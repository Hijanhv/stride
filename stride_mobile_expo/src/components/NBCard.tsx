import { View, ViewProps } from 'react-native';

interface NBCardProps extends ViewProps {
  variant?: 'default' | 'highlight';
  className?: string;
}

export default function NBCard({ children, variant = 'default', className = '', ...props }: NBCardProps) {
  const getBgColor = () => {
    switch (variant) {
      case 'highlight': return 'bg-neo-purple';
      default: return 'bg-white';
    }
  };

  return (
    <View 
      className={`
        ${getBgColor()}
        border-2 border-black
        rounded-xl
        p-4
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        ${className}
      `}
      {...props}
    >
      {children}
    </View>
  );
}
