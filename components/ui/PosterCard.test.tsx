import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PosterCard } from "./PosterCard";

test("PosterCard renders title and links to detail", () => {
  render(<PosterCard anime={{ id: 42, title: "Bleach", cover: "c", banner: null, type: "TV", score: 8.1, year: 2004 }} />);
  expect(screen.getByText("Bleach")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/anime/42");
});
