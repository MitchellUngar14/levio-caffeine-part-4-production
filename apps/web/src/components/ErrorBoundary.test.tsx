import { act } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Boom(): never {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  it("renders its children when nothing is wrong", async () => {
    const el = document.createElement("div");
    await act(async () => {
      createRoot(el).render(
        <ErrorBoundary>
          <p>all good</p>
        </ErrorBoundary>,
      );
    });
    expect(el.textContent).toBe("all good");
  });

  it("shows the error and a reload button instead of a blank page", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const el = document.createElement("div");
    await act(async () => {
      createRoot(el).render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
    });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain("kaboom");
    expect(el.querySelector("button")?.textContent).toContain("reload");
    quiet.mockRestore();
  });
});
