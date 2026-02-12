import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

// Restaurant search tool definition for Claude's tool use
export const TOOLS: Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for real-time restaurant details, reviews, hours, and neighborhood info. Use when the user wants to verify specifics about a restaurant or needs current information not in the local database. Use also for guides / reviews that recommend this place to give the user character. Requires EXA_API_KEY.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurant_name: {
          type: "string",
          description:
            "Name of a specific restaurant to look up (e.g., 'L\\'Artusi', 'Dhamaka')",
        },
        location: {
          type: "string",
          description:
            "Neighborhood or area to narrow the search (e.g., 'West Village', 'Lower East Side', 'NYC')",
        },
        query: {
          type: "string",
          description:
            "Free-form search for broader discovery like curated lists, neighborhood guides, or cuisine roundups (e.g., 'best new restaurants Lower East Side 2025', 'Eater NY date night guide')",
        },
        info_type: {
          type: "string",
          enum: ["reviews", "hours", "neighborhood", "general"],
          description:
            "What kind of information to focus on. Defaults to general.",
        },
      },
    },
  },
  {
    name: "search_opentable",
    description:
      "Search OpenTable for real-time restaurant data including availability, reviews, and ratings. Use this when the user wants live booking info and availability. Requires APIFY_API_TOKEN to be configured.",
    input_schema: {
      type: "object" as const,
      properties: {
        location: {
          type: "string",
          description:
            "Location to search (e.g., 'New York', 'Manhattan', 'Brooklyn')",
        },
        date: {
          type: "string",
          description: "Date for availability in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "Time for reservation (e.g., '7:00 PM', '19:00')",
        },
        covers: {
          type: "number",
          description: "Party size (number of guests). Defaults to 2.",
        },
      },
      required: ["location"],
    },
  },
];

