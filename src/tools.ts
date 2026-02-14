import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

// Restaurant search tool definition for Claude's tool use
export const TOOLS: Tool[] = [
  {
    name: "determine_date",
    description:
      "Use this tool to determine the current date. Use this to determine the current date, as well as what the user means by 'next Friday', etc. This will always current the current date and time in UTC. Assume the user is in EST time (NYC). Mention this and use this date for reference.",
    input_schema: {
      type: "object" as const,
    },
  },
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
    name: "geocode_venues",
    description:
      "Resolve venue names to lat/lng via Mapbox. Call this after discovering venues with web_search to display on a map, when generating itineraries / user plans. This is meant AFTER a location is selected, after web_search tool",
    input_schema: {
      type: "object",
      properties: {
        venues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              neighborhood: { type: "string" },
            },
          },
        },
      },
    },
  },
];

/**
 *
 * @returns current datetime, ISO format
 */
export function determineDate() {
  const todayISO = new Date().toISOString();

  return todayISO;
}

interface GeocodeParams {
  venues: { name: string; neighborhood?: string }[];
}

// Resolve venue names to lat/lng via Mapbox Search Box API

export async function geocodeVenues(params: GeocodeParams): Promise<unknown> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return { error: "MAPBOX_ACCESS_TOKEN is not set." };
  }

  // NYC bounding box to constrain results
  const NYC_BBOX = "-74.26,40.49,-73.70,40.92";

  const results = await Promise.all(
    params.venues.map(async (place) => {
      const query = encodeURIComponent(place.name);
      const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${query}&bbox=${NYC_BBOX}&types=poi&limit=1&access_token=${token}`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        const feature = data.features?.[0];

        if (!feature) {
          return { name: place.name, error: "Not found" };
        }

        const [lng, lat] = feature.geometry.coordinates;
        return {
          name: place.name,
          lat,
          lng,
          address: feature.properties.full_address,
        };
      } catch (err: any) {
        return { name: place.name, error: err.message };
      }
    }),
  );

  return results;
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
    case "web_search":
      return searchExa(input as Parameters<typeof searchExa>[0]);
    case "determine_date":
      return determineDate();
    case "geocode_venues":
      return geocodeVenues(input as unknown as GeocodeParams);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
