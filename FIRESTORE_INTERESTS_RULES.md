# Firestore Security Rules for Interests Feature

This document describes the required Firestore security rules to properly secure the `interests` collection.

## Security Rules

Add the following rules to your `firestore.rules` file in the Firebase Console or your project:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Existing rules for messages collection...

    // Interests collection - user's areas of interest on the map
    match /interests/{interestId} {
      // Allow users to read only their own interests
      allow read: if request.auth != null &&
                     resource.data.userId == request.auth.uid;

      // Allow users to create interests with their own userId
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.keys().hasAll(['userId', 'coordinates', 'radius', 'createdAt', 'updatedAt']) &&
                       request.resource.data.radius >= 100 &&
                       request.resource.data.radius <= 1000;

      // Allow users to update only their own interests
      allow update: if request.auth != null &&
                       resource.data.userId == request.auth.uid &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.radius >= 100 &&
                       request.resource.data.radius <= 1000;

      // Allow users to delete only their own interests
      allow delete: if request.auth != null &&
                       resource.data.userId == request.auth.uid;
    }
  }
}
```

## Rule Explanation

### Read Access

- Users can only read interests where `userId` matches their authenticated user ID
- This ensures users only see their own interests, never those of other users

### Create Access

- User must be authenticated
- The `userId` field must match the authenticated user's ID
- All required fields must be present: `userId`, `coordinates`, `radius`, `createdAt`, `updatedAt`
- Radius must be between 100 and 1000 meters (enforced at database level as well as API level)

### Update Access

- User must be authenticated
- Both the existing and new data must have `userId` matching the authenticated user
- Radius constraints (100-1000m) are enforced
- Prevents users from changing ownership of interests

### Delete Access

- User must be authenticated
- Can only delete interests they own (where `userId` matches their ID)

## Testing Security Rules

To test these rules in the Firebase Console:

1. Go to Firestore Database > Rules
2. Click "Rules Playground"
3. Test scenarios:
   - Reading another user's interest (should be denied)
   - Creating an interest with someone else's userId (should be denied)
   - Creating an interest with radius < 100 or > 1000 (should be denied)
   - Updating another user's interest (should be denied)
   - Deleting another user's interest (should be denied)

## Deployment

To deploy these rules:

1. **Via Firebase Console:**

   - Go to Firebase Console > Firestore Database > Rules
   - Paste the rules above
   - Click "Publish"

2. **Via Firebase CLI:**
   ```bash
   firebase deploy --only firestore:rules
   ```

## Additional Considerations

### Indexes

You may want to create a composite index for efficient queries:

**Collection:** `interests`  
**Fields:**

- `userId` (Ascending)
- `createdAt` (Descending)

Firebase will usually prompt you to create this index when you first run a query. You can also create it manually in the Firebase Console under Firestore Database > Indexes.

### Data Validation

The API (`/app/api/interests/route.ts`) already validates:

- Radius constraints (100-1000m)
- Coordinate format
- User authentication
- Ownership for update/delete operations

The security rules provide an additional layer of protection at the database level.