// Simulated restaurant database - in a real app this would hit external APIs
// This gives Claude realistic data to work with
const RESTAURANT_DB = [
  {
    name: "L'Artusi",
    cuisine: "Italian",
    neighborhood: "West Village",
    priceRange: "$$$",
    vibe: "romantic, intimate",
    rating: 4.6,
    description:
      "Sophisticated Italian with handmade pastas and an excellent wine list. The upstairs dining room is perfect for date night.",
    highlights: ["Handmade pasta", "Wine bar downstairs", "Seasonal menu"],
    dietary: ["vegetarian-friendly", "gluten-free options"],
  },
  {
    name: "Via Carota",
    cuisine: "Italian",
    neighborhood: "West Village",
    priceRange: "$$$",
    vibe: "charming, rustic",
    rating: 4.7,
    description:
      "Farm-to-table Italian with a rustic, garden-inspired atmosphere. No reservations — worth the wait.",
    highlights: ["Farm-to-table", "Insalata verde", "Cash only upstairs"],
    dietary: ["vegetarian-friendly"],
  },
  {
    name: "Sushi Nakazawa",
    cuisine: "Japanese",
    neighborhood: "West Village",
    priceRange: "$$$$",
    vibe: "intimate, refined",
    rating: 4.8,
    description:
      "Omakase experience from a Jiro Dreams of Sushi alum. The 20-course tasting at the bar is unforgettable.",
    highlights: ["Omakase", "Counter seating", "Jiro lineage"],
    dietary: ["pescatarian"],
  },
  {
    name: "Tatiana",
    cuisine: "Caribbean-American",
    neighborhood: "Lincoln Center",
    priceRange: "$$$",
    vibe: "lively, celebratory",
    rating: 4.5,
    description:
      "Chef Kwame Onwuachi's vibrant restaurant blending Afro-Caribbean and American flavors. A celebration on a plate.",
    highlights: [
      "James Beard winner",
      "Tasting menu available",
      "Live music nights",
    ],
    dietary: ["gluten-free options"],
  },
  {
    name: "Lilia",
    cuisine: "Italian",
    neighborhood: "Williamsburg",
    priceRange: "$$$",
    vibe: "trendy, lively",
    rating: 4.6,
    description:
      "Missy Robbins' pasta temple in a converted auto body shop. The mafaldini with pink peppercorn is iconic.",
    highlights: ["Mafaldini", "Industrial-chic space", "Excellent cocktails"],
    dietary: ["vegetarian-friendly"],
  },
  {
    name: "Peter Luger Steak House",
    cuisine: "Steakhouse",
    neighborhood: "Williamsburg",
    priceRange: "$$$$",
    vibe: "classic, no-frills",
    rating: 4.4,
    description:
      "The legendary Brooklyn steakhouse since 1887. Porterhouse for two, creamed spinach, cash only. An institution.",
    highlights: ["Porterhouse for two", "Cash only", "Old-school service"],
    dietary: [],
  },
  {
    name: "Le Bernardin",
    cuisine: "French",
    neighborhood: "Midtown",
    priceRange: "$$$$",
    vibe: "elegant, refined",
    rating: 4.9,
    description:
      "Eric Ripert's three-Michelin-star seafood temple. Tasting menu is a masterclass in fish cookery.",
    highlights: ["3 Michelin stars", "Tasting menu", "Impeccable service"],
    dietary: ["pescatarian", "gluten-free options"],
  },
  {
    name: "Los Tacos No. 1",
    cuisine: "Mexican",
    neighborhood: "Chelsea",
    priceRange: "$",
    vibe: "casual, quick",
    rating: 4.5,
    description:
      "The best tacos in Manhattan, bar none. Adobada and nopal tacos are must-orders. Always a line, always worth it.",
    highlights: ["Adobada tacos", "Nopal tacos", "Fast casual"],
    dietary: ["vegetarian options"],
  },
  {
    name: "Dhamaka",
    cuisine: "Indian",
    neighborhood: "Lower East Side",
    priceRange: "$$",
    vibe: "bold, adventurous",
    rating: 4.6,
    description:
      "Boundary-pushing Indian cuisine that goes beyond tikka masala. Rabbit seekh kebab and goat neck biryani are revelations.",
    highlights: ["Adventurous menu", "Goat neck biryani", "Small plates"],
    dietary: ["vegetarian-friendly", "halal"],
  },
  {
    name: "Atomix",
    cuisine: "Korean",
    neighborhood: "NoMad",
    priceRange: "$$$$",
    vibe: "intimate, refined",
    rating: 4.9,
    description:
      "Two-Michelin-star Korean tasting menu in an intimate setting. Each course tells a story. Reservations drop monthly.",
    highlights: [
      "2 Michelin stars",
      "Tasting menu",
      "Intimate 14-seat counter",
    ],
    dietary: ["gluten-free options"],
  },
  {
    name: "Don Angie",
    cuisine: "Italian-American",
    neighborhood: "West Village",
    priceRange: "$$$",
    vibe: "fun, retro",
    rating: 4.5,
    description:
      "Italian-American with a wink. The chrysanthemum salad and pinwheel lasagna are Instagram-famous for a reason.",
    highlights: ["Pinwheel lasagna", "Retro vibes", "Great cocktails"],
    dietary: ["vegetarian-friendly"],
  },
  {
    name: "Double Chicken Please",
    cuisine: "Cocktail Bar",
    neighborhood: "Lower East Side",
    priceRange: "$$",
    vibe: "speakeasy, creative",
    rating: 4.7,
    description:
      "World's best bar (2023). Two-floor cocktail experience — upstairs casual, downstairs tasting menu. Mind-bending drinks.",
    highlights: ["World's Best Bar", "Tasting menu cocktails", "Two floors"],
    dietary: [],
  },
  {
    name: "Attaboy",
    cuisine: "Cocktail Bar",
    neighborhood: "Lower East Side",
    priceRange: "$$",
    vibe: "speakeasy, intimate",
    rating: 4.6,
    description:
      "No menu — tell the bartender what you like and they'll create something perfect. Successor to Milk & Honey.",
    highlights: ["No menu", "Bespoke cocktails", "Intimate space"],
    dietary: [],
  },
  {
    name: "Ke$ha",
    cuisine: "Wine Bar",
    neighborhood: "East Village",
    priceRange: "$$",
    vibe: "trendy, natural wine",
    rating: 4.3,
    description:
      "Natural wine bar with a cheeky name and serious pours. Small plates are solid. Great first-date spot.",
    highlights: ["Natural wine", "Small plates", "Cozy atmosphere"],
    dietary: ["vegetarian-friendly"],
  },
  {
    name: "Thai Diner",
    cuisine: "Thai",
    neighborhood: "Nolita",
    priceRange: "$$",
    vibe: "fun, diner-meets-thai",
    rating: 4.4,
    description:
      "Ann Redding's Thai-meets-American diner. Khao soi is excellent, and the Thai iced tea soft serve is a must.",
    highlights: ["Khao soi", "Thai iced tea soft serve", "Fun atmosphere"],
    dietary: ["vegetarian options", "gluten-free options"],
  },
  {
    name: "Gramercy Tavern",
    cuisine: "American",
    neighborhood: "Gramercy",
    priceRange: "$$$",
    vibe: "warm, sophisticated",
    rating: 4.6,
    description:
      "Danny Meyer's beloved tavern. The front tavern room is walk-in only with a more casual menu. Back dining room for special occasions.",
    highlights: [
      "Walk-in tavern room",
      "Seasonal menu",
      "Danny Meyer restaurant",
    ],
    dietary: ["vegetarian-friendly", "gluten-free options"],
  },
];

