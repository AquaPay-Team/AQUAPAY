/**
 * Backward compatibility re-export.
 * New code should import from '@/features/auth/useAuth' or '@/features/auth/AuthProvider'.
 */
export { AuthProvider, AuthContext, default } from "../features/auth/AuthProvider";
export { useAuth } from "../features/auth/useAuth";