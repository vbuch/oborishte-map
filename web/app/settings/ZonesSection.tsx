"use client";

import { Interest } from "@/lib/types";
import EmptyZonesMessage from "./EmptyZonesMessage";
import ZoneCard from "./ZoneCard";

interface ZonesSectionProps {
  readonly interests: Interest[];
}

export default function ZonesSection({ interests }: ZonesSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow mb-6 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Зони на интерес
      </h2>

      {!interests || interests.length === 0 ? (
        <EmptyZonesMessage />
      ) : (
        <div className="space-y-2">
          {interests.map((interest) => (
            <ZoneCard key={interest.id} interest={interest} />
          ))}
        </div>
      )}
    </section>
  );
}