// Search function that filters the restaurant DB
export function searchRestaurants(params: {
  cuisine?: string;
  neighborhood?: string;
  price_range?: string;
  occasion?: string;
  dietary?: string;
  vibe?: string;
}) {
  let results = [...RESTAURANT_DB];

  if (params.cuisine) {
    const cuisine = params.cuisine.toLowerCase();
    results = results.filter(
      (r) =>
        r.cuisine.toLowerCase().includes(cuisine) ||
        r.description.toLowerCase().includes(cuisine),
    );
  }

  if (params.neighborhood) {
    const neighborhood = params.neighborhood.toLowerCase();
    results = results.filter((r) =>
      r.neighborhood.toLowerCase().includes(neighborhood),
    );
  }

  if (params.price_range) {
    results = results.filter((r) => r.priceRange === params.price_range);
  }

  if (params.dietary) {
    const dietary = params.dietary.toLowerCase();
    results = results.filter((r) =>
      r.dietary.some((d) => d.toLowerCase().includes(dietary)),
    );
  }

  if (params.vibe) {
    const vibe = params.vibe.toLowerCase();
    results = results.filter(
      (r) =>
        r.vibe.toLowerCase().includes(vibe) ||
        r.description.toLowerCase().includes(vibe),
    );
  }

  // If no filters matched anything useful, return top picks
  if (results.length === 0) {
    results = RESTAURANT_DB.slice(0, 5);
  }

  return results.slice(0, 5).map((r) => ({
    name: r.name,
    cuisine: r.cuisine,
    neighborhood: r.neighborhood,
    priceRange: r.priceRange,
    vibe: r.vibe,
    rating: r.rating,
    description: r.description,
    highlights: r.highlights,
  }));
}

// OpenTable search via Apify API
export async function searchOpenTable(params: {
  location?: string;
  date?: string;
  time?: string;
  covers?: number;
}): Promise<unknown> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return {
      error:
        "OpenTable search is not configured. APIFY_API_TOKEN is not set. Use search_restaurants for local recommendations instead.",
    };
  }

  const actorInput: Record<string, unknown> = {
    location: params.location || "New York",
    covers: params.covers || 2,
    results_wanted: 10,
  };
  if (params.date) actorInput.date = params.date;
  if (params.time) actorInput.time = params.time;

  try {
    const res = await fetch(
      "https://api.apify.com/v2/acts/shahidirfan~opentable-scraper/run-sync-get-dataset-items",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(actorInput),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      return {
        error: `OpenTable search failed (${res.status}): ${errText.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    // Return first 8 results, trimmed to relevant fields
    const results = (Array.isArray(data) ? data : [])
      .slice(0, 8)
      .map((r: any) => ({
        name: r.name || r.restaurantName,
        cuisine: r.cuisine || r.cuisineType || r.category,
        neighborhood: r.neighborhood || r.area,
        priceRange: r.priceRange || r.price,
        rating: r.rating || r.overallRating,
        reviewCount: r.reviewCount || r.totalReviews,
        description: r.description || r.tagline,
        bookingSlots: r.bookingSlots || r.availableSlots,
        address: r.address,
      }));

    if (results.length === 0) {
      return {
        message:
          "No OpenTable results found for this search. Try broader criteria or use search_restaurants for local picks.",
      };
    }

    return results;
  } catch (err: any) {
    return {
      error: `OpenTable search failed: ${err.message}. Use search_restaurants for local recommendations instead.`,
    };
  }
}

// Exa web search for real-time restaurant info
export async function searchExa(params: {
  restaurant_name?: string;
  location?: string;
  query?: string;
  info_type?: "reviews" | "hours" | "neighborhood" | "general";
}): Promise<unknown> {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    return {
      error: "Web search is not configured. EXA_API_KEY is not set.",
    };
  }

  // Build the search query from structured fields or free-form query
  let searchQuery: string;
  if (params.restaurant_name) {
    // Specific restaurant lookup
    const parts = [params.restaurant_name];
    if (params.location) parts.push(params.location);
    const focus = params.info_type ?? "general";
    if (focus !== "general") parts.push(focus);
    searchQuery = parts.join(" ") + " restaurant NYC";
  } else if (params.query) {
    // Free-form discovery search
    searchQuery = params.query;
  } else {
    return { error: "Provide either restaurant_name or query." };
  }

  try {
    const res = await exa.search(searchQuery, {
      type: "auto",
      numResults: 5,
      contents: {
        highlights: {
          maxCharacters: 2000,
        },
      },
    });

    return res.results;
  } catch (err: any) {
    return { error: `Exa search failed: ${err.message}` };
  }
}

// Unified tool dispatcher
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_restaurants":
      return searchRestaurants(
        input as Parameters<typeof searchRestaurants>[0],
      );
    case "search_opentable":
      return searchOpenTable(input as Parameters<typeof searchOpenTable>[0]);
    case "web_search":
      return searchExa(input as Parameters<typeof searchExa>[0]);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
