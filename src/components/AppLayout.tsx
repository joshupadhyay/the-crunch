import type { Preference, Restaurant, startingPoint } from "@/App";
import { CorkBoard } from "@/CorkBoard";
import { authClient } from "@/lib/auth-client";
import { useCallback, useState } from "react";
import { Navigate, Outlet } from "react-router";

/**
 * Homepage of application. Contains sidebar and ChatView elements which are selectively rerendered via Outlet
 */
export function AppLayout() {
  const { data: session, isPending: pending } = authClient.useSession();
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [startingPlace, setStartingPlace] = useState<startingPoint>();

  const handleContextUpdate = useCallback(
    (ctx: {
      preferences?: Preference[];
      restaurants?: Restaurant[];
      startPlace?: startingPoint;
    }) => {
      if (ctx.preferences) {
        setPreferences((prev) => {
          const merged = [...prev];
          for (const p of ctx.preferences!) {
            const existing = merged.findIndex(
              (m) => m.label.toLowerCase() === p.label.toLowerCase(),
            );
            if (existing >= 0) {
              merged[existing] = p;
            } else {
              merged.push(p);
            }
          }
          return merged;
        });
      }
      if (ctx.restaurants) {
        // this looks claude slop-y
        // check existing restaurants, if the contextupdate has geoCodes
        // update hte geoCode ont he existing restaurants after finding their index

        setRestaurants((prev) => {
          const merged = [...prev];
          for (const r of ctx.restaurants!) {
            const existingIdx = merged.findIndex((m) => m.name === r.name);
            // returns -1 if not found, hence >= 0 check
            if (existingIdx >= 0) {
              const existingRestaurant = merged[existingIdx];
              if (r.geoCode && existingRestaurant) {
                existingRestaurant.geoCode = r.geoCode;
              }
            } else {
              merged.push(r);
            }
          }
          return merged;
        });
        if (!boardExpanded) setBoardExpanded(true);
      }
      if (ctx.startPlace) {
        // set starting place
        setStartingPlace(ctx.startPlace);
        if (!boardExpanded) setBoardExpanded(true);
      }
    },
    [boardExpanded],
  );

  if (pending) {
    return (
      <>
        <div className="room-ambience" />
        <div className="console-frame">
          <main className="flex-1 flex items-center justify-center bg-crunch-cream">
            <div className="status-panel">
              <p className="text-crunch-walnut-800 font-body text-base font-semibold">
                Checking your session
              </p>
              <p className="text-crunch-khaki-600 font-body text-sm mt-1">
                Redirecting you as soon as we know where you belong.
              </p>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (!session) {
    return <Navigate to={"/login"} />;
  }

  return (
    <>
      {/* Green velvet ambient background */}
      <div className="room-ambience" />

      {/* Console frame with thick mahogany border */}
      <div className="console-frame">
        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0 bg-crunch-cream">
          <Outlet
            context={{
              onToggleBoard: () => setBoardExpanded((prev) => !prev),
              onContextUpdate: handleContextUpdate,
            }}
          />
        </main>

        {/* Corkboard sidebar */}
        <CorkBoard
          startingPlace={startingPlace}
          preferences={preferences}
          restaurants={restaurants}
          isExpanded={boardExpanded}
          onToggle={() => setBoardExpanded((prev) => !prev)}
        />
      </div>
    </>
  );
}
