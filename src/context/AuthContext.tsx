import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { jwtDecode } from "jwt-decode";
import { getRoleByEmail } from "../services/sheets";
import type { User } from "../types/auth";

interface GoogleJwt {
  email: string;
  name: string;
  picture: string;
}

interface CredentialResponse {
  credential?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authError: string | null;
  login: (credentialResponse: CredentialResponse) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  authError: null,
  login: async () => {},
  logout: () => {},
});

const STORAGE_KEY = "enlight_user";

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(async (credentialResponse: CredentialResponse) => {
    setAuthError(null);
    if (!credentialResponse.credential) {
      setAuthError("No se recibió credencial de Google.");
      return;
    }
    try {
      const decoded = jwtDecode<GoogleJwt>(credentialResponse.credential);
      if (!decoded.email.endsWith("@enlight.mx")) {
        setAuthError("Acceso restringido a cuentas @enlight.mx");
        return;
      }
      const role = await getRoleByEmail(decoded.email);
      setUser({
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        role,
      });
    } catch {
      setAuthError("Error al procesar la autenticación.");
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, authError, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
