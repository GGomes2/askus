import { Children, isValidElement } from "react";
import { expect, it, vi } from "vitest";
import DashboardError from "./error";

it("calls the Next.js retry callback when Try again is clicked", () => {
  const retry = vi.fn();
  const fallback = DashboardError({ retry });
  const button = Children.toArray(fallback.props.children).find(
    (child) => isValidElement(child) && child.type === "button",
  );

  if (!isValidElement<{ children: string; onClick: () => void }>(button)) {
    throw new Error("Missing dashboard retry button");
  }

  expect(button.props.children).toBe("Try again");
  button.props.onClick();
  expect(retry).toHaveBeenCalledOnce();
});
