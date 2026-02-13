import type { Preference, Restaurant } from "@/App";
import { ChatView } from "@/ChatView";
import { CorkBoard } from "@/CorkBoard";
import { useState, useRef, useEffect } from "react";
import { Outlet } from "react-router";

/**
 * Homepage of application. Contains sidebar and ChatView elements which are selectively rerendered via Outlet
 * @returns
 */
export function AppLayout() {
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
