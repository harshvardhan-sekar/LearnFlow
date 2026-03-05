import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../utils/firebase";
import client from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const { data } = await client.post<User>("/auth/login", {
            firebase_uid: fbUser.uid,
            email: fbUser.email,
            display_name: fbUser.displayName || fbUser.email,
          });
          setUser(data);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
    // Explicitly fetch user profile after sign-in to handle cases
    // where onAuthStateChanged already fired with a stale/failed state
    const { data } = await client.post<User>("/auth/login");
    setUser(data);
  }

  async function register(
    email: string,
    password: string,
    displayName: string
  ) {
    let fbUser: FirebaseUser;
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await updateProfile(credential.user, { displayName });
      fbUser = credential.user;
    } catch (firebaseErr: unknown) {
      // If Firebase account already exists, sign in instead
      const code = (firebaseErr as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        fbUser = credential.user;
      } else {
        throw firebaseErr;
      }
    }
    // Ensure backend DB user exists (handles new + re-created Firebase accounts)
    await client.post("/auth/register", {
      firebase_uid: fbUser.uid,
      email,
      display_name: displayName,
    });
    // Fetch the full user profile
    const { data } = await client.post<User>("/auth/login");
    setUser(data);
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, firebaseUser, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
