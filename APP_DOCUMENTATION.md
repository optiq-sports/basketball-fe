# Basketball Management Frontend - Complete Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Features](#core-features)
5. [Authentication Flow](#authentication-flow)
6. [Pages and Routes](#pages-and-routes)
7. [Components](#components)
8. [State Management](#state-management)
9. [Styling](#styling)
10. [Configuration](#configuration)
11. [Build and Deployment](#build-and-deployment)

---

## Project Overview

**Basketball Management Frontend** is a comprehensive React-based administration dashboard for managing basketball tournaments, teams, matches, players, and statisticians. The application is built with modern technologies and provides an intuitive interface for tournament administrators to track games, manage scores, and analyze player statistics.

### Key Purpose
- Manage basketball tournaments and competitions
- Track teams, players, and match scores
- View real-time game statistics
- Manage statisticians
- Upload and manage tournament data (teams, players, officials)
- Generate shot charts and detailed analytics

---

## Technology Stack

### Frontend Framework & Libraries
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | ^19.1.1 | Core UI library |
| **React Router DOM** | ^7.9.3 | Client-side routing |
| **Vite** | ^7.1.7 | Build tool & dev server |
| **React Query (@tanstack/react-query)** | ^5.90.2 | Server state management & caching |
| **React Query DevTools** | ^5.90.2 | React Query debugging |

### UI & Icons
| Package | Version | Purpose |
|---------|---------|---------|
| **Tailwind CSS** | ^4.1.14 | Utility-first CSS framework |
| **PostCSS** | ^8.5.6 | CSS transformation |
| **Autoprefixer** | ^10.4.21 | CSS vendor prefixing |
| **React Icons** | ^5.5.0 | Icon library (FiSearch, FiBell, etc.) |
| **FontAwesome** | ^7.1.0 | Additional icon set |

### Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| **TypeScript** | ^19.1.16 | Type safety (via @types/react) |
| **ESLint** | ^9.36.0 | Code linting |
| **ESLint React Hooks Plugin** | ^5.2.0 | React hooks linting rules |

---

## Project Structure

```
basketball-fe/
├── public/                    # Static assets
│   ├── logo.png
│   ├── ball1.png
│   ├── ball2.png
│   ├── player1.png
│   ├── player2.png
│   └── stat.png
├── src/
│   ├── main.jsx              # Application entry point
│   ├── App.jsx               # Root component with BrowserRouter
│   ├── routes.tsx            # Route definitions and ProtectedRoute
│   ├── config.ts             # Configuration file (empty)
│   ├── index.css             # Global styles
│   ├── App.css               # App-specific styles
│   │
│   ├── components/           # Reusable components
│   │   ├── navbar.tsx        # Top navigation bar
│   │   ├── sidbar.tsx        # Sidebar navigation
│   │   └── wrapper.tsx       # Layout wrapper with routes
│   │
│   ├── pages/                # Page components (by feature)
│   │   ├── login/
│   │   │   ├── login.tsx     # Login page
│   │   │   └── ForgotPassword.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── dashboard.tsx # Main dashboard with ongoing/upcoming games
│   │   │
│   │   ├── StartNew/         # Tournament creation flow
│   │   │   ├── StartNew.tsx  # Competition setup
│   │   │   ├── Teams.tsx     # Team configuration
│   │   │   ├── Players.tsx   # Player management
│   │   │   ├── TeamOverview.tsx
│   │   │   ├── Complete.tsx  # Completion step
│   │   │   └── FileUploadBox.tsx
│   │   │   └── PlayerImageUploadBox.tsx
│   │   │
│   │   ├── tournaments/      # Tournament management
│   │   │   ├── TournamentsListing.tsx # List all tournaments
│   │   │   ├── Tournaments.tsx        # Tournament detail page
│   │   │   ├── Match.tsx             # Match scoring interface
│   │   │   ├── PlayerDetails.tsx     # Player statistics detail
│   │   │   ├── Fixtures.tsx          # Fixture display
│   │   │   ├── Schedules.tsx         # Schedule view
│   │   │   ├── PendingGames.tsx      # Pending match list
│   │   │   └── ShotChart.tsx         # Shot chart visualization
│   │   │
│   │   ├── results/
│   │   │   └── result.tsx    # Match results listing
│   │   │
│   │   └── Statisticians/
│   │       ├── Statisticians.tsx # List statisticians
│   │       └── viewStat.tsx      # Statistician detail view
│   │
│   ├── service/             # API service layer (empty - ready for backend integration)
│   │
│   └── assets/              # Static assets (images, fonts, etc.)
│
├── index.html               # HTML entry point
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── eslint.config.js        # ESLint configuration
├── package.json            # Project metadata & dependencies
└── README.md               # Basic project README
```

---

## Core Features

### 1. **Authentication System**
- Login with email/password
- OAuth integration (Google, Apple)
- Forgot password recovery
- Protected routes with localStorage-based authentication
- Session management

### 2. **Dashboard**
- Welcome message with user greeting
- Real-time ongoing game display
- Up Next games carousel with navigation
- Recent games history
- Quick action to start new tournament
- Upcoming tournaments listing

### 3. **Tournament Management**
- Create new tournaments (StartNew workflow)
- View all tournaments
- Detailed tournament pages with:
  - Match standings
  - Team statistics
  - Game schedules
  - Fixtures
  - Pending games
  - Tournament leaders display

### 4. **Match Scoring**
- Real-time score tracking
- Quarter-by-quarter scoring display
- Player statistics tracking (Points, Rebounds, Assists, Blocks, Steals)
- Shot chart visualization with quarter filtering
- Player performance analysis
- Box score view

### 5. **Team Management**
- Create and configure teams
- Team color selection
- Coaching staff management
- Country and state selection
- Team logo upload
- Unique team codes (short & long)

### 6. **Player Management**
- Add players to teams
- Player jersey number assignment
- Player image uploads
- Player statistics tracking
- Player detail views with full analytics

### 7. **Statistician Management**
- Register and manage statisticians
- Statistician profiles with bio, DOB, location
- Photo uploads
- Search and filter functionality
- Statistician detail views

### 8. **Results & Analytics**
- Match result history
- Date-based filtering
- Search functionality
- Detailed match information
- Team comparison metrics

---

## Authentication Flow

### Login Flow
```
User → Login Page → Email/Password or OAuth → localStorage['isAuthenticated'] = 'true' 
→ Redirect to Dashboard
```

### Protected Routes
```typescript
// ProtectedRoute Component
const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
return isAuthenticated ? children : <Navigate to="/login" />
```

### Public Routes
- `/login` - Login page
- `/forgot-password` - Password recovery

### Protected Routes
All routes except login are protected and wrapped with `ProtectedRoute` component inside `Wrapper`.

---

## Pages and Routes

### Route Structure (in wrapper.tsx)

| Path | Component | Purpose |
|------|-----------|---------|
| `/login` | Login | User authentication |
| `/forgot-password` | ForgotPassword | Password recovery |
| `/dashboard` | Dashboard | Main dashboard view |
| `/start-new` | StartNew | Tournament creation (step 1) |
| `/teams` | Teams | Team setup (step 2) |
| `/players` | Players | Player management (step 3) |
| `/team-overview` | TeamOverview | Overview before completion (step 4) |
| `/complete` | Complete | Final completion step (step 5) |
| `/tournaments` | TournamentsListing | All tournaments |
| `/tournaments/:id` | Tournaments | Tournament details |
| `/tournaments/:id/fixtures` | Fixtures | Tournament fixtures |
| `/tournaments/:id/schedules` | Schedules | Match schedules |
| `/tournaments/:id/match/:matchId/pending` | PendingGames | Pending matches |
| `/tournaments/:id/match/:matchId/shotchart` | ShotChart | Shot chart visualization |
| `/tournaments/:id/match/:matchId` | Match | Match scoring interface |
| `/tournaments/:id/match/:matchId/player/:playerId` | PlayerDetails | Player statistics |
| `/results` | Results | Match results |
| `/statisticians` | Statisticians | Statistician list |
| `/statisticians/:id` | ViewStat | Statistician detail |

---

## Components

### 1. **Navbar** (`src/components/navbar.tsx`)
**Purpose**: Top navigation bar across all pages

**Props**:
```typescript
interface NavbarProps {
  onMenuClick?: () => void;        // Mobile menu toggle
  userName?: string;                // Current user name
  userRole?: string;                // User role (Administrator, etc.)
}
```

**Features**:
- User profile display with avatar
- Search bar (desktop only)
- Notifications button with badge
- Settings button
- Responsive mobile menu button
- Light gray background (#F8F8F8)

---

### 2. **Sidebar** (`src/components/sidbar.tsx`)
**Purpose**: Left navigation menu

**Props**:
```typescript
interface SidebarProps {
  activeItem?: string;              // Currently active menu item
  onNavigate?: () => void;          // Callback after navigation
}
```

**Menu Items**:
- Dashboard (BiHome icon)
- Start New (FiPlusCircle icon)
- Tournaments (MdSportsBasketball icon)
- Results (MdLeaderboard icon)
- Statisticians (HiUsers icon)
- Logout (FiLogOut icon)

**Features**:
- Active item highlighting
- Responsive (fixed on mobile, static on desktop)
- Smooth transitions
- Logout functionality

---

### 3. **Wrapper** (`src/components/wrapper.tsx`)
**Purpose**: Main layout container with sidebar and content area

**Features**:
- Manages sidebar open/close state
- Determines active menu item based on route
- Provides responsive layout
- Mobile overlay for sidebar
- Houses all protected route definitions

**State**:
- `isSidebarOpen`: boolean

---

## State Management

### Data Flow Architecture

```
React Query (Server State)
↓
Component useState (Local State)
↓
LocalStorage (Persistence)
```

### React Query Configuration
```typescript
// src/main.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      retry: 1,                    // Retry failed requests once
    },
  },
})
```

### Local Component State Examples
1. **Dashboard**: Game carousel position, slide navigation
2. **Match**: Quarter selection, player filters, team selection
3. **Forms**: Input values in StartNew flow
4. **Filters**: Date, search, category filters in Results/Statisticians

### Storage
- **localStorage**: `isAuthenticated` flag for session management

---

## Styling

### Tailwind CSS
The project uses **Tailwind CSS v4** with:
- Utility-first CSS approach
- Custom animations (fade-in)
- Responsive design with breakpoints (sm, md, lg, xl, 2xl)
- Custom color scheme (blues, grays, accent colors)

### Color Palette
- **Primary**: Blue (#0066CC, #21409A)
- **Background**: Light gray (#F8F8F8, #F5FCFF)
- **Text**: Dark gray (#1F2937, #6B7280)
- **Team Colors**: Yellow (#FFCA69), Blue (#80B7D5), Green (#7FD99A)
- **Status**: Green (#6AE36F), Red (#FF4444)

### Custom Animations
```javascript
// tailwind.config.js
keyframes: {
  'fade-in': {
    '0%': { opacity: 0, transform: 'scale(0.95)' },
    '100%': { opacity: 1, transform: 'scale(1)' },
  },
}
```

### Key Styling Features
- Responsive grid layouts (`grid-cols-1 lg:grid-cols-2`)
- Flexbox for alignment
- Rounded corners (lg, xl variants)
- Shadows for depth (shadow-sm, shadow-md)
- Transition effects (transition-all, duration-300)
- Border styling (border-gray-200)
- Overflow handling (overflow-hidden, overflow-y-auto)

---

## Configuration

### Vite Configuration (`vite.config.js`)
```javascript
export default defineConfig({
  plugins: [react()],
})
```

### Tailwind Configuration (`tailwind.config.js`)
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: { /* ... */ },
      animation: { /* ... */ },
    },
  },
  plugins: [],
}
```

### PostCSS Configuration (`postcss.config.js`)
Handles Tailwind CSS processing and autoprefixing.

### ESLint Configuration (`eslint.config.js`)
- ESLint recommended rules
- React hooks linting
- React refresh compatibility

### Empty Configuration File
- `config.ts` - Ready for environment variables or API configuration

---

## Build and Deployment

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (Vite HMR enabled) |
| `npm run build` | Build for production (optimized bundle) |
| `npm run lint` | Run ESLint checks |
| `npm run preview` | Preview production build locally |

### Development Server
```bash
npm run dev
# Starts on http://localhost:5173 with Hot Module Replacement
```

### Production Build
```bash
npm run build
# Creates optimized dist/ folder
```

### Build Output
- Minified JavaScript/CSS
- Code splitting for optimal loading
- Asset optimization
- Source maps for debugging

---

## Key UI Patterns

### 1. **Card-Based Layout**
Most content uses white cards with shadows for visual hierarchy:
```jsx
<div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md">
  {/* Content */}
</div>
```

### 2. **Form Patterns**
- Input fields with labels
- Dropdown selections
- File uploads
- Color pickers for team colors

### 3. **Table/List Patterns**
- Grid layouts for responsive display
- Pagination support
- Search and filter functionality
- Hover effects for interactivity

### 4. **Modal Patterns**
- Modal dialogs for forms
- Overlay backgrounds
- Close buttons

### 5. **Navigation Patterns**
- Breadcrumbs for hierarchy
- Tab navigation
- Carousel navigation

---

## Data Models

### Tournament
```typescript
{
  id: number;
  name: string;
  shortName?: string;
  division: string;
  numberOfGames: number;
  numberOfQuarters: number;
  quarterDuration: string;
  overtimeDuration: string;
  date: string;
  time: string;
  court: string;
  country: string;
  state: string;
  flyer?: File;
}
```

### Team
```typescript
{
  id: number;
  name: string;
  shortName: string;
  shortTeamCode: string;
  longTeamCode: string;
  teamColor: string;
  country: string;
  state: string;
  logo?: File;
  coachingStaff: CoachingStaff[];
}
```

### Player
```typescript
{
  id: number;
  name: string;
  surname: string;
  number: string;
  image?: string;
  points: number;
  team: string;
}
```

### Match
```typescript
{
  id: number;
  teamA: string;
  teamAColor: string;
  teamB: string;
  teamBColor: string;
  venue: string;
  time: string;
  hasStarted: boolean;
}
```

### Statistician
```typescript
{
  id: number;
  name: string;
  surname: string;
  location: string;
  bio?: string;
  dob?: string;
  phone?: string;
  email?: string;
  image?: string;
}
```

---

## API Integration Points

### Service Layer Location
- `src/service/` - Ready for API integration

### Planned Integration Points
1. **Authentication**: Login, logout, password reset
2. **Tournaments**: CRUD operations
3. **Teams**: Team management and coaching staff
4. **Players**: Player management and statistics
5. **Matches**: Match creation, score updates
6. **Results**: Fetch and display results
7. **Statisticians**: CRUD operations

### Current State
- Forms capture data and use `navigate()` for workflow
- Data is mostly mocked
- Ready for backend API integration via React Query

---

## Performance Considerations

### Optimization Strategies
1. **React Query**: Server state management with caching
2. **Code Splitting**: Vite handles dynamic imports
3. **Image Optimization**: Consider using image CDN
4. **Lazy Loading**: Routes can be lazy-loaded
5. **Memoization**: Use `React.memo()` for expensive components

### Current Performance
- HMR (Hot Module Replacement) in development
- Fast build times with Vite
- Small bundle with tree-shaking

---

## Future Enhancements

### Recommended Additions
1. **Real Backend Integration**
   - Connect to REST/GraphQL API
   - Implement proper authentication
   - Use React Query mutations for data updates

2. **Features to Add**
   - Team roster management
   - Player image gallery
   - Live match notifications
   - PDF report generation
   - Video replay uploads

3. **Testing**
   - Unit tests with Vitest
   - Integration tests with Testing Library
   - E2E tests with Cypress/Playwright

4. **PWA Features**
   - Service worker
   - Offline support
   - App manifest

5. **Analytics**
   - User behavior tracking
   - Match analytics dashboard
   - Performance metrics

---

## File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| Match.tsx | 1414 | Largest file - match scoring interface |
| StartNew.tsx | 343 | Tournament creation |
| Statisticians.tsx | 357 | Statistician management |
| Tournaments.tsx | 346 | Tournament detail page |
| dashboard.tsx | 327 | Dashboard |
| Teams.tsx | 402 | Team setup |
| Results.tsx | 353 | Results listing |

---

## Troubleshooting

### Common Issues & Solutions

**Issue**: Routes not working
- Check `localStorage.getItem('isAuthenticated')`
- Verify routes are defined in `wrapper.tsx`

**Issue**: Styles not applying
- Ensure Tailwind classes are spelled correctly
- Check `tailwind.config.js` content paths
- Clear cache: `npm run build`

**Issue**: Images not loading
- Check image paths in `public/` folder
- Verify image filenames match src attributes

**Issue**: Mobile layout breaking
- Test with browser devtools
- Check responsive breakpoints (sm, md, lg)
- Adjust Tailwind grid/flex classes

---

## Contact & Support

For questions about the codebase:
1. Review this documentation
2. Check component PropTypes/TypeScript interfaces
3. Examine similar implementations in the codebase
4. Run `npm run lint` to catch issues

---

**Last Updated**: January 2025
**Version**: 1.0.0
**License**: [Your License Here]
