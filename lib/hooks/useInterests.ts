"use client";

import { useState, useEffect, useCallback } from "react";
import { Interest } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export function useInterests() {
  const { user } = useAuth();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth header
  const getAuthHeader = useCallback(async () => {
    if (!user) return null;
    const token = await user.getIdToken();
    return `Bearer ${token}`;
  }, [user]);

  // Fetch interests for the current user
  const fetchInterests = useCallback(async () => {
    if (!user) {
      setInterests([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const authHeader = await getAuthHeader();
      if (!authHeader) {
        console.warn("No auth header available, skipping interest fetch");
        setInterests([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/interests", {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch interests:", response.status, errorData);
        throw new Error(
          `Failed to fetch interests: ${response.status} - ${
            errorData.error || "Unknown error"
          }`
        );
      }

      const data = await response.json();
      const fetchedInterests = data.interests || [];

      // Check for duplicates from API
      const ids = fetchedInterests.map((i: Interest) => i.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error("[useInterests] API returned duplicate interests!", {
          total: ids.length,
          unique: uniqueIds.size,
        });
      }

      // Deduplicate by ID (defensive)
      const deduped = fetchedInterests.filter(
        (interest: Interest, index: number, self: Interest[]) =>
          index === self.findIndex((i) => i.id === interest.id)
      );

      if (deduped.length !== fetchedInterests.length) {
        console.warn(
          "[useInterests] Removed",
          fetchedInterests.length - deduped.length,
          "duplicate interests"
        );
      }

      setInterests(deduped);
    } catch (err) {
      console.error("Error fetching interests:", err);
      setError(err instanceof Error ? err.message : "Failed to load interests");
    } finally {
      setIsLoading(false);
    }
  }, [user, getAuthHeader]);

  // Add a new interest
  const addInterest = useCallback(
    async (coordinates: { lat: number; lng: number }, radius: number = 500) => {
      if (!user) {
        throw new Error("Must be logged in to add interests");
      }

      try {
        const authHeader = await getAuthHeader();
        if (!authHeader) {
          throw new Error("Failed to get auth token");
        }

        const response = await fetch("/api/interests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ coordinates, radius }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[addInterest] Failed:", response.status, errorData);
          throw new Error(
            `Failed to add interest: ${response.status} - ${
              errorData.error || "Unknown error"
            }`
          );
        }

        const data = await response.json();

        // Check if this interest already exists in the array (prevent duplicates)
        setInterests((prev) => {
          const exists = prev.some((i) => i.id === data.interest.id);
          if (exists) {
            return prev;
          }
          return [data.interest, ...prev];
        });

        return data.interest;
      } catch (err) {
        console.error("Error adding interest:", err);
        throw err;
      }
    },
    [user, getAuthHeader]
  );

  // Update an existing interest (move or change radius)
  const updateInterest = useCallback(
    async (
      id: string,
      updates: {
        coordinates?: { lat: number; lng: number };
        radius?: number;
      }
    ) => {
      if (!user) {
        throw new Error("Must be logged in to update interests");
      }

      try {
        const authHeader = await getAuthHeader();
        if (!authHeader) {
          throw new Error("Failed to get auth token");
        }

        const response = await fetch("/api/interests", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ id, ...updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update interest");
        }

        const data = await response.json();
        setInterests((prev) =>
          prev.map((interest) =>
            interest.id === id ? data.interest : interest
          )
        );
        return data.interest;
      } catch (err) {
        console.error("Error updating interest:", err);
        throw err;
      }
    },
    [user, getAuthHeader]
  );

  // Delete an interest
  const deleteInterest = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error("Must be logged in to delete interests");
      }

      try {
        const authHeader = await getAuthHeader();
        if (!authHeader) {
          throw new Error("Failed to get auth token");
        }

        const response = await fetch(`/api/interests?id=${id}`, {
          method: "DELETE",
          headers: {
            Authorization: authHeader,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[deleteInterest] Failed:", response.status, errorData);
          throw new Error(
            `Failed to delete interest: ${response.status} - ${
              errorData.error || "Unknown error"
            }`
          );
        }

        setInterests((prev) => prev.filter((interest) => interest.id !== id));
      } catch (err) {
        console.error("Error deleting interest:", err);
        throw err;
      }
    },
    [user, getAuthHeader]
  );

  // Fetch interests when user logs in
  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  return {
    interests,
    isLoading,
    error,
    addInterest,
    updateInterest,
    deleteInterest,
    refreshInterests: fetchInterests,
  };
}
