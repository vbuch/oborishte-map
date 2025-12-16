# User Interests Feature - Implementation Guide

## Overview

This feature allows authenticated users to mark areas of interest on the map by placing circular regions. Users can:

- **Add** interests with a customizable radius (100m - 1000m)
- **View** their interests as semi-transparent circles on the map
- **Move** existing interests to new locations
- **Delete** interests they no longer need

Interests are **private** - users only see their own interests, never those of other users.

## User Experience

### Adding an Interest

1. User logs in via Google authentication
2. Clicks "МОИ ИНТЕРЕСИ" (My Interests) button in the header
3. Map enters "target mode":
   - Crosshair appears in the center of the viewport
   - Preview circle shows the selected radius
   - Zoom controls are disabled (drag only)
   - Control panel appears at the bottom with:
     - Coordinate display
     - Radius slider (100m - 1000m)
     - Cancel and Save buttons
4. User drags the map to position the crosshair over desired location
5. Optionally adjusts the radius using the slider
6. Clicks "Save Location"
7. Interest is saved and appears as a circle on the map

### Viewing Interests

- Interests appear automatically when user is logged in
- Shown as semi-transparent blue circles (15% opacity)
- Hover over a circle increases opacity to 18%
- Color matches the Oborishte logo: `#1976D2`

### Moving an Interest

1. Click on an existing interest circle
2. Context menu appears with "Move" and "Delete" options
3. Click "Move"
4. Map centers on the interest and enters target mode
5. Original circle disappears (only crosshair + preview visible)
6. User repositions and clicks "Save Location"
7. Interest updates to new location

### Deleting an Interest

1. Click on an interest circle
2. Context menu appears
3. Click "Delete"
4. Interest is immediately removed (no confirmation)

## Technical Architecture

### Components

#### 1. **InterestCircles** (`components/InterestCircles.tsx`)

- Renders all user interests as `<Circle>` components from Google Maps API
- Handles hover states for opacity changes
- Filters out interests being edited
- Triggers click handler for context menu

#### 2. **InterestTargetMode** (`components/InterestTargetMode.tsx`)

- Displays crosshair overlay (fixed center of viewport)
- Shows preview circle that follows map center
- Provides radius slider control (100m - 1000m)
- Displays current coordinates
- Handles save/cancel actions

#### 3. **MapComponent** (`components/MapComponent.tsx`)

- Updated to accept `interests`, `onInterestClick`, and `targetMode` props
- Conditionally disables zoom when in target mode
- Renders both interest circles and target mode overlay

#### 4. **HomeContent** (`components/HomeContent.tsx`)

- Main orchestrator for interest management
- Uses `useInterests` hook for CRUD operations
- Manages target mode state
- Handles interest context menu
- Coordinates between map and user actions

#### 5. **Header** (`components/Header.tsx`)

- Shows "МОИ ИНТЕРЕСИ" button when user is logged in
- Triggers interest addition via global callback

### Hooks

#### **useInterests** (`lib/hooks/useInterests.ts`)

Custom hook providing:

- `interests`: Array of user's interests
- `isLoading`: Loading state
- `error`: Error message if any
- `addInterest(coordinates, radius)`: Create new interest
- `updateInterest(id, { coordinates, radius })`: Update existing interest
- `deleteInterest(id)`: Delete an interest
- `refreshInterests()`: Re-fetch from server

Auto-fetches interests when user logs in.

### API Routes

#### **GET /api/interests**

- Fetches all interests for authenticated user
- Requires `Authorization: Bearer <token>` header
- Returns: `{ interests: Interest[] }`

#### **POST /api/interests**

- Creates new interest
- Body: `{ coordinates: { lat, lng }, radius: number }`
- Returns: `{ interest: Interest }`

#### **PATCH /api/interests**

- Updates existing interest
- Body: `{ id: string, coordinates?: { lat, lng }, radius?: number }`
- Returns: `{ interest: Interest }`

#### **DELETE /api/interests?id=<interestId>**

- Deletes an interest
- Requires interest ID as query parameter
- Returns: `{ success: true }`

All endpoints require Firebase authentication and enforce ownership checks.

### Data Model

```typescript
interface Interest {
  id?: string;
  userId: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radius: number; // meters (100-1000)
  createdAt: Date | string;
  updatedAt: Date | string;
}
```

### Firestore Collection

**Collection:** `interests`

**Document Structure:**

