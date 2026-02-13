/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BrowserRouter, Route, Routes } from "react-router";
import { ChatView } from "./ChatView";
import { AppLayout } from "./components/AppLayout";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route
            path="chat/:conversationId"
            element={<ChatView onContextUpdate={() => {}} />}
          ></Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
