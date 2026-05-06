import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useOnboardingState } from "@/features/onboarding/useOnboardingState";

describe("useOnboardingState", () => {
  afterEach(() => {
    // Clean up localStorage between tests
    try {
      window.localStorage.removeItem("claw3d:onboarding:completed");
    } catch {
      // noop
    }
  });

  it("shows onboarding by default when localStorage is empty", async () => {
    const { result } = renderHook(() => useOnboardingState());
    await waitFor(() => expect(result.current.showOnboarding).toBe(true));
  });

  it("hides onboarding after completeOnboarding is called", async () => {
    const { result } = renderHook(() => useOnboardingState());
    await waitFor(() => expect(result.current.showOnboarding).toBe(true));

    act(() => {
      result.current.completeOnboarding();
    });

    expect(result.current.showOnboarding).toBe(false);
  });

  it("persists completion to localStorage", async () => {
    const { result } = renderHook(() => useOnboardingState());
    await waitFor(() => expect(result.current.showOnboarding).toBe(true));

    act(() => {
      result.current.completeOnboarding();
    });

    expect(window.localStorage.getItem("claw3d:onboarding:completed")).toBe(
      "true",
    );
  });

  it("reads completion state from localStorage on mount", async () => {
    window.localStorage.setItem("claw3d:onboarding:completed", "true");
    const { result } = renderHook(() => useOnboardingState());
    await waitFor(() => expect(result.current.showOnboarding).toBe(false));
  });

  it("resets onboarding when resetOnboarding is called", async () => {
    const { result } = renderHook(() => useOnboardingState());
    await waitFor(() => expect(result.current.showOnboarding).toBe(true));

    act(() => {
      result.current.completeOnboarding();
    });
    expect(result.current.showOnboarding).toBe(false);

    act(() => {
      result.current.resetOnboarding();
    });
    expect(result.current.showOnboarding).toBe(true);
    expect(window.localStorage.getItem("claw3d:onboarding:completed")).toBeNull();
  });
});
