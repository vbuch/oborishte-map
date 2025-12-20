import { Suspense } from "react";
import HomeContent from "@/components/HomeContent";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Зареждане...</p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
