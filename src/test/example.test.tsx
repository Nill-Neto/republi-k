import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";

import App from "@/App";

describe("app loading", () => {
  it("renders without crashing", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
