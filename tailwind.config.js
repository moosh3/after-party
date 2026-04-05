/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Easter/Spring theme - pastel colors
        'casual-violet': '#c4b5fd',    // Soft lavender
        'casual-pink': '#fbcfe8',      // Pastel pink
        'casual-blue': '#a5f3fc',      // Light cyan/sky
        'casual-yellow': '#fef08a',    // Soft yellow
        'casual-light': '#fefefe',     // White
        'casual-dark': '#4a5568',      // Soft gray for text
        'casual-purple': '#ddd6fe',    // Light purple
        'casual-indigo': '#c7d2fe',    // Light indigo
        'casual-mint': '#a7f3d0',      // Mint green
        'casual-peach': '#fed7aa',     // Peach
        // Keep twitch colors for compatibility during transition
        'twitch-purple': '#c4b5fd',    // Soft lavender
        'twitch-dark': '#e9d5ff',      // Light purple bg
        'twitch-darker': '#f3e8ff',    // Very light purple
        'twitch-gray': '#faf5ff',      // Near white purple
        'twitch-border': '#ddd6fe',    // Soft purple border
        'twitch-text': '#4a5568',      // Dark gray text
        'twitch-text-alt': '#6b7280',  // Medium gray text
        'twitch-red': '#fda4af',       // Soft pink/red
        'twitch-hover': '#ede9fe',     // Very light purple hover
        primary: '#fef08a',            // Soft yellow as primary
        secondary: '#c4b5fd',          // Lavender
        success: '#86efac',            // Soft green
        error: '#fca5a5',              // Soft red
      },
      fontFamily: {
        'sans': ['Ethna', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        'ethna': ['Ethna', 'sans-serif'],
        'retro': ['"Courier New"', 'Courier', 'monospace'],
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'casual': '0 4px 20px rgba(196, 181, 253, 0.4)',
        'casual-lg': '0 8px 30px rgba(196, 181, 253, 0.5)',
        'glow-yellow': '0 0 20px rgba(254, 240, 138, 0.6)',
        'glow-purple': '0 0 30px rgba(196, 181, 253, 0.5)',
        'glow-pink': '0 0 20px rgba(251, 207, 232, 0.5)',
        'glow-mint': '0 0 20px rgba(167, 243, 208, 0.5)',
        'twitch': '0 2px 10px rgba(0, 0, 0, 0.1)',
        'twitch-lg': '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
      backgroundImage: {
        'gradient-casual': 'linear-gradient(135deg, #fbcfe8 0%, #c4b5fd 33%, #a5f3fc 66%, #a7f3d0 100%)',
        'gradient-easter': 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
        'gradient-tv': 'linear-gradient(180deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%)',
      },
    },
  },
  plugins: [],
}