```json
{
  "userId": "firebase-user-id",
  "coordinates": {
    "lat": 42.6977,
    "lng": 23.3341
  },
  "radius": 500,
  "createdAt": "2025-12-16T10:30:00Z",
  "updatedAt": "2025-12-16T10:30:00Z"
}
```

**Security Rules:** See `FIRESTORE_INTERESTS_RULES.md`

## Design Specifications

### Colors

- **Circle Fill**: `#1976D2` (Oborishte logo blue)
- **Circle Opacity**: 15% (normal), 18% (hover)
- **Crosshair**: Red (`#EF4444` / `red-500`)

### Constraints

- **Minimum Radius**: 100 meters
- **Maximum Radius**: 1000 meters
- **Default Radius**: 500 meters

### UI Elements

- **Crosshair**: Fixed center overlay with:
  - Horizontal line: 48px width, 2px height
  - Vertical line: 2px width, 48px height
  - Center dot: 8px diameter
  - Color: Red with shadow
- **Control Panel** (target mode):

  - White background with shadow
  - Rounded corners
  - Coordinate display (monospace font)
  - Radius slider
  - Cancel + Save buttons

- **Context Menu**:
  - White background with shadow
  - Two options: Move (with icon), Delete (red text with icon)
  - Semi-transparent backdrop

## Setup Instructions

### 1. Install Dependencies

All required dependencies are already in `package.json`:

- `@react-google-maps/api` - For Circle component
- `firebase` - Client SDK
- `firebase-admin` - Server SDK

### 2. Configure Firestore Security Rules

Follow instructions in `FIRESTORE_INTERESTS_RULES.md` to add security rules for the `interests` collection.

### 3. Create Firestore Index

Firebase will prompt you to create this index on first query, or create manually:

**Collection:** `interests`  
**Fields:**

- `userId` (Ascending)
- `createdAt` (Descending)

### 4. Environment Variables

Ensure these are set in `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

## Testing Checklist

- [ ] User can log in with Google
- [ ] "МОИ ИНТЕРЕСИ" button appears after login
- [ ] Clicking button activates target mode
- [ ] Crosshair appears in center
- [ ] Preview circle follows map drag
- [ ] Radius slider works (100m - 1000m)
- [ ] Save creates new interest
- [ ] Interest appears on map as circle
- [ ] Circle hover increases opacity
- [ ] Clicking circle shows context menu
- [ ] Move option re-enters target mode
- [ ] Original circle disappears during edit
- [ ] Save updates interest location
- [ ] Delete removes interest immediately
- [ ] Interests persist after logout/login
- [ ] Other users cannot see your interests
- [ ] Mobile: Touch interactions work
- [ ] Mobile: UI is responsive

## Known Limitations

1. **No interest sharing**: Interests are strictly private, no collaboration features
2. **No notifications**: Interests are purely visual markers (notification system planned for future)
3. **No labels**: Interests don't have names or descriptions
4. **Single map instance**: Interests tied to the main map view only

## Future Enhancements

1. **Interest Labels**: Allow users to name their interests
2. **Notifications**: Alert users when new messages appear in their interest areas
3. **Color Coding**: Let users choose different colors for different interests
4. **Interest Groups**: Organize interests into categories
5. **Export/Import**: Share interest configurations
6. **Analytics**: Show statistics about activity in interest areas

## Troubleshooting

### Interests not appearing

- Check browser console for errors
- Verify user is logged in
- Check Firestore security rules are deployed
- Verify `interests` collection exists

### Cannot save interest

- Check authentication token is valid
- Verify radius is between 100-1000m
- Check browser console for API errors
- Verify Firestore index is created

### Target mode not activating

- Check that user is logged in
- Verify Header button is visible
- Check browser console for JavaScript errors

## File Summary

**New Files Created:**

- `app/api/interests/route.ts` - API endpoints
- `lib/hooks/useInterests.ts` - Interest management hook
- `components/InterestCircles.tsx` - Circle renderer
- `components/InterestTargetMode.tsx` - Target placement UI
- `FIRESTORE_INTERESTS_RULES.md` - Security rules documentation
- `INTERESTS_FEATURE.md` - This file

**Modified Files:**

- `lib/types.ts` - Added Interest interface
- `components/MapComponent.tsx` - Interest integration
- `components/HomeContent.tsx` - State management
- `components/Header.tsx` - Add Interest button
- `components/ClientLayout.tsx` - Wire up header callback

## Support

For issues or questions, check:

1. Browser console for errors
2. Firebase Console > Firestore for data
3. Firebase Console > Authentication for user status
4. Network tab for API request/response details
