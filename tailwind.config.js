/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Casual streaming theme - inspired by banner
        'casual-violet': '#7c3aed',
        'casual-pink': '#ec4899',
        'casual-blue': '#3b82f6',
        'casual-yellow': '#fbbf24',
        'casual-light': '#f8fafc',
        'casual-dark': '#1e1b4b',
        'casual-purple': '#a855f7',
        'casual-indigo': '#6366f1',
        // Keep twitch colors for compatibility during transition
        'twitch-purple': '#7c3aed',    // Now uses casual violet
        'twitch-dark': '#1e1b4b',      // Darker purple
        'twitch-darker': '#0f0a2e',    // Deep purple
        'twitch-gray': '#312e81',      // Indigo for cards
        'twitch-border': '#4c1d95',    // Purple border
        'twitch-text': '#f8fafc',      // Light text
        'twitch-text-alt': '#c4b5fd',  // Light purple text
        'twitch-red': '#f1707d',       // Keep for live indicator
        'twitch-hover': '#4338ca',     // Indigo hover
        primary: '#fbbf24',            // Yellow as primary action
        secondary: '#a855f7',          // Purple
        success: '#34d399',            // Green
        error: '#f87171',              // Red
      },
      fontFamily: {
        'sans': ['Ethna', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        'ethna': ['Ethna', 'sans-serif'],
        'retro': ['"Courier New"', 'Courier', 'monospace'],
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'casual': '0 4px 20px rgba(124, 58, 237, 0.3)',
        'casual-lg': '0 8px 30px rgba(124, 58, 237, 0.4)',
        'glow-yellow': '0 0 20px rgba(251, 191, 36, 0.5)',
        'glow-purple': '0 0 30px rgba(168, 85, 247, 0.4)',
        'twitch': '0 2px 10px rgba(0, 0, 0, 0.5)',
        'twitch-lg': '0 4px 20px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        'gradient-casual': 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        'gradient-tv': 'linear-gradient(180deg, #6b7280 0%, #9ca3af 50%, #6b7280 100%)',
      },
    },
  },
  plugins: [],
}

