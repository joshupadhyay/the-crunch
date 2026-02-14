import type { Preference, Restaurant, startingPoint } from "./App";
import { StickyNote } from "./StickyNote";
import { RestaurantPin } from "./RestaurantPin";

interface CorkBoardProps {
  startingPlace?: startingPoint;
  preferences: Preference[];
  restaurants: Restaurant[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function CorkBoard({
  startingPlace,
  preferences,
  restaurants,
  isExpanded,
  onToggle,
}: CorkBoardProps) {
  const hasContent =
    !!startingPlace || preferences.length > 0 || restaurants.length > 0;

  return (
    <aside
      className="h-full bg-crunch-cork flex shrink-0 overflow-hidden"
      style={{
        width: isExpanded ? "320px" : "44px",
        transition: "width 350ms cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "inset 10px 0 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Collapsed tab */}
      {!isExpanded && (
        <button
          onClick={onToggle}
          className="w-[44px] h-full flex flex-col items-center pt-4 gap-3 cursor-pointer bg-crunch-mahogany-800 hover:bg-crunch-mahogany-700 transition-colors"
          aria-label="Expand The Board"
        >
          {/* Arrow icon pointing left (toward board opening) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-crunch-cream"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {/* Vertical text */}
          <span
            className="font-display text-xs font-bold text-crunch-cream tracking-widest uppercase"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            The Board
          </span>
          {/* Content indicator dot */}
          {hasContent && (
            <span className="w-2.5 h-2.5 rounded-full bg-crunch-orange-400 animate-pulse" />
          )}
        </button>
      )}

      {/* Expanded board content */}
      {isExpanded && (
        <div className="w-80 flex flex-col h-full">
          {/* Cork board header */}
          <div className="px-4 py-3 border-b-2 border-crunch-mahogany-700 bg-crunch-mahogany-800 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-crunch-cream tracking-wide">
                The Board
              </h2>
              <p className="text-crunch-walnut-200 text-xs mt-0.5">
                Your dining dossier
              </p>
            </div>
            <button
              onClick={onToggle}
              className="text-crunch-cream hover:text-white transition-colors cursor-pointer p-1"
              aria-label="Collapse The Board"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Cork texture area */}
          <div className="flex-1 overflow-y-auto p-4">
            {!hasContent ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-crunch-walnut-700 text-sm text-center italic px-4 leading-relaxed">
                  Start chatting and I'll pin your preferences and restaurant
                  picks here, dig?
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Starting place pin */}
                {startingPlace && (
                  <div>
                    <h3 className="text-xs font-semibold text-crunch-walnut-600 uppercase tracking-widest mb-2 px-1">
                      Starting Point
                    </h3>
                    <div className="bg-crunch-walnut-700 text-crunch-cream rounded-lg px-4 py-3 shadow-md">
                      <p className="font-display text-base font-bold">
                        {startingPlace.name}
                      </p>
                      <p className="text-crunch-walnut-200 text-xs mt-0.5">
                        {startingPlace.neighborhood}, {startingPlace.city}
                      </p>
                    </div>
                  </div>
                )}

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
        </div>
      )}
    </aside>
  );
}
