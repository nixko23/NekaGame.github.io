# SoundCloud Discovery

A modern music discovery web application built with React 19, TypeScript, and Vite. Browse tracks by genre, search by title and artist, manage favorites, and explore curated playlists.

## Features

### ✅ Implemented

- **Track Discovery** - Browse 6 sample tracks with genres, duration, and play counts
- **Search Functionality** - Real-time search by track title and artist name
- **Genre Filtering** - Filter tracks by 7 genres (All, Synthwave, Lo-Fi, House, Hip-Hop, Ambient, Indie)
- **Favorites Management** - Toggle favorite status with heart icon, view favorites count in navigation
- **Playlist Browser** - View 3 curated playlists with track previews
- **Tab Navigation** - Switch between Discover and Playlists views
- **Responsive Design** - Mobile-first layout with breakpoints at 768px
- **Accessible UI** - Semantic HTML, proper ARIA labels, keyboard-navigable elements
- **Modern Styling** - Purple gradient theme with smooth animations and hover effects

### Demo Data

All tracks and playlists in this version use mock data. These are not real SoundCloud tracks:
- Mock tracks: "Neon Dreams", "Lo-Fi Beats", "Deep House Sessions", "Hip-Hop Cipher", "Ambient Meditation", "Indie Folk Tales"
- Mock playlists: "Late Night Vibes", "Workout Pulse", "Chill Study Beats"
- Placeholder images from placeholder.com

## Tech Stack

- **React** 19.3.1 with TypeScript
- **Build Tool** Vite 8.3.5
- **Styling** CSS3 with flexbox and grid
- **Package Manager** npm
- **Linter** Oxlint
- **Type Checking** TypeScript (strict mode)

## Project Structure

```
src/
├── App.tsx                    # Main component with state management
├── App.css                    # Application styling (800+ lines)
├── index.css                  # Global styles and CSS reset
├── types.ts                   # TypeScript interfaces
├── main.tsx                   # React entry point
└── components/
    ├── SearchBar.tsx          # Search input with real-time filtering
    ├── TrackCard.tsx          # Individual track display
    ├── GenreFilter.tsx        # Genre filter buttons
    └── PlaylistView.tsx       # Playlist card component
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the development server at `http://localhost:5173` (or next available port).

### Build

```bash
npm run build
```

Creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Serves the production build for testing.

### Linting

```bash
npm run lint
```

Runs Oxlint to check code quality.

## Features Details

### Search

- **Real-time Search**: Type to search across track titles and artist names
- **Case-insensitive**: Searches work regardless of character case
- **Clear Button**: Quickly clear search to see all tracks
- **Debounced**: 500ms delay prevents excessive re-renders

### Genre Filtering

- **7 Genre Options**: All Genres, Synthwave, Lo-Fi, House, Hip-Hop, Ambient, Indie
- **Active State**: Currently selected genre is highlighted
- **Combines with Search**: Genre filter works in conjunction with search results

### Favorites

- **Toggle System**: Click heart icon to add/remove from favorites
- **Visual Feedback**: Heart changes from white to red when favorited
- **Counter Display**: Navigation shows active favorite count
- **Session-based**: Favorites reset on page refresh (no persistence)

### Playlists

- **Preview Cards**: Each playlist shows name, description, and track count
- **Track Preview**: First 3 tracks displayed in each playlist
- **Interactive Buttons**: Play button appears on hover (placeholder functionality)

### Responsive Design

- **Desktop**: Multi-column grid layout for tracks and playlists
- **Tablet**: 2-3 column layout with adjusted spacing
- **Mobile**: Single column with optimized touch targets
- **Navigation**: Responsive menu with proper spacing on all devices

### Accessibility

- **Semantic HTML**: Proper use of `<header>`, `<nav>`, `<main>`, `<footer>`
- **ARIA Labels**: Button titles describe actions ("Add to favorites", "Remove from favorites")
- **Focus States**: All interactive elements are keyboard-navigable
- **Image Alt Text**: All images have descriptive alt attributes
- **Color Contrast**: Text meets WCAG contrast requirements
- **Error States**: "No tracks found" message when search returns empty results

## Known Limitations

1. **Mock Data Only**: No real SoundCloud API integration yet
2. **No Audio Playback**: Play buttons are visual placeholders
3. **No Persistence**: Favorites are not saved between sessions
4. **No User Accounts**: No authentication or user profiles
5. **Placeholder Images**: All track/playlist images are from placeholder.com
6. **Limited Tracks**: Only 6 sample tracks in the current version

## Build Output

Production build is optimized:
- **CSS**: 6.58 KB (1.82 KB gzipped)
- **JavaScript**: 226.45 KB (70.68 KB gzipped)
- **Build Time**: ~110ms

## Next Steps

See [NEXT_STEPS.md](./NEXT_STEPS.md) for planned development stages, including API integration investigation and feature enhancements.

## License

MIT
