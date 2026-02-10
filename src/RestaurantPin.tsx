import type { Restaurant } from "./App";

interface RestaurantPinProps {
  restaurant: Restaurant;
  index: number;
}

const PIN_COLORS = [
  "bg-crunch-walnut-500",
  "bg-crunch-orange-500",
  "bg-crunch-mahogany-500",
  "bg-crunch-copper-500",
  "bg-crunch-khaki-500",
];

export function RestaurantPin({ restaurant, index }: RestaurantPinProps) {
  const pinColor = PIN_COLORS[index % PIN_COLORS.length];

  return (
    <div className="bg-white rounded-lg border border-crunch-walnut-200 shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Pin dot */}
      <div className="relative">
        <div
          className={`absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${pinColor} border-2 border-white shadow-sm z-10`}
        />
      </div>

      <div className="px-3 py-3 pt-4">
        <h4 className="font-display font-bold text-crunch-walnut-800 text-sm">
          {restaurant.name}
        </h4>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-crunch-khaki-600">
            {restaurant.cuisine}
          </span>
          <span className="text-crunch-walnut-300">|</span>
          <span className="text-xs text-crunch-khaki-600">
            {restaurant.neighborhood}
          </span>
          <span className="text-crunch-walnut-300">|</span>
          <span className="text-xs font-medium text-crunch-walnut-600">
            {restaurant.priceRange}
          </span>
        </div>
        {restaurant.reason && (
          <p className="text-xs text-crunch-khaki-600 mt-1.5 leading-relaxed italic">
            "{restaurant.reason}"
          </p>
        )}
      </div>
    </div>
  );
}
