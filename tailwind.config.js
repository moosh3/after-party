/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Twitch-inspired streaming theme
        'twitch-purple': '#9146FF',    // Twitch purple
        'twitch-dark': '#18181b',      // Dark background
        'twitch-darker': '#0e0e10',    // Darker background
        'twitch-gray': '#1f1f23',      // Card background
        'twitch-border': '#2f2f35',    // Border color
        'twitch-text': '#efeff1',      // Text color
        'twitch-text-alt': '#adadb8',  // Alt text
        'twitch-red': '#f1707d',       // Live indicator
        'twitch-hover': '#26262c',     // Hover state
        primary: '#9146FF',            // Purple as primary
        secondary: '#bf94ff',          // Light purple
        success: '#00f593',            // Green
        error: '#f1707d',              // Red
      },
      fontFamily: {
        'sans': ['Ethna', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        'ethna': ['Ethna', 'sans-serif'],
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'twitch': '0 2px 10px rgba(0, 0, 0, 0.5)',
        'twitch-lg': '0 4px 20px rgba(0, 0, 0, 0.7)',
      },
    },
  },
  plugins: [],
}

