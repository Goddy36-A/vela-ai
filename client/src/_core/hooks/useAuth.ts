// Auth removed — always returns an authenticated platform user.
// To re-enable OAuth, restore the original tRPC-based implementation.

export function useAuth() {
  return {
    user: { name: "Godfrey Atwijukire", email: "admin@velaai.platform" },
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => {},
    logout: () => {},
  };
}
