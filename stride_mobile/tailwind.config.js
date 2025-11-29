module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neo: {
          yellow: '#FFDE59',
          pink: '#FF66C4',
          blue: '#5CE1E6',
          green: '#7ED957',
          purple: '#C084FC',
          orange: '#FF914D',
          white: '#FFFFFF',
          black: '#000000',
          bg: '#E0E7FF', // Light indigo background
        }
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
      }
    },
  },
  plugins: [],
  presets: [require("nativewind/preset")],
}

