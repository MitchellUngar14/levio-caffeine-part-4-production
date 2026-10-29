import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StoreProvider } from "./store/StoreProvider";
import { createStore } from "./store";
import "./theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider store={createStore()}>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
