import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useDebounce } from "./useDebounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("debounces value updates", () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), { initialProps: { v: "a" } });
  rerender({ v: "ab" });
  expect(result.current).toBe("a");
  act(() => vi.advanceTimersByTime(250));
  expect(result.current).toBe("ab");
});
