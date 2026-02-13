import type { Preference, Restaurant } from "@/App";
import { ChatView } from "@/ChatView";
import { CorkBoard } from "@/CorkBoard";
import { authClient } from "@/lib/auth-client";
import { useState, useRef, useEffect } from "react";
import { Navigate, Outlet } from "react-router";

/**
 * Homepage of application. Contains sidebar and ChatView elements which are selectively rerendered via Outlet
 * @returns
 */
export function AppLayout() {
  // follows the react "use" convention, we call it at the top level. Direct to login if no session.
  const { data: session, isPending: pending } = authClient.useSession();

  if (pending) {
    return (
      <>
        <div className="room-ambience" />
        <div className="console-frame">
          <main className="flex-1 flex items-center justify-center bg-crunch-cream">
            <p className="text-crunch-walnut-700 font-body text-lg animate-pulse">
              Loading...
            </p>
          </main>
        </div>
      </>
    );
  }

  if (!session) {
    return <Navigate to={"/login"}></Navigate>;
  }

  return (
    <>
      {/* Green velvet ambient background */}
      <div className="room-ambience" />

      {/* Console frame with thick mahogany border */}
      <div className="console-frame">
        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0 bg-crunch-cream">
          {/* React router fills outlet with child components – see frontend.tsx */}
          <Outlet />
        </main>

        {/* Corkboard sidebar */}
        {/* <CorkBoard
          preferences={preferences}
          restaurants={restaurants}
          isExpanded={boardExpanded}
          onToggle={() => setBoardExpanded((prev) => !prev)}
        /> */}
      </div>
    </>
  );
}
