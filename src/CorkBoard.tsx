import type { Preference, Restaurant } from "./App";
import { StickyNote } from "./StickyNote";
import { RestaurantPin } from "./RestaurantPin";

interface CorkBoardProps {
  preferences: Preference[];
  restaurants: Restaurant[];
}

export function CorkBoard({ preferences, restaurants }: CorkBoardProps) {
  const hasContent = preferences.length > 0 || restaurants.length > 0;

  return (
    <aside className="w-80 h-full border-l-2 border-crunch-walnut-300 bg-crunch-cork flex flex-col overflow-hidden shrink-0">
      {/* Cork board header */}
      <div className="px-4 py-3 border-b-2 border-crunch-walnut-300 bg-crunch-walnut-800">
        <h2 className="font-display text-lg font-bold text-crunch-cream tracking-wide">
          The Board
        </h2>
        <p className="text-crunch-walnut-200 text-xs mt-0.5">
          Your dining dossier
        </p>
      </div>

      {/* Cork texture area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasContent ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-crunch-walnut-500 text-sm text-center italic px-4 leading-relaxed">
              Start chatting and I'll pin your preferences and restaurant picks
              here, dig?
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sticky notes for preferences */}
            {preferences.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-crunch-walnut-600 uppercase tracking-widest mb-2 px-1">
                  Your Vibe
                </h3>
                <div className="flex flex-wrap gap-2">
                  {preferences.map((pref, i) => (
                    <StickyNote
                      key={`${pref.label}-${i}`}
                      label={pref.label}
                      value={pref.value}
                      colorIndex={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Restaurant pins */}
            {restaurants.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-crunch-walnut-600 uppercase tracking-widest mb-2 px-1">
                  Pinned Spots
                </h3>
                <div className="flex flex-col gap-2">
                  {restaurants.map((restaurant, i) => (
                    <RestaurantPin
                      key={restaurant.name}
                      restaurant={restaurant}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
