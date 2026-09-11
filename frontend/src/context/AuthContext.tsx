"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Organization, Role } from "@/lib/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem("nexus_access_token");
        const storedUser = localStorage.getItem("nexus_user");
        const storedOrg = localStorage.getItem("nexus_org");

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (storedOrg) setOrganization(JSON.parse(storedOrg));

          // Verify token against /auth/me
          try {
            const profile = await api.getProfile();
            setUser(profile);
            localStorage.setItem("nexus_user", JSON.stringify(profile));
          } catch (e) {
            // Token expired or invalid
            localStorage.removeItem("nexus_access_token");
            localStorage.removeItem("nexus_user");
            localStorage.removeItem("nexus_org");
            setToken(null);
            setUser(null);
            setOrganization(null);
          }
        }
      } catch (err) {
        console.error("Failed to initialize authentication", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.login(email, password);
      setToken(response.access_token);
      setUser(response.user);
      if (response.organization) setOrganization(response.organization);

      localStorage.setItem("nexus_access_token", response.access_token);
      localStorage.setItem("nexus_user", JSON.stringify(response.user));
      if (response.organization) {
        localStorage.setItem("nexus_org", JSON.stringify(response.organization));
      }

      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("nexus_access_token");
    localStorage.removeItem("nexus_user");
    localStorage.removeItem("nexus_org");
    setToken(null);
    setUser(null);
    setOrganization(null);
    router.push("/login");
  };

  const hasRole = (allowedRoles: Role[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
