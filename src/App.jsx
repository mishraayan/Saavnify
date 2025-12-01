import { useState, useRef, useEffect } from "react";
import axios from "axios";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { supabase } from "./lib/supabase";
import { useCallback } from "react";
import {
  Download,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  Shuffle,
  Repeat,
  Search as SearchIcon,
  Home as HomeIcon,
  Library as LibraryIcon,
  User2,
  Heart,
  Share2,
  Trash2,
} from "lucide-react";

// Your deployed JioSaavnAPI on Render
const API = "https://rythm-1s3u.onrender.com";
const YT_API = "https://yt-backend-8b51.onrender.com";
const MXM_API = "https://saavnify-mxm-backend.onrender.com";

// ---------- THEME UTILS ----------
function getHashThemeForTrack(track) {
  const fallback = {
    primary: "#38bdf8", // cyan
    secondary: "#a855f7", // purple
    accent: "#22c55e", // green
  };
  if (!track) return fallback;

  const key = (track.singers || track.title || "").toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i)) % 4;
  }
  switch (hash) {
    case 0:
      return { primary: "#38bdf8", secondary: "#a855f7", accent: "#22c55e" };
    case 1:
      return { primary: "#f97316", secondary: "#ec4899", accent: "#facc15" };
    case 2:
      return { primary: "#4ade80", secondary: "#22d3ee", accent: "#22c55e" };
    case 3:
    default:
      return { primary: "#6366f1", secondary: "#0ea5e9", accent: "#22c55e" };
  }
}

// 2) small helper to clamp values
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// 3) extract approximate dominant color from image URL using canvas
function extractThemeFromImage(url) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("No window"));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; // may still fail if server blocks CORS

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No canvas context"));
          return;
        }

        const size = 32; // small for performance
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        // sample every 4th pixel for speed
        for (let i = 0; i < imageData.length; i += 4 * 4) {
          const rr = imageData[i];
          const gg = imageData[i + 1];
          const bb = imageData[i + 2];
          const alpha = imageData[i + 3];

          if (alpha < 128) continue; // skip transparent

          r += rr;
          g += gg;
          b += bb;
          count++;
        }

        if (!count) {
          reject(new Error("No pixels"));
          return;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // convert to HSL for nicer variations
        const rf = r / 255;
        const gf = g / 255;
        const bf = b / 255;
        const max = Math.max(rf, gf, bf);
        const min = Math.min(rf, gf, bf);
        const l = (max + min) / 2;
        let h = 0,
          s = 0;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

          switch (max) {
            case rf:
              h = (gf - bf) / d + (gf < bf ? 6 : 0);
              break;
            case gf:
              h = (bf - rf) / d + 2;
              break;
            case bf:
              h = (rf - gf) / d + 4;
              break;
          }
          h /= 6;
        }

        const hDeg = h * 360;

        const primary = `hsl(${Math.round(hDeg)}deg, ${Math.round(
          clamp01(s) * 70 + 20
        )}%, ${Math.round(clamp01(l) * 40 + 20)}%)`;

        const secondary = `hsl(${Math.round(
          (hDeg + 35) % 360
        )}deg, ${Math.round(clamp01(s) * 70 + 15)}%, ${Math.round(
          clamp01(l) * 40 + 30
        )}%)`;

        const accent = `hsl(${Math.round((hDeg + 200) % 360)}deg, 70%, 55%)`;

        resolve({ primary, secondary, accent });
      } catch (err) {
        // CORS or canvas taint will land here
        reject(err);
      }
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = url;
  });
}

function adaptSongs(data) {
  return data
    .map((song) => ({
      id: song.id || song.songid || Math.random().toString(),
      title: song.title || song.song || "Unknown",
      singers: song.singers || song.primary_artists || "Unknown Artist",
      image_url:
        (song.image || song.image_url || "").replace("150x150", "500x500") ||
        "https://via.placeholder.com/500",
      url:
        song.url ||
        song.media_url ||
        song.downloadUrl?.[song.downloadUrl.length - 1]?.url,
      duration: song.duration || 0, // ← ADD THIS LINE
    }))
    .filter((t) => t.url);
}

// ---------- LANDING SCREEN ----------
function LandingScreen({ onGetStarted }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-900 via-black to-purple-900 flex items-center justify-center">
      {/* ✨ Disable particles on mobile to avoid Aw Snap crashes */}
      {!isMobile && (
        <Particles
          init={async (e) => await loadFull(e)}
          options={{
            fullScreen: { enable: true, zIndex: -1 },
            particles: {
              number: { value: 70 },
              size: { value: { min: 1, max: 4 } },
              color: { value: ["#38bdf8", "#ec4899", "#fbbf24"] },
              move: { speed: 1.5 },
              opacity: { value: 0.5 },
            },
          }}
          className="absolute inset-0"
        />
      )}

      <div className="relative z-10 text-center px-6">
        <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-pink-500 via-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-6">
          Welcome to Saavnify ULTRA
        </h1>
        <p className="text-gray-200 max-w-xl mx-auto mb-8">
          Stream, search and vibe with a futuristic music experience powered by
          Saavnify&apos;s smart engine.
        </p>
        <button
          onClick={onGetStarted}
          className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full font-semibold text-lg shadow-xl hover:scale-105 transition"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

// ---------- AUTH SCREEN ----------
function AuthScreen({ mode, setMode, onAuthComplete }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      if (mode === "signup") {
        // SIGN UP WITH SUPABASE
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || "Music Lover" }, // stored in user_metadata
          },
        });

        if (error) throw error;

        // If email confirmation is ON in Supabase, session may be null
        if (!data.session) {
          setInfo("Check your email to confirm your account, then log in.");
          return;
        }

        const supaUser = data.session.user;

        // 1️⃣ Create / update profile row
        const displayName =
          supaUser.user_metadata?.name || name || "Music Lover";

        await supabase.from("profiles").upsert({
          id: supaUser.id,
          name: displayName,
        });

        // 2️⃣ Build appUser object with avatar null (no avatar yet)
        const appUser = {
          id: supaUser.id,
          name: displayName,
          email: supaUser.email,
          avatar: null,
        };

        localStorage.setItem("saavnify_user_profile", JSON.stringify(appUser));

        onAuthComplete(appUser);
      } else {
        // LOGIN WITH SUPABASE
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const supaUser = data.user;

        // 1️⃣ Fetch profile row for latest name + avatar
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", supaUser.id)
          .single();

        const displayName =
          profileData?.name ||
          supaUser.user_metadata?.name ||
          name ||
          "Music Lover";

        const avatarUrl = profileData?.avatar_url || null;

        const appUser = {
          id: supaUser.id,
          name: displayName,
          email: supaUser.email,
          avatar: avatarUrl,
        };

        localStorage.setItem("saavnify_user_profile", JSON.stringify(appUser));

        onAuthComplete(appUser);
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 px-4">
      <div className="w-full max-w-md bg-black/60 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-6">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-cyan-400"
                placeholder="Arijit Fan"
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-cyan-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-cyan-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
              ? "Sign Up"
              : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-300">
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button
            className="text-cyan-400 underline"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Login" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}

function SearchScreen({
  searchQuery,
  setSearchQuery,
  searchSongs,
  tracks,
  openPlayer,
  loading,
  suggestions = [],
  showSuggestions = false,
  onSearchChange, // from parent (MusicApp)
  onSuggestionClick,
  onManualSearch, // from parent (MusicApp)
}) {
  // fallback: if parent didn't pass custom handler, just use local one
  const handleChange = (e) => {
    if (onSearchChange) {
      onSearchChange(e);
    } else {
      setSearchQuery(e.target.value);
    }
  };

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (onManualSearch) {
      onManualSearch(); // use parent logic
    } else {
      searchSongs(); // fallback
    }
  };

  const handleSuggestionPress = (track) => {
    if (onSuggestionClick) {
      onSuggestionClick(track);
    } else {
      // fallback: just put title+artist into box and search
      const q = `${track.title || ""} ${track.singers || ""}`.trim();
      setSearchQuery(q);
      searchSongs(q);
    }
  };

  return (
    <div className="px-4 pb-24 mt-2">
      {/* Search bar section (mobile + desktop) */}
      <div className="max-w-xl mx-auto mb-4">
        <div className="relative">
          {/* input + icon button side by side */}
          <div className="flex items-center gap-2">
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={handleChange}
              onKeyDown={handleEnter}
              placeholder="Search songs, artists..."
              className="w-full flex-1 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white
                focus:outline-none focus:border-cyan-500 transition text-sm"
              onFocus={() => {
                // let MusicApp decide showSuggestions; no-op here
              }}
              onBlur={() => {
                // blur handling kept in parent if needed
              }}
            />

            <button
              type="button"
              onClick={() =>
                onManualSearch ? onManualSearch() : searchSongs()
              }
              className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/90 hover:bg-cyan-500
                         text-white shadow-lg flex-shrink-0 active:scale-95 transition"
            >
              <SearchIcon size={18} />
            </button>
          </div>

          {/* Suggestions dropdown */}
          {onSearchChange && showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl z-40 max-h-80 overflow-y-auto">
              {suggestions.map((t) => (
                <button
                  key={t.id + t.title}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // avoid blur before click
                  onClick={() => handleSuggestionPress(t)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 text-left"
                >
                  <img
                    src={t.image_url}
                    alt={t.title}
                    className="w-9 h-9 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold truncate">{t.title}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {t.singers}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase text-gray-500">
                    {t.source === "yt" ? "YouTube" : "Saavn"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center mt-10">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-center text-gray-300 text-sm mt-6">
          No results yet. Try searching for your favourite song or artist.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {tracks.map((track) => (
            <div
              key={track.id + track.title}
              onClick={() => openPlayer(track, tracks)}
              className="cursor-pointer group relative rounded-2xl overflow-hidden shadow-xl bg-black/40 border border-white/10 hover:-translate-y-1 hover:scale-[1.02] transition"
            >
              <div className="relative w-full aspect-square overflow-hidden">
                <img
                  src={track.image_url}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Play size={32} className="text-white drop-shadow-lg" />
                </div>
              </div>
              <p className="mt-2 font-semibold text-center truncate px-2 text-xs sm:text-sm">
                {track.title}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-400 text-center truncate px-2 mb-3">
                {track.singers}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileScreen({
  user,
  profileName,
  setProfileName,
  avatarUrl,
  avatarUploading,
  profileSaving,
  onAvatarUpload,
  onSaveProfile,
  inRoom,
  isRoomOwner,
  onCreateRoom,
  onShareRoom,
  onLeaveRoom,
  onEndRoom,
  onLogout,
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [editBaseline, setEditBaseline] = useState({
    name: profileName,
    email: user?.email || "",
  });

  // ✅ Only reset when the logged-in user changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsEditing(false);
    setEditBaseline({
      name: profileName,
      email: user?.email || "",
    });
  }, [user?.id]); // 👈 removed profileName here

  const trimmedName = (profileName || "").trim();
  const baselineName = (editBaseline.name || "").trim();
  const baselineEmail = (editBaseline.email || "").trim();
  const currentEmail = (user?.email || "").trim();

  const hasTextChanges =
    trimmedName !== baselineName || currentEmail !== baselineEmail;

  const onClickEdit = () => {
    setEditBaseline({
      name: profileName,
      email: user?.email || "",
    });
    setIsEditing(true);
  };

  const onClickCancel = () => {
    setProfileName(editBaseline.name || user?.name || "Music Lover");
    setIsEditing(false);
  };

  const onClickSave = async () => {
    if (!hasTextChanges) return;
    await onSaveProfile(); // writes to Supabase
    setEditBaseline({
      name: (profileName || "").trim(),
      email: user?.email || "",
    });
  };

  if (!user) return null;

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-6 text-white">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">Profile</h2>

      <div className="max-w-xl bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 flex flex-col md:flex-row gap-5">
        {/* Avatar section */}
        <div className="flex flex-col items-center gap-3 md:w-1/3">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name || "Avatar"}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border border-white/40 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-semibold">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </div>
            )}

            <input
              id="avatar-upload-profile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarUpload}
            />

            <label
              htmlFor="avatar-upload-profile"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-black/90 border border-white/40 flex items-center justify-center text-[11px] cursor-pointer hover:bg-black"
              title="Change avatar"
            >
              {avatarUploading ? "…" : "✎"}
            </label>
          </div>
          <p className="text-[11px] text-gray-400 text-center">
            Tap the pen icon to change your picture
            <br />
            (avatar saves automatically)
          </p>
        </div>
        {/* Info / form section */}
        <div className="flex-1 space-y-4">
          {!isEditing ? (
            <>
              <div>
                <p className="text-xs text-gray-400 mb-1">Display Name</p>
                <p className="text-base md:text-lg font-semibold">
                  {profileName || user.name || "Music Lover"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-sm text-gray-300">
                  {user.email || "Not set"}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClickEdit}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-xs font-semibold hover:opacity-90"
                >
                  Edit profile
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Display Name
                </label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-sm focus:outline-none focus:border-cyan-400"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Email
                </label>
                <input
                  value={user.email || ""}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-300 cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-gray-500 max-w-xs">
                  Your profile is used for rooms, comments and future social
                  features.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClickCancel}
                    disabled={profileSaving}
                    className="px-3 py-2 rounded-full border border-white/20 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onClickSave}
                    disabled={profileSaving || !hasTextChanges || !trimmedName}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {profileSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* 👇 Mobile-only room + logout controls */}
      <div className="mt-6 md:hidden space-y-3">
        {!inRoom ? (
          <>
            {/* Create Room when NOT in a room */}
            {onCreateRoom && (
              <button
                type="button"
                onClick={onCreateRoom}
                className="w-full px-4 py-2 rounded-full bg-emerald-500/80 hover:bg-emerald-500 text-sm font-semibold"
              >
                Create Room
              </button>
            )}

            {/* Logout */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full px-4 py-2 rounded-full bg-red-500/80 hover:bg-red-500 text-sm font-semibold"
              >
                Logout
              </button>
            )}
          </>
        ) : (
          <>
            {/* Already IN a room → show room controls */}
            {onShareRoom && (
              <button
                type="button"
                onClick={onShareRoom}
                className="w-full px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold"
              >
                Share Room
              </button>
            )}

            {onLeaveRoom && (
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full px-4 py-2 rounded-full bg-orange-500/80 hover:bg-orange-500 text-sm font-semibold"
              >
                Leave Room
              </button>
            )}

            {isRoomOwner && onEndRoom && (
              <button
                type="button"
                onClick={onEndRoom}
                className="w-full px-4 py-2 rounded-full bg-red-500/80 hover:bg-red-500 text-sm font-semibold"
              >
                End Room
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full px-4 py-2 rounded-full bg-red-500/80 hover:bg-red-500 text-sm font-semibold"
              >
                Logout
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NewPlaylistForm({ onCreate }) {
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name);
      }}
      className="mt-2 space-y-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New playlist name"
        className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm focus:outline-none focus:border-cyan-400"
      />
      <button
        type="submit"
        className="w-full px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-sm font-semibold"
      >
        Create & add song
      </button>
    </form>
  );
}

// ---------- MAIN MUSIC APP ----------
function MusicApp({ user, onLogout }) {
  const [tracks, setTracks] = useState([]);
  const [library, setLibrary] = useState([]); // ❤️ liked songs
  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const DEFAULT_VOLUME = 1;
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const visualizerCanvasRef = useRef(null);
  const miniVisualizerCanvasRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [progress, setProgress] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [visualMode, setVisualMode] = useState("sphere"); // "cover" | "sphere"
  const [searchQuery, setSearchQuery] = useState("arijit singh");
  const [activeTab, setActiveTab] = useState("home"); // home, search, library, account
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [playlistModalTrack, setPlaylistModalTrack] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [followLyrics, setFollowLyrics] = useState(true);
  const [roomId, setRoomId] = useState(null);
  const [roomState, setRoomState] = useState(null); // mirrors row in `rooms`
  const [roomMembers, setRoomMembers] = useState([]); // people inside room
  const [inRoom, setInRoom] = useState(false);
  const [needsRoomTap, setNeedsRoomTap] = useState(false);
  const [toast, setToast] = useState(null);
  const [playLatestOnLoad, setPlayLatestOnLoad] = useState(false);
  const [isYouTube, setIsYouTube] = useState(false);
  const [ytLastTime, setYtLastTime] = useState(0);
  const ytProgressTimerRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimerRef = useRef(null);
  const skipNextSuggestionRef = useRef(false);
  const lastSuggestionQueryRef = useRef("");
  const ytPlayerRef = useRef(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const ytCanvasRef = useRef(null);
  const [theme, setTheme] = useState(
    getHashThemeForTrack(null) // default fallback
  );
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "Music Lover");
  const [profileSaving, setProfileSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setAvatarUrl(user?.avatar || null);
    setProfileName(user?.name || "Music Lover");
  }, [user?.avatar, user?.name]);

  const trackKey = useCallback(
    (track) =>
      track
        ? `${(track.title || "").toLowerCase().trim()}|${(track.singers || "")
            .toLowerCase()
            .trim()}`
        : "",
    []
  );
  const showToast = (title, body) => {
    setToast({ title, body });

    // auto-hide in 3.5s
    setTimeout(() => {
      setToast((current) => {
        // avoid clearing a new toast with an old timeout
        if (!current) return null;
        return null;
      });
    }, 3500);
  };
  const shareRoom = () => {
    if (!roomId) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

    navigator.clipboard
      .writeText(link)
      .then(() => {
        showToast("Room", "Room link copied to clipboard.");
      })
      .catch(() => {
        showToast("Room", "Copy failed — link shown in console.");
        console.log("Room link:", link);
      });
  };

  const handleDeleteRoom = async () => {
    if (!roomId || !roomState) return;

    if (!user?.id || roomState.host_id !== user.id) {
      alert("Only the room owner can end the room.");
      return;
    }

    if (!window.confirm("End this room for everyone?")) return;

    try {
      const { error } = await supabase.from("rooms").delete().eq("id", roomId);

      if (error) throw error;

      setInRoom(false);
      setRoomId(null);
      setRoomState(null);
      setRoomMembers([]);
      setIsPlaying(false);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // remove ?room= from URL
      const params = new URLSearchParams(window.location.search);
      params.delete("room");
      const newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);

      showToast("Room", "Room deleted for everyone ✅");
    } catch (e) {
      console.error("Delete room failed:", e);
      showToast("Room", "Failed to delete room");
    }
  };
  const handleEnableNotifications = () => {
    if (typeof window === "undefined") return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        const result = await OneSignal.Notifications.requestPermission();

        if (result === "granted") {
          showToast("Notifications", "🔥 Notifications enabled for Saavnify!");
        } else if (result === "denied") {
          showToast(
            "Notifications",
            "Permission denied — change it in browser settings if you change your mind."
          );
        } else {
          // "default" / dismissed
          showToast("Notifications", "Permission request was dismissed.");
        }
      } catch (e) {
        console.error("OneSignal permission error", e);
        showToast(
          "Notifications",
          "Failed to request notification permission."
        );
      }
    });
  };
  const performLogout = async () => {
    // stop audio
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);

    // sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signOut failed", err);
    }

    // clear local profile cache
    localStorage.removeItem("saavnify_user_profile");

    // your old logout flow
    onLogout();
  };
  const handleAvatarUpload = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!user?.id) {
        alert("You must be logged in to change avatar.");
        return;
      }

      setAvatarUploading(true);

      // Optional: limit to 2MB
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        alert("File too large. Please choose an image under 2MB.");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt || "png"}`;

      // 1️⃣ Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        alert("Could not upload avatar. Try again.");
        return;
      }

      // 2️⃣ Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        alert("Could not get avatar URL.");
        return;
      }

      // 3️⃣ Save URL in profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (profileError) {
        console.error("Update profile avatar error:", profileError);
        alert("Avatar saved to storage but not linked to profile.");
        return;
      }

      // 4️⃣ Update local UI + cache
      setAvatarUrl(publicUrl);

      try {
        const cached = window.localStorage.getItem("saavnify_user_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.avatar = publicUrl;
          window.localStorage.setItem(
            "saavnify_user_profile",
            JSON.stringify(parsed)
          );
        }
      } catch (err) {
        console.warn("Failed to update cached avatar", err);
      }

      showToast?.("Profile", "Avatar updated successfully ✨");
    } finally {
      setAvatarUploading(false);
      if (event.target) event.target.value = "";
    }
  };
  const handleSaveProfile = async () => {
    if (!user?.id) {
      alert("You must be logged in to update profile.");
      return;
    }
    const trimmed = (profileName || "").trim();
    if (!trimmed) {
      alert("Name cannot be empty.");
      return;
    }

    setProfileSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        name: trimmed,
        avatar_url: avatarUrl || null,
      });

      if (error) {
        console.error("Profile update error:", error);
        alert("Could not save profile. Try again.");
        return;
      }

      // update local cache so next reload uses new name
      try {
        const cached = window.localStorage.getItem("saavnify_user_profile");
        const base = cached ? JSON.parse(cached) : {};
        const updated = {
          ...base,
          id: user.id,
          email: user.email,
          name: trimmed,
          avatar: avatarUrl || null,
        };
        window.localStorage.setItem(
          "saavnify_user_profile",
          JSON.stringify(updated)
        );
      } catch {
        //
      }

      showToast?.("Profile", "Profile updated ✅");
    } finally {
      setProfileSaving(false);
    }
  };

  // Restore playback state on load
  // restore playback
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("saavnify_playback");
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      if (state.currentTrack && state.currentTrack.url) {
        setCurrentTrack(state.currentTrack);
        setQueue(state.queue || []);
        setProgress(state.progress || 0);

        // ✅ ensure audio exists
        let audio = audioRef.current;
        if (!audio) {
          audio = new Audio();
          audioRef.current = audio;
        }

        audio.src = state.currentTrack.url;
        audio.currentTime = state.currentTime || 0;
        setIsPlaying(false);
      }
    } catch (e) {
      console.log("Failed to restore playback:", e);
    }
  }, []);

  // helper to uniquely identify a track (for comments/downloads)

  // 👇 NEW STATE
  const [lyrics, setLyrics] = useState(null);
  const [syncedLyrics, setSyncedLyrics] = useState(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);

  // === SUPABASE SETUP ===

  // === SUPABASE REAL-TIME COMMENTS (GLOBAL) ===

  // === SUPABASE REAL-TIME COMMENTS (GLOBAL) ===
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState("");

  // Load comments when song changes
  useEffect(() => {
    if (!currentTrack) return;
    const key = trackKey(currentTrack);

    supabase
      .from("comments")
      .select("*")
      .eq("track_key", key)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setComments((prev) => ({ ...prev, [key]: data || [] }));
      });
  }, [currentTrack, trackKey]);

  // Real-time listener
  useEffect(() => {
    // Subscribe ONCE when component mounts — NEVER depend on roomId here
    const channel = supabase
      .channel(`room:${roomId || "temp"}`) // will be replaced anyway
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log("Realtime update →", payload);
          setRoomState(payload.new);
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // ← EMPTY DEPENDENCY ARRAY = subscribe once at mount

  // Send comment
  const sendComment = async () => {
    const text = newComment.trim();
    if (!text || !currentTrack) return;

    const key = trackKey(currentTrack);

    const payload = {
      track_key: key,
      text,
      name: user?.name || "Guest",
    };

    if (user?.id) {
      payload.user_id = user.id;
    }
    if (avatarUrl) {
      payload.avatar_url = avatarUrl;
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert(payload)
        .select("*") // 👈 so we get back full row (id, created_at, etc.)
        .single();

      if (error) {
        console.error("Comment failed:", error);
        return;
      }

      // ✅ Clear input
      setNewComment("");

      // ✅ Optimistic UI update – show immediately
      setComments((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), data],
      }));
    } catch (err) {
      console.error("sendComment error:", err);
    }
  };

  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const [downloadedTracks, setDownloadedTracks] = useState([]);

  // Load playlists from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saavnify_playlists");
      if (saved) {
        setPlaylists(JSON.parse(saved));
      }
    } catch {
      setPlaylists([]);
    }
  }, []);

  const persistPlaylists = (next) => {
    setPlaylists(next);
    localStorage.setItem("saavnify_playlists", JSON.stringify(next));
  };
  // Parse LRC format → [{ time: 12.34, text: "Hello world" }]
  const parseLrc = (lrc) => {
    if (!lrc) return null;

    const lines = lrc.trim().split("\n");
    const result = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Match all timestamp formats: [mm:ss.xx], [m:ss.xx], [ss.xx], [123.45]
      const matches = [
        ...line.matchAll(/\[(\d+:)?(\d+)[:.](\d{1,3})\]|\[(\d+\.\d{1,3})\]/g),
      ];
      if (matches.length === 0) continue;

      let text = line;
      let earliestTime = Infinity;

      for (const match of matches) {
        text = text.replace(match[0], "").trim();

        let time;
        if (match[4]) {
          time = parseFloat(match[4]);
        } else {
          const mins = parseInt(match[1] || "0", 10);
          const secs = parseFloat(
            match[2] + "." + (match[3] || "0").padEnd(3, "0")
          );
          time = mins * 60 + secs;
        }
        earliestTime = Math.min(earliestTime, time);
      }

      // THIS IS THE KEY: Keep line even if text is empty — it's a timing marker!
      result.push({
        time: earliestTime,
        text: text || "", // ← allow empty strings!
      });
    }

    // Sort by time and remove exact duplicates only
    result.sort((a, b) => a.time - b.time);
    const seen = new Set();
    const filtered = result.filter((item) => {
      const key = `${item.time.toFixed(3)}|${item.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return filtered.length > 0 ? filtered : null;
  };
  useEffect(() => {
    if (showPlayer) {
      // make sure the overlay starts from the top
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [showPlayer]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get("import");
      if (!shared) return;

      const data = JSON.parse(atob(shared));
      const id = crypto.randomUUID?.() || Date.now().toString();

      const newPl = {
        id,
        name: data.name || "Shared Playlist",
        tracks: data.tracks || [],
        createdAt: Date.now(),
      };

      // 🔹 Read existing playlists directly from localStorage
      const existingRaw = window.localStorage.getItem("saavnify_playlists");
      let existing = [];
      if (existingRaw) {
        try {
          existing = JSON.parse(existingRaw);
        } catch {
          existing = [];
        }
      }

      const next = [newPl, ...existing];
      window.localStorage.setItem("saavnify_playlists", JSON.stringify(next));
      setPlaylists(next); // keep state in sync

      // Clean URL so import doesn't run again on refresh
      params.delete("import");
      const newUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", newUrl);

      alert(`Playlist "${newPl.name}" imported to your Library`);
    } catch (e) {
      console.error("Failed to import shared playlist:", e);
    }
  }, []);

  // load downloaded track metadata
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saavnify_downloads");
      if (saved) setDownloadedTracks(JSON.parse(saved));
    } catch {
      setDownloadedTracks([]);
    }
  }, []);
  useEffect(() => {
    if (!currentTrack) {
      setTheme(getHashThemeForTrack(null));
      return;
    }

    const fallback = getHashThemeForTrack(currentTrack);
    const imgUrl =
      currentTrack.image_url ||
      currentTrack.image ||
      currentTrack.cover ||
      null;

    // if no image, just use fallback
    if (!imgUrl) {
      setTheme(fallback);
      return;
    }

    let cancelled = false;

    extractThemeFromImage(imgUrl)
      .then((imgTheme) => {
        if (cancelled) return;
        setTheme(imgTheme);
      })
      .catch(() => {
        if (cancelled) return;
        setTheme(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  // online / offline watcher
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // CREATE ROOM (host)
  const createRoom = async () => {
    if (!user || inRoom) return;

    try {
      const firstName = (user.name || user.email || "User").split(" ")[0];
      const roomName = `${firstName}'s Room`;

      const { data: room, error } = await supabase
        .from("rooms")
        .insert({
          name: roomName,
          host_id: user.id,
          is_playing: false,
          current_track: null,
          queue: [],
        })
        .select()
        .single();

      if (error || !room) throw error;

      // UPDATE URL
      const newUrl = `${window.location.pathname}?room=${room.id}`;
      window.history.replaceState(null, "", newUrl);

      // FORCE STATE IMMEDIATELY — this triggers everything
      setRoomId(room.id);
      setRoomState(room); // ← this now lands because subscription is ALREADY active
      setInRoom(true);

      // Add yourself to members
      await supabase.from("room_members").upsert({
        room_id: room.id,
        user_id: user.id,
        user_name: user.name || user.email || "Guest",
        user_avatar: avatarUrl,
      });

      showToast("Room created — you're the DJ!");
    } catch (err) {
      console.error(err);
      alert("Failed to create room");
    }
  };

  // JOIN ROOM (friend + also host when opening via link)
  const joinRoom = async (roomIdToJoin) => {
    if (!user) {
      alert("You need to be logged in to join a room.");
      return;
    }

    try {
      const payload = {
        room_id: roomIdToJoin,
        user_id: user.id,
        user_name: user.name || user.email || "Guest",
        user_avatar: avatarUrl || null,
      };

      // 1️⃣ Try to insert membership row
      const { error: memberError } = await supabase
        .from("room_members")
        .insert(payload);

      // If there's any error other than "duplicate key", log it
      // (code "23505" = unique violation, safe to ignore if you later add a unique constraint)
      if (memberError && memberError.code !== "23505") {
        console.error("room_members insert error:", memberError);
        throw memberError;
      }

      // 2️⃣ Fetch room row
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomIdToJoin)
        .single();

      if (roomError || !room) {
        console.error("rooms select error:", roomError || "Room not found");
        throw roomError || new Error("Room not found");
      }

      setRoomId(roomIdToJoin);
      setInRoom(true);
      setRoomState(room);
    } catch (err) {
      console.error("joinRoom failed:", err);
      alert(
        "Could not join this room. Maybe it was closed or you have no access."
      );
    }
  };

  const leaveRoom = async () => {
    if (!roomId) return;

    if (user?.id) {
      await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }

    setInRoom(false);
    setRoomId(null);
    setRoomState(null);

    // clean room query param
    const params = new URLSearchParams(window.location.search);
    params.delete("room");
    const newUrl =
      window.location.pathname +
      (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", newUrl);
  };
  // Call this whenever you want to auto-join from URL
  const checkUrlAndJoinRoom = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const roomIdFromUrl = params.get("room");
    if (roomIdFromUrl && !inRoom) {
      joinRoom(roomIdFromUrl);
    }
  }, [inRoom]);

  // Run on mount AND when inRoom changes
  useEffect(() => {
    checkUrlAndJoinRoom();
  }, [checkUrlAndJoinRoom]);
  const syncAudioWithRoom = useCallback(
    (room) => {
      setRoomState(room);

      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      }

      if (room.current_track) {
        const track = room.current_track;

        if (!currentTrack || currentTrack.id !== track.id) {
          setCurrentTrack(track);
          audio.src = track.url;
        }

        let pos = 0;
        if (room.started_at) {
          const started = new Date(room.started_at).getTime();
          const now = Date.now();
          pos = Math.max((now - started) / 1000, 0);
        }

        if (!isNaN(pos)) {
          try {
            audio.currentTime = pos;
          } catch (e) {
            console.warn("Failed to set currentTime", e);
          }
        }

        if (room.is_playing) {
          audio
            .play()
            .then(() => {
              setIsPlaying(true);
              setNeedsRoomTap(false);
            })
            .catch((err) => {
              console.warn("Autoplay blocked, need user tap", err);
              setIsPlaying(false);
              setNeedsRoomTap(true);
            });
        } else {
          audio.pause();
          setIsPlaying(false);
        }
      } else {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        setCurrentTrack(null);
        setIsPlaying(false);
        setNeedsRoomTap(false);
      }
    },
    [currentTrack]
  );

  useEffect(() => {
    if (!isYouTube || !currentTrack || currentTrack.source !== "yt") return;

    let playerInstance = null;
    let cancelled = false;

    function startProgressTimer(player) {
      if (ytProgressTimerRef.current) {
        clearInterval(ytProgressTimerRef.current);
      }

      ytProgressTimerRef.current = setInterval(() => {
        if (!player || typeof player.getCurrentTime !== "function") return;

        const t = player.getCurrentTime() || 0;
        const d = player.getDuration();

        if (d && d > 0) {
          setProgress((t / d) * 100);
        }

        // 🎤 karaoke sync using refs
        const lyrics = syncedLyricsRef.current;
        if (lyrics && lyrics.length > 0) {
          const currentIdx = currentLyricIndexRef.current;

          const idx = lyrics.findIndex((line, i) => {
            const nextTime =
              i === lyrics.length - 1 ? Infinity : lyrics[i + 1].time;
            return t >= line.time && t < nextTime;
          });

          if (idx !== -1 && idx !== currentIdx) {
            setCurrentLyricIndex(idx);
          }
        }
      }, 500);
    }

    function createPlayer() {
      if (cancelled) return;

      playerInstance = new window.YT.Player("yt-player", {
        videoId: currentTrack.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1, // ← YE DAAL
          enablejsapi: 1, // ← YE BHI DAAL (already hai par confirm)
          origin: window.location.origin,
          widget_referrer: window.location.origin, // YE ADD KAR (PWA background ke liye)
          html5: 1, // YE ADD KAR (HTML5 mode force)
          wmode: "transparent", // YE ADD KAR (overlay issues fix)
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            ytPlayerRef.current = e.target;
            if ("mediaSession" in navigator) {
              navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.title,
                artist: currentTrack.singers || "YouTube",
                artwork: [
                  {
                    src: currentTrack.image_url,
                    sizes: "96x96",
                    type: "image/jpeg",
                  },
                  {
                    src: currentTrack.image_url,
                    sizes: "128x128",
                    type: "image/jpeg",
                  },
                  {
                    src: currentTrack.image_url,
                    sizes: "192x192",
                    type: "image/jpeg",
                  },
                  {
                    src: currentTrack.image_url,
                    sizes: "256x256",
                    type: "image/jpeg",
                  },
                  {
                    src: currentTrack.image_url,
                    sizes: "384x384",
                    type: "image/jpeg",
                  },
                  {
                    src: currentTrack.image_url,
                    sizes: "512x512",
                    type: "image/jpeg",
                  },
                ],
              });

              navigator.mediaSession.setActionHandler("play", () =>
                e.target.playVideo()
              );
              navigator.mediaSession.setActionHandler("pause", () =>
                e.target.pauseVideo()
              );
              navigator.mediaSession.setActionHandler("previoustrack", () =>
                playPrev?.()
              );
              navigator.mediaSession.setActionHandler("nexttrack", () =>
                playNext?.()
              );
              navigator.mediaSession.setActionHandler("seekbackward", () =>
                e.target.seekTo(e.target.getCurrentTime() - 10)
              );
              navigator.mediaSession.setActionHandler("seekforward", () =>
                e.target.seekTo(e.target.getCurrentTime() + 10)
              );
            }

            if (ytLastTime > 0) {
              try {
                e.target.seekTo(ytLastTime, true);
              } catch (err) {
                console.warn("Failed to seek YT on resume", err);
              }
            }

            e.target.playVideo();
            setIsPlaying(true);
            startProgressTimer(e.target);
          },
          onStateChange: (e) => {
            if (cancelled) return;

            const state = e.data;

            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);

              // 🔄 keep canvas in sync → play
              if (ytCanvasRef.current) {
                try {
                  ytCanvasRef.current.playVideo();
                } catch (ERR) {
                  console.warn(ERR);
                }
              }
            } else if (
              state === window.YT.PlayerState.PAUSED ||
              state === window.YT.PlayerState.ENDED
            ) {
              setIsPlaying(false);

              // 🔄 keep canvas in sync → pause
              if (ytCanvasRef.current) {
                try {
                  ytCanvasRef.current.pauseVideo();
                } catch (ERR) {
                  console.warn(ERR);
                }
              }
            }

            if (state === window.YT.PlayerState.ENDED) {
              if (repeat) {
                e.target.seekTo(0, true);
                e.target.playVideo();
              } else {
                playNext();
              }
            }
          },
        },
      });
    }

    function onYouTubeIframeAPIReady() {
      if (cancelled) return;
      if (window.YT && window.YT.Player) {
        createPlayer();
      }
    }

    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    } else {
      createPlayer();
    }

    return () => {
      cancelled = true;

      if (ytProgressTimerRef.current) {
        clearInterval(ytProgressTimerRef.current);
        ytProgressTimerRef.current = null;
      }

      if (playerInstance && playerInstance.destroy) {
        playerInstance.destroy();
      }
      ytPlayerRef.current = null;
    };
  }, [isYouTube, currentTrack, repeat, ytLastTime]);

  // 🎥 Canvas background video for YT – loop middle 6 seconds, muted
  useEffect(() => {
    // Only when:
    // - current track is YT
    // - full player is open
    // - canvas mode is ON
    if (
      !isYouTube ||
      !showCanvas ||
      !showPlayer ||
      !currentTrack ||
      currentTrack.source !== "yt"
    ) {
      // Clean up if we leave this state
      if (ytCanvasRef.current) {
        try {
          ytCanvasRef.current.stopVideo?.();
          ytCanvasRef.current.destroy?.();
        } catch (error) {
          console.warn("Failed to destroy YT canvas player", error);
        }
        ytCanvasRef.current = null;
      }
      return;
    }

    if (typeof window === "undefined") return;

    let cancelled = false;
    let loopTimer = null;
    let waitTimer = null;

    function setupLoop(player) {
      const trySetup = () => {
        if (cancelled) return;

        const duration = player.getDuration();
        if (!duration || duration <= 0) {
          setTimeout(trySetup, 500);
          return;
        }

        const mid = duration * 0.4;
        const loopStart = Math.max(mid - 3, 0);
        const loopEnd = Math.min(loopStart + 6, duration);

        player.mute();
        player.seekTo(loopStart, true);
        player.playVideo();

        loopTimer = setInterval(() => {
          if (cancelled) return;
          const t = player.getCurrentTime();
          if (t >= loopEnd) {
            player.seekTo(loopStart, true);
          }
        }, 300);
      };

      trySetup();
    }

    function createCanvasPlayer() {
      if (cancelled) return;

      // Make sure our div is actually in the DOM
      const host = document.getElementById("yt-canvas-player");
      if (!host) {
        console.warn("yt-canvas-player element not found");
        return;
      }

      ytCanvasRef.current = new window.YT.Player("yt-canvas-player", {
        videoId: currentTrack.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          mute: 1,
          loop: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setupLoop(e.target);
          },
          onStateChange: (e) => {
            if (cancelled) return;
            if (e.data === window.YT.PlayerState.ENDED) {
              setupLoop(e.target);
            }
          },
        },
      });
    }

    function ensureApiAndCreate() {
      if (window.YT && window.YT.Player) {
        createCanvasPlayer();
      } else {
        waitTimer = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(waitTimer);
            createCanvasPlayer();
          }
        }, 300);
      }
    }

    ensureApiAndCreate();

    return () => {
      cancelled = true;
      if (waitTimer) {
        clearInterval(waitTimer);
        waitTimer = null;
      }
      if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
      }
      if (ytCanvasRef.current) {
        try {
          ytCanvasRef.current.stopVideo?.();
          ytCanvasRef.current.destroy?.();
        } catch (error) {
          console.warn("Failed to clean YT canvas player", error);
        }
        ytCanvasRef.current = null;
      }
    };
  }, [isYouTube, showCanvas, showPlayer, currentTrack]);

  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const room = payload.new;
          syncAudioWithRoom(room);
        }
      )
      .subscribe();

    const membersChannel = supabase
      .channel(`room-members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from("room_members")
            .select("*")
            .eq("room_id", roomId);
          setRoomMembers(data || []);
        }
      )
      .subscribe();

    supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .then(({ data }) => setRoomMembers(data || []));

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [roomId, syncAudioWithRoom]);

  const currentTrackKey = currentTrack ? trackKey(currentTrack) : null;
  const durationSec = currentTrack?.duration
    ? Math.floor(currentTrack.duration / 1000)
    : undefined;

  // Remember last song we successfully fetched
  const [lyricsCacheKey, setLyricsCacheKey] = useState(null);
  const [lyricsRetryCount, setLyricsRetryCount] = useState(0);
  const MAX_LYRICS_RETRY = 0; // 👈 try total = 3 times

  useEffect(() => {
    if (!currentTrackKey) {
      setLyrics(null);
      setSyncedLyrics(null);
      setLyricsLoading(false);
      setLyricsRetryCount(0);
      return;
    }

    // Already fetched for this track — don’t retry
    if (lyricsCacheKey === currentTrackKey) return;

    setLyrics(null);
    setSyncedLyrics(null);
    setLyricsLoading(true);

    let cancelled = false;

    const fetchLyrics = async () => {
      let foundLyrics = false; // ✅ local flag, not React state

      try {
        const title = currentTrack.title?.trim() || "";
        const artist = currentTrack.singers?.trim() || "";

        /** ---------- LRCLIB (synced) ---------- **/
        try {
          const params = { track_name: title, artist_name: artist };
          if (durationSec) params.duration = durationSec;

          const r = await axios.get("https://lrclib.net/api/get", { params });

          if (!cancelled && r.data?.id) {
            if (r.data.syncedLyrics) {
              const parsed = parseLrc(r.data.syncedLyrics);
              if (parsed && parsed.length) {
                setSyncedLyrics(parsed);
                foundLyrics = true;
              }
            }

            if (!foundLyrics && r.data.plainLyrics) {
              setLyrics(r.data.plainLyrics.trim());
              setSyncedLyrics([]); // make sure we don’t keep old sync
              foundLyrics = true;
            }

            if (foundLyrics) {
              setLyricsCacheKey(currentTrackKey);
              setLyricsRetryCount(0);
              return;
            }
          }
        } catch {
          // ignore and fall through to next provider
        }

        /** ---------- lyrics.ovh (plain) ---------- **/
        try {
          const r = await axios.get(
            `https://api.lyrics.ovh/v1/${artist}/${title}`
          );

          if (!cancelled && r.data?.lyrics) {
            setLyrics(r.data.lyrics.trim());
            setSyncedLyrics([]); // plain text → no sync
            foundLyrics = true;

            setLyricsCacheKey(currentTrackKey);
            setLyricsRetryCount(0);
            return;
          }
        } catch {
          // ignore and fall through to MXM
        }

        /** ---------- MXM (your backend) ---------- **/
        try {
          const r = await axios.get(`${MXM_API}/mxm-lyrics`, {
            params: { title, artist },
          });

          if (!cancelled && r.data?.lyrics) {
            const text = r.data.lyrics.trim();

            // detect if LRC format → has timestamps like [01:23.45]
            const looksLikeLrc = /\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(
              text
            );

            if (looksLikeLrc) {
              const parsed = parseLrc(text);
              if (parsed && parsed.length) {
                setSyncedLyrics(parsed); // 🔥 synced karaoke
                foundLyrics = true;
              } else {
                // looks like LRC but failed to parse → fall back to plain
                setLyrics(text);
                setSyncedLyrics([]);
                foundLyrics = true;
              }
            } else {
              // no timestamps → plain lyrics only
              setLyrics(text);
              setSyncedLyrics([]); // ensure no stale sync
              foundLyrics = true;
            }

            setLyricsCacheKey(currentTrackKey);
            setLyricsRetryCount(0);
            return;
          }
        } catch {
          // ignore
        }

        /** ---------- Final: no lyrics from any source ---------- **/
        if (!cancelled && !foundLyrics) {
          setLyrics(null);
          setSyncedLyrics(null);
        }
      } finally {
        if (!cancelled) {
          setLyricsLoading(false);

          // ⭐ Retry only if nothing found and retries allowed
          if (!foundLyrics && lyricsRetryCount < MAX_LYRICS_RETRY) {
            setTimeout(() => {
              if (!cancelled) {
                setLyricsRetryCount((n) => n + 1);
              }
            }, 4000);
          }
        }
      }
    };

    fetchLyrics();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrackKey,
    durationSec,
    lyricsRetryCount,
    lyricsCacheKey,
    currentTrack,
  ]);

  // ----- LIBRARY LOAD/SAVE -----
  useEffect(() => {
    const saved = localStorage.getItem("saavnify_library");
    if (saved) {
      try {
        setLibrary(JSON.parse(saved));
      } catch {
        setLibrary([]);
      }
    }
  }, []);

  const persistLibrary = (next) => {
    setLibrary(next);
    localStorage.setItem("saavnify_library", JSON.stringify(next));
  };

  const isLiked = (track) => {
    if (!track) return false;
    return library.some(
      (t) =>
        t.id === track.id ||
        ((t.title || "").toLowerCase() === (track.title || "").toLowerCase() &&
          (t.singers || "").toLowerCase() ===
            (track.singers || "").toLowerCase())
    );
  };

  // downloads persistence
  const persistDownloads = (next) => {
    setDownloadedTracks(next);
    localStorage.setItem("saavnify_downloads", JSON.stringify(next));
  };

  const isDownloaded = (track) => {
    const key = trackKey(track);
    return downloadedTracks.some((t) => trackKey(t) === key);
  };

  const toggleLike = (track) => {
    if (!track) return;
    if (isLiked(track)) {
      const next = library.filter(
        (t) =>
          !(
            t.id === track.id ||
            ((t.title || "").toLowerCase() ===
              (track.title || "").toLowerCase() &&
              (t.singers || "").toLowerCase() ===
                (track.singers || "").toLowerCase())
          )
      );
      persistLibrary(next);
    } else {
      persistLibrary([track, ...library]);
    }
  };
  const handleSharePlaylist = (pl) => {
    if (!pl) return;
    const payload = {
      name: pl.name,
      tracks: (pl.tracks || []).map((t) => ({
        id: t.id,
        title: t.title,
        singers: t.singers,
        image_url: t.image_url,
        url: t.url,
      })),
    };

    try {
      const encoded = btoa(JSON.stringify(payload));
      const link = `${window.location.origin}?import=${encodeURIComponent(
        encoded
      )}`;
      navigator.clipboard
        .writeText(link)
        .then(() => alert("Playlist link copied to clipboard!"))
        .catch(() => alert(link));
    } catch (e) {
      console.error(e);
      alert("Unable to generate share link.");
    }
  };

  // ---------- SEARCH SONGS ----------
  const searchSongs = async (qOverride) => {
    const raw = typeof qOverride === "string" ? qOverride : searchQuery || "";
    const q = raw.trim();
    if (!q) return;

    setShowSuggestions(false);

    setLoading(true);

    try {
      // 1️⃣ Call both APIs in parallel
      const [saavnRes, ytRes] = await Promise.allSettled([
        axios.get(`${API}/result/?query=${encodeURIComponent(q)}`),
        axios.get(`${YT_API}/search?q=${encodeURIComponent(q)}`),
      ]);

      let results = [];

      // 🎵 Saavn → adapt + tag
      if (saavnRes.status === "fulfilled") {
        const saavnTracks = adaptSongs(saavnRes.value.data).map((t) => ({
          ...t,
          source: "saavn",
        }));
        results = results.concat(saavnTracks);
      }

      // 🎬 YouTube → normalize fields + image_url
      if (ytRes.status === "fulfilled") {
        const ytRaw = ytRes.value.data || [];

        const ytTracks = ytRaw.map((t) => {
          const videoId = t.id || t.videoId || t.video_id;

          // Always build a high-quality thumbnail from videoId
          const image_url = videoId
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` // 1280x720
            : "https://via.placeholder.com/500?text=YouTube+Track";

          return {
            id: videoId || t.id || Math.random().toString(),
            title: t.title || t.name || "Unknown title",
            singers:
              t.channelTitle || t.channel || t.artist || t.singers || "YouTube",
            image_url,
            url: t.url, // keep whatever audio url your backend gives
            source: "yt",
          };
        });

        results = results.concat(ytTracks);
      }

      // 2️⃣ If both failed, keep your old hardcoded fallback
      if (!results.length) {
        const fallback = [
          {
            id: "1",
            title: "Kesariya",
            singers: "Arijit Singh",
            image_url:
              "https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg",
            url: "https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_320.mp4",
            source: "saavn",
          },
          {
            id: "2",
            title: "Tum Hi Ho",
            singers: "Arijit Singh",
            image_url: "https://c.saavncdn.com/871/Aashiqui-2-2013-500x500.jpg",
            url: "https://aac.saavncdn.com/871/EToxUyFpcwQ_320.mp4",
            source: "saavn",
          },
        ];
        results = fallback;
      }

      // 3️⃣ De-duplicate by title + singers
      const seen = new Set();
      const unique = [];
      for (const t of results) {
        const key = `${(t.title || "").toLowerCase().trim()}|${(t.singers || "")
          .toLowerCase()
          .trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(t);
        }
      }

      setTracks(unique.slice(0, 40));
      setQueue(unique);
    } catch (err) {
      console.error("searchSongs failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 fetch lightweight suggestions (like Spotify style)
  const fetchSuggestions = async (q) => {
    const term = q.trim();
    if (!term) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const [saavnRes, ytRes] = await Promise.allSettled([
        axios.get(`${API}/result/?query=${encodeURIComponent(term)}`),
        axios.get(`${YT_API}/search?q=${encodeURIComponent(term)}`),
      ]);

      let results = [];

      if (saavnRes.status === "fulfilled") {
        const saavnTracks = adaptSongs(saavnRes.value.data).map((t) => ({
          ...t,
          source: "saavn",
        }));
        results = results.concat(saavnTracks);
      }

      if (ytRes.status === "fulfilled") {
        const ytRaw = ytRes.value.data || [];
        const ytTracks = ytRaw.map((t) => {
          const videoId = t.id || t.videoId || t.video_id;
          const image_url = videoId
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : "https://via.placeholder.com/500?text=YouTube+Track";

          return {
            id: videoId || t.id || Math.random().toString(),
            title: t.title || t.name || "Unknown title",
            singers:
              t.channelTitle || t.channel || t.artist || t.singers || "YouTube",
            image_url,
            url: t.url,
            source: "yt",
          };
        });
        results = results.concat(ytTracks);
      }

      // de-dupe
      const seen = new Set();
      const unique = [];
      for (const t of results) {
        const key = `${(t.title || "").toLowerCase().trim()}|${(t.singers || "")
          .toLowerCase()
          .trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(t);
        }
      }

      setSuggestions(unique.slice(0, 8)); // only few like Spotify
      setShowSuggestions(unique.length > 0);
    } catch (err) {
      console.error("fetchSuggestions failed:", err);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };
  // 🔍 Final search submit helper – always hides suggestions
  const submitSearch = (qOverride) => {
    const term =
      typeof qOverride === "string"
        ? qOverride.trim()
        : (searchQuery || "").trim();

    if (!term) return;

    // hide suggestions
    setShowSuggestions(false);
    setSuggestions([]);

    // do NOT refocus on input – just search
    searchSongs(term);
  };

  // typing handler with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // ⛔ skip if input came from suggestion tap
    if (skipNextSuggestionRef.current) {
      skipNextSuggestionRef.current = false;
      return;
    }

    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
    }

    const q = value.trim();

    // clear suggestions if empty
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      lastSuggestionQueryRef.current = "";
      return;
    }

    // 🚀 Minimal length (avoid hammering API)
    if (q.length < 3) {
      return; // no call
    }

    // prevent useless duplicate searches
    if (lastSuggestionQueryRef.current === q) return;

    // debounce → search when typing stops
    suggestionTimerRef.current = setTimeout(() => {
      fetchSuggestions(q);
      lastSuggestionQueryRef.current = q;
    }, 350);
  };

  // click on a suggestion → run full search
  const handleSuggestionClick = (track) => {
    if (!track) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchQuery("");
      return;
    }

    const q = `${track.title || ""} ${track.singers || ""}`.trim();

    // optional: clear or show — choose one behavior
    setSearchQuery("");

    setSuggestions([]);
    setShowSuggestions(false);

    submitSearch(q); // 🔥 IMPORTANT — not searchSongs

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeLyricRef = useRef(null);
  const syncedLyricsRef = useRef(null);
  const currentLyricIndexRef = useRef(0);
  useEffect(() => {
    syncedLyricsRef.current = syncedLyrics;
  }, [syncedLyrics]);

  useEffect(() => {
    currentLyricIndexRef.current = currentLyricIndex;
  }, [currentLyricIndex]);

  useEffect(() => {
    // only auto-scroll when followLyrics is enabled
    if (!followLyrics) return;
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentLyricIndex, followLyrics]);
  const isCurrentDJ =
    inRoom && roomState && user?.id && roomState.current_dj === user.id;
  const isRoomOwner =
    inRoom && roomState && user?.id && roomState.host_id === user.id;
  const canControlRoomPlayback = !inRoom || isRoomOwner;
  // Smooth fade helper for any HTMLAudioElement
  function fadeAudio(audio, { from, to, duration }, onDone) {
    if (!audio) {
      onDone?.();
      return;
    }

    // clear previous fade if active
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    const steps = 20;
    const stepDuration = duration / steps;
    const delta = (to - from) / steps;
    let currentStep = 0;

    audio.volume = from;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;

      let nextVol = audio.volume + delta;
      if (delta > 0) nextVol = Math.min(nextVol, to);
      else nextVol = Math.max(nextVol, to);

      audio.volume = Math.max(0, Math.min(1, nextVol));

      if (currentStep >= steps) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
        audio.volume = Math.max(0, Math.min(1, to));
        onDone?.();
      }
    }, stepDuration);
  }

  // ⏭ Smooth NEXT (Saavn only, YT normal)
  function handleSmoothNext() {
    if (!canControlRoomPlayback) return;

    if (isYouTube) {
      // don’t try crossfade on YT
      playNext?.();
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      playNext?.();
      return;
    }

    fadeAudio(
      audio,
      { from: audio.volume ?? DEFAULT_VOLUME, to: 0, duration: 500 },
      () => {
        audio.volume = DEFAULT_VOLUME;
        playNext?.();
      }
    );
  }

  // ⏮ Smooth PREV (Saavn only, YT normal)
  function handleSmoothPrev() {
    if (!canControlRoomPlayback) return;

    if (isYouTube) {
      playPrev?.();
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      playPrev?.();
      return;
    }

    fadeAudio(
      audio,
      { from: audio.volume ?? DEFAULT_VOLUME, to: 0, duration: 500 },
      () => {
        audio.volume = DEFAULT_VOLUME;
        playPrev?.();
      }
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      searchSongs();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const promo = params.get("promo");

    if (promo === "new_release") {
      // Coming from a push for new releases
      setPlayLatestOnLoad(true);
      // You can tweak this query string for better results
      searchSongs("latest bollywood songs");
    } else {
      // Normal behavior
      searchSongs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playLatestOnLoad) return;
    if (!tracks || tracks.length === 0) return;

    // Auto-play first result
    openPlayer(tracks[0]);
    setPlayLatestOnLoad(false);
  }, [playLatestOnLoad, tracks]);

  const playQueueTrackNow = async (track) => {
    if (!inRoom || !roomId || !roomState) return;

    if (!isRoomOwner && !isCurrentDJ) {
      alert("Only the room owner or current DJ can change the queue playback.");
      return;
    }

    try {
      const currentQueue = Array.isArray(roomState.queue)
        ? [...roomState.queue]
        : [];

      const idx = currentQueue.findIndex((t) => t.id === track.id);
      if (idx === -1) return;

      const [chosen] = currentQueue.splice(idx, 1);

      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("rooms")
        .update({
          current_track: chosen,
          queue: currentQueue,
          is_playing: true,
          started_at: nowIso,
          last_activity: nowIso,
        })
        .eq("id", roomId);

      if (error) throw error;
    } catch (e) {
      console.error("playQueueTrackNow failed", e);
    }
  };

  // ---------- PLAYER CONTROL ----------
  const openPlayer = useCallback(
    async (track, listContext = null) => {
      if (!track || !track.url) return;

      // 🎬 1) YOUTUBE TRACKS
      if (track.source === "yt") {
        if (inRoom) {
          alert(
            "YouTube tracks cannot be played inside rooms 🔐.\nLeave room to listen."
          );
          return;
        }

        // Not in room ➜ local playback allowed
        setYtLastTime(0);
        setProgress(0);
        setVisualMode("cover");
        setShowCanvas(false);

        // Stop normal audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        setIsYouTube(true);
        setCurrentTrack(track);
        setShowPlayer(true);
        setIsPlaying(false);

        // Queue
        setQueue((prev) => {
          if (listContext && listContext.length) {
            const others = listContext.filter((t) => t.id !== track.id);
            return [track, ...others];
          }
          const base = prev.length ? prev : tracks;
          const others = base.filter((t) => t.id !== track.id);
          return [track, ...others];
        });

        return;
      }

      // From here down = normal AUDIO tracks (Saavn etc.)
      // Stop YouTube player if active
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo?.();
          ytPlayerRef.current.stopVideo?.();
        } catch (e) {
          console.warn("Failed to stop YT player on switch", e);
        }
      }

      setIsYouTube(false);
      setShowCanvas(false);

      // 🚪 2) ROOM MODE (shared listening for audio tracks)
      if (inRoom && roomId) {
        // There is already a song playing in this room → treat as "add to queue"
        if (roomState && roomState.current_track) {
          // Only host or current DJ can modify queue
          if (!isRoomOwner && !isCurrentDJ) {
            alert(
              "Only the room host or current DJ can add to queue right now 🎲"
            );
            return;
          }

          try {
            const currentQueue = Array.isArray(roomState.queue)
              ? roomState.queue
              : [];

            const { error } = await supabase
              .from("rooms")
              .update({
                queue: [...currentQueue, track],
                last_activity: new Date().toISOString(),
              })
              .eq("id", roomId);

            if (error) throw error;
          } catch (e) {
            console.error("Add to queue failed", e);
          }

          return;
        }

        // No current_track yet → this is the *first* song of the room
        // 👉 Only the HOST can start the very first song
        if (!isRoomOwner) {
          alert("Only the room owner can start playback in this room.");
          return;
        }

        try {
          const nowIso = new Date().toISOString();

          const nextDj =
            roomMembers && roomMembers.length > 0
              ? roomMembers[Math.floor(Math.random() * roomMembers.length)]
                  .user_id
              : user?.id;

          const { error } = await supabase
            .from("rooms")
            .update({
              current_track: track,
              is_playing: true,
              started_at: nowIso,
              last_activity: nowIso,
              current_dj: nextDj,
            })
            .eq("id", roomId);

          if (error) throw error;
        } catch (e) {
          console.error("Room play failed", e);
        }

        return; // everyone will sync via realtime
      }

      // 🎧 3) NORMAL (non-room) behaviour — local audio playback
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      }

      setCurrentTrack(track);
      setShowPlayer(true);
      audio.src = track.url;

      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });

      setQueue((prev) => {
        if (listContext && listContext.length) {
          const others = listContext.filter((t) => t.id !== track.id);
          return [track, ...others];
        }
        const base = prev.length ? prev : tracks;
        const others = base.filter((t) => t.id !== track.id);
        return [track, ...others];
      });
    },
    [
      inRoom,
      roomId,
      roomState,
      isRoomOwner, // 👈 IMPORTANT: added
      isCurrentDJ,
      roomMembers,
      tracks,
      user?.id,
    ]
  );

  const playNext = useCallback(() => {
    if (!queue.length) return;

    let next;
    if (shuffle && queue.length > 1) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      next = queue[randomIndex];
    } else {
      const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
      const nextIndex = currentIndex === -1 ? 1 : currentIndex + 1;
      next = queue[nextIndex];
    }

    if (next) openPlayer(next);
  }, [queue, shuffle, currentTrack, openPlayer]);

  const playPrev = useCallback(() => {
    if (!queue.length) return;

    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const prev = queue[prevIndex];

    if (prev) openPlayer(prev);
  }, [queue, currentTrack, openPlayer]);

  const handleRoomPlayPause = async () => {
    if (!inRoom || !roomId || !roomState) return;

    // Only the room owner can control playback
    if (!isRoomOwner) {
      alert("Only the room owner can control playback in this room.");
      return;
    }

    const audio = audioRef.current;

    try {
      if (roomState.is_playing) {
        // 🔇 PAUSE — store current position in started_at
        let newStartedAt = roomState.started_at;
        if (audio && !isNaN(audio.currentTime)) {
          const now = Date.now();
          const offsetMs = audio.currentTime * 1000;
          newStartedAt = new Date(now - offsetMs).toISOString();
        }

        const { error } = await supabase
          .from("rooms")
          .update({
            is_playing: false,
            started_at: newStartedAt,
            last_activity: new Date().toISOString(),
          })
          .eq("id", roomId);

        if (error) throw error;
      } else {
        // ▶ RESUME — keep started_at so timeline continues
        const { error } = await supabase
          .from("rooms")
          .update({
            is_playing: true,
            last_activity: new Date().toISOString(),
          })
          .eq("id", roomId);

        if (error) throw error;
      }
    } catch (e) {
      console.error("Room play/pause failed", e);
    }
  };

  const handlePlayPause = useCallback(() => {
    // 🎬 YouTube play/pause
    if (isYouTube) {
      const player = ytPlayerRef.current;

      // If player doesn't exist (full player closed), just open it
      if (!player || !window.YT?.PlayerState) {
        setShowPlayer(true); // this will mount yt-player div and recreate iframe
        return;
      }

      const state = player.getPlayerState();

      if (state === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
        setIsPlaying(false);
      } else {
        player.playVideo();
        setIsPlaying(true);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [isYouTube]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    // If no track or it's a YouTube track → clear media session metadata
    if (!currentTrack || isYouTube) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";

        // Clear action handlers
        ["play", "pause", "previoustrack", "nexttrack"].forEach((action) => {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch (e) {
            console.warn("MediaSession failed:", e);
          }
        });
      } catch (e) {
        console.warn("MediaSession clear failed", e);
      }
      return;
    }

    // Only for Saavn / normal audio tracks
    try {
      // 1️⃣ Set what shows on lockscreen / notification
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || "Unknown title",
        artist: currentTrack.singers || "Unknown artist",
        album: "Saavnify ULTRA",
        artwork: [
          {
            src: currentTrack.image_url,
            sizes: "512x512",
            type: "image/jpeg",
          },
        ],
      });

      // 2️⃣ Set playback state
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      // 3️⃣ Wire hardware / lockscreen buttons
      navigator.mediaSession.setActionHandler("play", () => {
        handlePlayPause();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        handlePlayPause();
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrev();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNext();
      });
    } catch (e) {
      console.warn("MediaSession setup failed", e);
    }
  }, [currentTrack, isYouTube, isPlaying, handlePlayPause, playNext, playPrev]);

  const handleDownloadCurrent = () => {
    if (!currentTrack || !currentTrack.url) return;

    const a = document.createElement("a");
    a.href = currentTrack.url;
    a.download = `${currentTrack.title} - ${currentTrack.singers}.mp3`;
    a.target = "_blank"; // optional: open in new tab
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // mark as downloaded in your own state
    const key = trackKey(currentTrack);
    const filtered = downloadedTracks.filter((t) => trackKey(t) !== key);
    persistDownloads([currentTrack, ...filtered]);
  };

  const handleSeek = async (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.min(Math.max(clickX / rect.width, 0), 1); // clamp 0–1
    // 🎬 YT seeking
    if (isYouTube && ytPlayerRef.current) {
      const player = ytPlayerRef.current;
      const dur = player.getDuration();
      if (!dur) return;
      const newTime = pct * dur;
      player.seekTo(newTime, true);
      setProgress(pct * 100);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = audio.duration ? pct * audio.duration : 0;

    // Always move locally
    audio.currentTime = newTime;
    setProgress(pct * 100);

    // In room & host → broadcast seek
    if (inRoom && roomId && roomState && isRoomOwner) {
      try {
        const now = Date.now();
        const startedAt = new Date(now - newTime * 1000).toISOString();

        const { error } = await supabase
          .from("rooms")
          .update({
            started_at: startedAt,
            last_activity: new Date().toISOString(),
          })
          .eq("id", roomId);

        if (error) throw error;
      } catch (e) {
        console.error("Room seek failed", e);
      }
    }
  };

  const deletePlaylist = (id) => {
    const next = playlists.filter((pl) => pl.id !== id);
    persistPlaylists(next);
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
    }
  };
  const removeTrackFromPlaylist = (playlistId, track) => {
    if (!playlistId || !track) return;

    persistPlaylists(
      playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;

        return {
          ...pl,
          tracks: pl.tracks.filter(
            (t) =>
              !(
                t.id === track.id ||
                ((t.title || "").toLowerCase() ===
                  (track.title || "").toLowerCase() &&
                  (t.singers || "").toLowerCase() ===
                    (track.singers || "").toLowerCase())
              )
          ),
        };
      })
    );
  };

  const addTrackToPlaylist = (playlistId, track) => {
    if (!playlistId || !track) return;

    persistPlaylists(
      playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const exists = pl.tracks.some(
          (t) =>
            t.id === track.id ||
            ((t.title || "").toLowerCase() ===
              (track.title || "").toLowerCase() &&
              (t.singers || "").toLowerCase() ===
                (track.singers || "").toLowerCase())
        );
        return exists ? pl : { ...pl, tracks: [track, ...pl.tracks] };
      })
    );
  };
  const handleHeartClick = () => {
    if (!currentTrack) return;
    const wasLiked = isLiked(currentTrack);
    toggleLike(currentTrack); // existing like logic

    // If it was not liked before, now ask where to save
    if (!wasLiked) {
      setPlaylistModalTrack(currentTrack);
    }
  };

  // ---------- AUDIO EVENTS ----------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isYouTube) return; // nothing to attach for YT

    const onTimeUpdate = () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100 || 0;
      setProgress(pct);

      if (syncedLyrics && syncedLyrics.length > 0) {
        const t = audio.currentTime;
        const idx = syncedLyrics.findIndex((line, i) => {
          const nextTime =
            i === syncedLyrics.length - 1 ? Infinity : syncedLyrics[i + 1].time;
          return t >= line.time && t < nextTime;
        });
        if (idx !== -1 && idx !== currentLyricIndex) {
          setCurrentLyricIndex(idx);
        }
      }

      if (currentTrack) {
        const state = {
          currentTrack,
          queue,
          currentTime: audio.currentTime,
          progress: pct,
        };
        try {
          window.localStorage.setItem(
            "saavnify_playback",
            JSON.stringify(state)
          );
        } catch (err) {
          console.log("Failed to save playback:", err);
        }
      }
    };

    const onEnded = () => {
      if (inRoom && roomId) {
        // 🛡 Only room owner OR current DJ is allowed to advance the queue
        const isRoomOwner = user?.id && roomState?.host_id === user.id;
        const isDj = user?.id && roomState?.current_dj === user.id;

        if (!isRoomOwner && !isDj) {
          // Other members just wait for realtime update
          return;
        }

        // In a room: take first item from shared queue
        (async () => {
          try {
            const { data: room, error } = await supabase
              .from("rooms")
              .select("queue")
              .eq("id", roomId)
              .single();

            if (error) {
              console.error("Failed to load room in onEnded:", error);
              return;
            }

            const queueArr = Array.isArray(room?.queue) ? room.queue : [];

            if (queueArr.length === 0) {
              await supabase
                .from("rooms")
                .update({
                  current_track: null,
                  is_playing: false,
                })
                .eq("id", roomId);
              return;
            }

            const [nextTrack, ...remaining] = queueArr;

            const nowIso = new Date().toISOString();
            const nextDj =
              roomMembers && roomMembers.length > 0
                ? roomMembers[Math.floor(Math.random() * roomMembers.length)]
                    .user_id
                : user?.id || null;

            await supabase
              .from("rooms")
              .update({
                current_track: nextTrack,
                queue: remaining,
                is_playing: true,
                started_at: nowIso,
                last_activity: nowIso,
                current_dj: nextDj,
              })
              .eq("id", roomId);
          } catch (err) {
            console.error("Room onEnded failed", err);
          }
        })();

        return;
      }

      // normal behaviour when not in a room
      if (repeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [
    isYouTube,
    syncedLyrics,
    currentLyricIndex,
    currentTrack,
    queue,
    inRoom,
    roomId,
    roomMembers,
    roomState,
    repeat,
    user,
    playNext,
  ]);

  const particlesInit = async (engine) => {
    await loadFull(engine);
  };

  // 🎨 Premium neon visualizer with reflection (optimized)
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!showPlayer || !canvas) return;

    const ctx = canvas.getContext("2d");
    let frameId;
    let phase = 0;
    let lastTime = 0;
    let prevW = -1;
    let prevH = -1;
    let prevDpr = -1;

    const render = (time = 0, loop = false) => {
      if (loop) {
        frameId = requestAnimationFrame((t) => render(t, true));
      }

      // ~30 FPS cap
      if (loop) {
        const fpsInterval = 1000 / 30;
        if (time - lastTime < fpsInterval) return;
        lastTime = time;
      }

      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 0;
      const height = rect.height || 0;
      if (!width || !height) return;

      const dpr = window.devicePixelRatio || 1;

      // only resize if changed (cheaper)
      if (width !== prevW || height !== prevH || dpr !== prevDpr) {
        prevW = width;
        prevH = height;
        prevDpr = dpr;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // ----- background + glow -----
      ctx.clearRect(0, 0, width, height);

      // dark base
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillRect(0, 0, width, height);

      // soft radial glow behind bars
      const glow = ctx.createRadialGradient(
        width / 2,
        height * 0.6,
        height * 0.1,
        width / 2,
        height * 0.6,
        height * 0.9
      );
      glow.addColorStop(0, theme.secondary);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const barCount = 32; // was 48 – lighter but still dense
      const gap = 2;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      const baseY = height * 0.62;
      const maxMainHeight = height * 0.5;
      const maxReflectHeight = height * 0.24;

      const barGrad = ctx.createLinearGradient(
        0,
        baseY - maxMainHeight,
        0,
        baseY
      );
      barGrad.addColorStop(0, theme.secondary);
      barGrad.addColorStop(1, theme.primary);

      for (let i = 0; i < barCount; i++) {
        const tNorm = i / (barCount - 1);

        const envelope = Math.sin(Math.PI * tNorm) ** 0.9;

        const wave1 = (Math.sin(phase + i * 0.28) + 1) / 2;
        const wave2 = (Math.sin(phase * 0.6 + i * 0.14 + 1.3) + 1) / 2;

        const base = (wave1 * 0.7 + wave2 * 0.3) * envelope;
        const randomPulse = (Math.sin(phase * 2 + i * 0.5) + 1) * 0.02;
        const value = Math.min(1, base + randomPulse);

        const mainHeight = value * maxMainHeight;
        const reflectHeight = value * maxReflectHeight;

        const x = i * (barWidth + gap);
        const topY = baseY - mainHeight;
        const radius = Math.min(8, barWidth / 2);

        // ----- soft shadow behind main bar -----
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = theme.primary;
        ctx.beginPath();
        ctx.moveTo(x, baseY + 3);
        ctx.lineTo(x, topY - 3);
        ctx.lineTo(x + barWidth, topY - 3);
        ctx.lineTo(x + barWidth, baseY + 3);
        ctx.closePath();
        ctx.fill();

        // ----- main bar (rounded, gradient) -----
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, topY + radius);
        ctx.quadraticCurveTo(x, topY, x + radius, topY);
        ctx.lineTo(x + barWidth - radius, topY);
        ctx.quadraticCurveTo(x + barWidth, topY, x + barWidth, topY + radius);
        ctx.lineTo(x + barWidth, baseY);
        ctx.closePath();
        ctx.fill();

        // ----- highlight at the top cap -----
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(
          x + barWidth / 2,
          topY + radius * 0.3,
          barWidth * 0.2,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();

        // ----- reflection (no blur, just gradient) -----
        if (reflectHeight > 2) {
          const refTop = baseY;
          const refBottom = baseY + reflectHeight;

          const refGrad = ctx.createLinearGradient(0, refTop, 0, refBottom);
          refGrad.addColorStop(0, theme.primary);
          refGrad.addColorStop(1, "rgba(0,0,0,0)");

          ctx.globalAlpha = 0.25;
          ctx.fillStyle = refGrad;
          ctx.beginPath();
          ctx.moveTo(x, refTop);
          ctx.lineTo(x, refBottom);
          ctx.lineTo(x + barWidth, refBottom);
          ctx.lineTo(x + barWidth, refTop);
          ctx.closePath();
          ctx.fill();
        }
      }

      // update phase only if looping (playing)
      if (loop) {
        const speed = 0.12; // fixed speed for playing
        phase += speed;
      }
    };

    // draw once (paused OR initial)
    render(0, false);

    // if playing, start animation loop
    if (isPlaying) {
      frameId = requestAnimationFrame((t) => render(t, true));
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPlaying, theme.primary, theme.secondary, showPlayer]);

  // 🎛️ MINI PLAYER VISUALIZER STRIP (polished)
  useEffect(() => {
    const canvas = miniVisualizerCanvasRef.current;

    // only run when mini player is visible and a track exists
    if (!canvas || showPlayer || !currentTrack) return;

    const ctx = canvas.getContext("2d");
    let frameId;
    let phase = 0;

    const render = () => {
      frameId = requestAnimationFrame(render);

      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 0;
      const height = rect.height || 0;
      if (!width || !height) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // background inside pill
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, width, height);

      const barCount = 16;
      const gap = 1;
      const barWidth = (width - gap * (barCount - 1)) / barCount;
      const maxHeight = height * 0.9;
      const baseY = height * 0.95;

      // gradient across bars
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, theme.primary);
      grad.addColorStop(1, theme.secondary);

      for (let i = 0; i < barCount; i++) {
        const t = i / (barCount - 1); // 0..1
        const envelope = Math.sin(Math.PI * t) ** 0.85; // smoother center bump

        const wave1 = (Math.sin(phase + i * 0.42) + 1) / 2;
        const wave2 = (Math.sin(phase * 0.65 + i * 0.22 + 1.4) + 1) / 2;

        const base = (wave1 * 0.7 + wave2 * 0.3) * envelope;
        const random = (Math.sin(phase * 1.9 + i * 0.75) + 1) * 0.02;
        const value = Math.min(1, base + random);

        const barHeight = value * maxHeight;
        const x = i * (barWidth + gap);
        const topY = baseY - barHeight;
        const radius = Math.min(4, barWidth / 2);

        // soft glow bar behind
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = theme.primary;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, topY - 3);
        ctx.lineTo(x + barWidth, topY - 3);
        ctx.lineTo(x + barWidth, baseY);
        ctx.closePath();
        ctx.fill();

        // main bar
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, topY + radius);
        ctx.quadraticCurveTo(x, topY, x + radius, topY);
        ctx.lineTo(x + barWidth - radius, topY);
        ctx.quadraticCurveTo(x + barWidth, topY, x + barWidth, topY + radius);
        ctx.lineTo(x + barWidth, baseY);
        ctx.closePath();
        ctx.fill();

        // subtle highlight cap
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(
          x + barWidth / 2,
          topY + radius * 0.35,
          barWidth * 0.18,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
      }

      // speed: a bit faster when playing, very calm when paused
      const speed = isPlaying ? 0.16 : 0.045;
      phase += speed;
    };

    render();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPlaying, theme.primary, theme.secondary, showPlayer, currentTrack]);

  // ---------- QUEUE (UP NEXT) ----------
  let upNext = [];

  if (inRoom && roomState && Array.isArray(roomState.queue)) {
    // In room: use shared room queue
    upNext = roomState.queue.slice(0, 7);
  } else {
    // Normal local queue
    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    upNext =
      currentIndex >= 0 ? queue.slice(currentIndex + 1, currentIndex + 8) : [];
  }

  // ---------- MOBILE NAV ----------
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "home" || tab === "search" || tab === "library") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // which list to show on grid
  const displayedTracks = (() => {
    // For non-library tabs, just show search results / normal tracks
    if (activeTab !== "library") return tracks;

    // If a specific playlist is selected → show ONLY that playlist's songs
    if (selectedPlaylistId) {
      const pl = playlists.find((pl) => pl.id === selectedPlaylistId);
      return pl?.tracks || [];
    }

    // No playlist selected:
    // Show ONLY liked songs that are NOT in any playlist
    const playlistSongIds = new Set(
      playlists.flatMap((pl) => pl.tracks.map((t) => t.id))
    );

    return library.filter((t) => !playlistSongIds.has(t.id));
  })();

  // ---------- MAIN UI ----------
  return (
    <>
      {/* MAIN PAGE (not full player) */}
      {!showPlayer && (
        <div className="min-h-screen pb-24 bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white">
          {/* Top bar */}
          <header className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-cyan-500 to-emerald-400 flex items-center justify-center font-black text-xl">
                S
              </div>
              <div>
                <p className="font-bold leading-tight">Saavnify ULTRA</p>
                <p className="text-xs text-gray-300 hidden sm:block">
                  Hi {user?.name || "there"}, let&apos;s vibe 🎧
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange} // 👈 use global handler
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="Search songs, artists..."
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white w-56
    focus:outline-none focus:border-cyan-500 transition"
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true); // optionally reopen only on focus
                  }
                }}
              />

              <button
                onClick={() => setActiveTab("home")}
                className={`px-3 py-1 rounded-full ${
                  activeTab === "home"
                    ? "bg-white/20 border border-white/40"
                    : "bg-white/10 border border-white/10 hover:bg-white/15"
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`px-3 py-1 rounded-full ${
                  activeTab === "library"
                    ? "bg-white/20 border border-white/40"
                    : "bg-white/10 border border-white/10 hover:bg-white/15"
                }`}
              >
                Library
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`px-3 py-1 rounded-full ${
                  activeTab === "search"
                    ? "bg-white/20 border border-white/40"
                    : "bg-white/10 border border-white/10 hover:bg-white/15"
                }`}
              >
                Search
              </button>

              {/* 🎧 Room controls – desktop */}
              {!inRoom && (
                <button
                  onClick={createRoom}
                  className="px-3 py-1 rounded-full bg-emerald-500/80 hover:bg-emerald-500 text-sm"
                >
                  Create Room
                </button>
              )}

              {inRoom && roomId && (
                <>
                  {/* Any member can share */}
                  <button
                    onClick={shareRoom}
                    className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                  >
                    Share Room
                  </button>

                  {/* All members can leave */}
                  <button
                    onClick={leaveRoom}
                    className="px-3 py-1 rounded-full bg-orange-500/80 hover:bg-orange-500 text-xs"
                  >
                    Leave Room
                  </button>

                  {/* 🔒 Only owner sees End Room */}
                  {roomState?.host_id === user?.id && (
                    <button
                      onClick={handleDeleteRoom}
                      className="px-3 py-1 rounded-full bg-red-500/80 hover:bg-red-500 text-xs font-semibold"
                    >
                      End Room
                    </button>
                  )}
                </>
              )}
              {/* Avatar + name (desktop) – opens Account tab */}
              <button
                type="button"
                onClick={() => setActiveTab("account")}
                className="flex items-center gap-3 mr-2 px-2 py-1 rounded-2xl hover:bg-white/10 transition"
              >
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user?.name || "Avatar"}
                      className="w-9 h-9 rounded-full object-cover border border-white/30"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs">
                      {(user?.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start">
                  <span className="text-xs font-semibold">
                    {user?.name || "Saavnify User"}
                  </span>
                  <span className="text-[10px] text-gray-400 max-w-[120px] truncate">
                    {user?.email}
                  </span>
                </div>
              </button>

              <button
                onClick={performLogout}
                className="px-3 py-1 rounded-full bg-red-500/80 hover:bg-red-500 text-sm"
              >
                Logout
              </button>
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-1 rounded-full bg-emerald-500/80 hover:bg-emerald-500 text-sm"
              >
                Enable Notifications
              </button>
            </div>
          </header>
          {offline && (
            <div className="mx-4 mt-3 mb-2 rounded-2xl bg-yellow-500/10 border border-yellow-400/40 text-yellow-200 text-xs px-4 py-2 flex items-center justify-between">
              <span>
                Offline mode: only downloaded / cached tracks will work.
              </span>
            </div>
          )}

          {/* Hero section (desktop, only for home) */}
          {activeTab === "home" && (
            <section className="hidden md:block px-6 mb-8">
              <div className="max-w-4xl mx-auto p-6 rounded-3xl bg-gradient-to-r from-white/10 via-white/5 to-transparent border border-white/10 backdrop-blur-xl flex items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    Your daily Saavnify mix
                  </h2>
                  <p className="text-gray-200">
                    Fresh Bollywood vibes, hand-picked for you. Search anything
                    and start your journey.
                  </p>
                </div>
                <div className="hidden lg:block w-32 h-32 rounded-full bg-gradient-to-tr from-pink-500 via-cyan-400 to-emerald-400 animate-pulse opacity-80" />
              </div>
            </section>
          )}

          {activeTab === "search" && (
            <SearchScreen
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchSongs={submitSearch} // ✅ use wrapper
              tracks={tracks}
              openPlayer={openPlayer}
              loading={loading}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              onSearchChange={handleSearchChange}
              onSuggestionClick={handleSuggestionClick}
              onManualSearch={() => submitSearch(searchQuery)}
            />
          )}

          {/* LIBRARY EMPTY TEXT */}
          {activeTab === "library" && library.length === 0 && (
            <p className="text-center text-gray-200 mb-4 px-4">
              You haven&apos;t liked any songs yet. Tap the{" "}
              <span className="inline-flex items-center">
                <Heart size={16} className="text-rose-400 mx-1" />
              </span>
              in the player to add songs to your Library.
            </p>
          )}
          {activeTab === "library" && (
            <div className="px-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Your Playlists</h2>
                <button
                  onClick={() => {
                    const name = window.prompt("Playlist name?");
                    if (!name || !name.trim()) return;
                    const id = crypto.randomUUID?.() || Date.now().toString();
                    const newPl = {
                      id,
                      name: name.trim(),
                      tracks: [],
                      createdAt: Date.now(),
                    };
                    persistPlaylists([newPl, ...playlists]);
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
                >
                  + New Playlist
                </button>
              </div>

              {playlists.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No playlists yet. Like a song and add it to a playlist.
                </p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className={`min-w-[150px] rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col justify-between ${
                        selectedPlaylistId === pl.id
                          ? "ring-2 ring-cyan-400"
                          : ""
                      }`}
                    >
                      <button
                        onClick={() =>
                          setSelectedPlaylistId(
                            selectedPlaylistId === pl.id ? null : pl.id
                          )
                        }
                        className="text-left"
                      >
                        <p className="text-sm font-semibold truncate">
                          {pl.name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {pl.tracks.length} songs
                        </p>
                      </button>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <button
                          onClick={() => handleSharePlaylist(pl)}
                          className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                        >
                          <Share2 size={14} /> Share
                        </button>
                        <button
                          onClick={() => deletePlaylist(pl.id)}
                          className="flex items-center gap-1 text-rose-300 hover:text-rose-200"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedPlaylistId && (
                <button
                  onClick={() => setSelectedPlaylistId(null)}
                  className="mt-2 text-xs text-cyan-300 underline"
                >
                  Show liked songs
                </button>
              )}
            </div>
          )}

          {/* GRID OF TRACKS (search OR library) */}

          {activeTab === "account" ? (
            <ProfileScreen
              user={user}
              profileName={profileName}
              setProfileName={setProfileName}
              avatarUrl={avatarUrl}
              avatarUploading={avatarUploading}
              profileSaving={profileSaving}
              onAvatarUpload={handleAvatarUpload}
              onSaveProfile={handleSaveProfile}
              inRoom={inRoom}
              isRoomOwner={isRoomOwner}
              onCreateRoom={createRoom}
              onShareRoom={shareRoom}
              onLeaveRoom={leaveRoom}
              onEndRoom={handleDeleteRoom}
              onLogout={performLogout}
            />
          ) : (
            <div className="px-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-5 md:gap-7 max-w-7xl mx-auto pb-24">
                {displayedTracks.map((track) => (
                  <div
                    key={track.id + track.title}
                    onClick={() => openPlayer(track, displayedTracks)}
                    className="cursor-pointer group relative rounded-3xl overflow-hidden shadow-2xl bg-black/40 border border-white/10 hover:-translate-y-1 hover:scale-[1.02] transition"
                  >
                    {/* existing card content */}
                    <div className="relative w-full aspect-square overflow-hidden">
                      <img
                        src={track.image_url}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <Play size={40} className="text-white drop-shadow-lg" />
                      </div>
                    </div>

                    <p className="mt-3 font-bold text-center truncate px-2 text-sm md:text-base">
                      {track.title}
                    </p>
                    <p className="text-xs md:text-sm text-gray-400 text-center truncate px-2 mb-3">
                      {track.singers}
                    </p>

                    {activeTab === "library" && selectedPlaylistId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackFromPlaylist(selectedPlaylistId, track);
                        }}
                        className="mb-3 -mt-1 mx-auto text-[11px] flex items-center gap-1 text-rose-300 hover:text-rose-200"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MINI PLAYER (BOTTOM) */}
          {currentTrack && !(activeTab === "account" && isMobile) && (
            <div className="fixed bottom-14 md:bottom-4 left-1/2 -translate-x-1/2 w-[96%] md:w-[70%] lg:w-[55%] z-40">
              <div
                className="
        relative w-full
        bg-white/10
        backdrop-blur-xl
        border border-white/20
        rounded-3xl
        shadow-2xl
        overflow-hidden
        px-4 py-3
      "
              >
                {/* 🔊 VISUALIZER BACKGROUND */}
                <canvas
                  ref={miniVisualizerCanvasRef}
                  className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
                />

                {/* FOREGROUND CONTENT */}
                <div className="relative flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setShowPlayer(true)}
                  >
                    <img
                      src={currentTrack.image_url}
                      alt={currentTrack.title}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-2xl object-cover"
                    />
                    <div className="max-w-[140px] sm:max-w-[220px]">
                      <p className="text-xs md:text-sm font-semibold truncate">
                        {currentTrack.title}
                      </p>
                      <p className="text-[11px] md:text-xs text-gray-300 truncate">
                        {currentTrack.singers}
                      </p>
                      <div className="mt-1 w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${progress}%`,
                            background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* ⏮ PREV */}
                    <button
                      onClick={
                        canControlRoomPlayback ? handleSmoothPrev : undefined
                      }
                      disabled={!canControlRoomPlayback}
                      className={`text-gray-200 ${
                        !canControlRoomPlayback
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:scale-110 transition-transform"
                      }`}
                    >
                      <SkipBack size={18} />
                    </button>
                    {/* ▶ / ⏸ */}
                    <button
                      onClick={inRoom ? handleRoomPlayPause : handlePlayPause}
                      disabled={inRoom && !isRoomOwner}
                      className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        inRoom && !isRoomOwner
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:opacity-90"
                      }`}
                      style={{
                        background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                      }}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>

                    {/* ⏭ NEXT */}
                    <button
                      onClick={
                        canControlRoomPlayback ? handleSmoothNext : undefined
                      }
                      disabled={!canControlRoomPlayback}
                      className={`text-gray-200 ${
                        !canControlRoomPlayback
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:scale-110 transition-transform"
                      }`}
                    >
                      <SkipForward size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MOBILE BOTTOM NAV */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 bg-black/80 border-t border-white/10 backdrop-blur-xl flex justify-around py-2 text-xs">
            <button
              onClick={() => handleTabChange("home")}
              className={`flex flex-col items-center gap-0.5 ${
                activeTab === "home" ? "text-cyan-400" : "text-gray-300"
              }`}
            >
              <HomeIcon size={20} />
              <span>Home</span>
            </button>
            <button
              onClick={() => handleTabChange("search")}
              className={`flex flex-col items-center gap-0.5 ${
                activeTab === "search" ? "text-cyan-400" : "text-gray-300"
              }`}
            >
              <SearchIcon size={20} />
              <span>Search</span>
            </button>
            <button
              onClick={() => handleTabChange("library")}
              className={`flex flex-col items-center gap-0.5 ${
                activeTab === "library" ? "text-cyan-400" : "text-gray-300"
              }`}
            >
              <LibraryIcon size={20} />
              <span>Library</span>
            </button>
            <button
              onClick={() => handleTabChange("account")}
              className={`flex flex-col items-center gap-0.5 ${
                activeTab === "account" ? "text-cyan-400" : "text-gray-300"
              }`}
            >
              <User2 size={20} />
              <span>Account</span>
            </button>
          </nav>
          {playlistModalTrack && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
              <div className="bg-zinc-900 rounded-2xl border border-white/15 p-4 w-[90%] max-w-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-lg">Add to playlist</h3>
                  <button
                    onClick={() => setPlaylistModalTrack(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <p className="text-sm text-gray-300 mb-3">
                  {playlistModalTrack.title} — {playlistModalTrack.singers}
                </p>

                {playlists.length === 0 && (
                  <p className="text-sm text-gray-400 mb-3">
                    You don&apos;t have any playlists yet. Create one below.
                  </p>
                )}

                <div className="max-h-40 overflow-y-auto mb-3 space-y-2">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => {
                        addTrackToPlaylist(pl.id, playlistModalTrack);
                        setPlaylistModalTrack(null);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10"
                    >
                      <p className="text-sm font-medium truncate">{pl.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {pl.tracks.length} songs
                      </p>
                    </button>
                  ))}
                </div>

                {/* New playlist inline create */}
                <NewPlaylistForm
                  onCreate={(name) => {
                    const id = crypto.randomUUID?.() || Date.now().toString();
                    const newPl = {
                      id,
                      name: name.trim() || "New Playlist",
                      tracks: playlistModalTrack ? [playlistModalTrack] : [],
                      createdAt: Date.now(),
                    };
                    persistPlaylists([newPl, ...playlists]);
                    setPlaylistModalTrack(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* FULL PLAYER */}
      {showPlayer && currentTrack && (
        <div className="fixed inset-0 bg-black text-white overflow-y-auto relative">
          {isYouTube && showCanvas && (
            <div className="absolute inset-0 z-0 overflow-hidden">
              <div
                id="yt-canvas-player"
                className="w-full h-full object-cover"
                style={{ pointerEvents: "none" }}
              />
              <div className="absolute inset-0 bg-black/35" />
            </div>
          )}

          {/* Background particles – ❌ skip on mobile */}
          {!isMobile && (
            <Particles
              init={particlesInit}
              className="absolute inset-0 -z-10 pointer-events-none"
              options={{
                fullScreen: { enable: false },
                background: { color: "transparent" },
                particles: {
                  number: { value: 80 }, // a bit lighter than 130
                  color: {
                    value: [theme.primary, theme.secondary, theme.accent],
                  },
                  size: { value: { min: 1, max: 3 } },
                  move: { speed: 2, direction: "none" },
                  opacity: { value: 0.35 },
                },
              }}
            />
          )}

          {offline && (
            <div className="absolute left-1/2 -translate-x-1/2 top-16 md:top-6 bg-yellow-500/20 border border-yellow-400/60 text-yellow-100 rounded-full px-4 py-1 text-[11px] z-40 ">
              Offline — streaming may fail, but your downloads are safe.
            </div>
          )}

          <div className="relative min-h-screen flex flex-col md:flex-row items-start md:items-start justify-center md:justify-between px-4 md:px-10 py-6 md:py-10 gap-8 md:gap-12">
            <button
              onClick={() => {
                // For YT, just close the UI. Let the hidden #yt-player keep playing.
                setShowPlayer(false);
              }}
              className="absolute top-4 right-4 md:top-8 md:right-8 z-50 hover:scale-110 transition-transform"
            >
              <X size={34} />
            </button>

            {isYouTube && (
              <button
                onClick={() => setShowCanvas((v) => !v)}
                className="absolute top-4 right-20 md:top-8 md:right-28 z-50 px-4 py-2 rounded-full bg-white/10 border border-white/30 text-xs md:text-sm hover:bg-white/20"
              >
                {showCanvas ? "Music" : "Canvas"}
              </button>
            )}

            {/* LEFT: Visualizer */}
            <div className="flex-1 flex flex-col items-center justify-start pb-10 min-h-[calc(100vh-80px)]">
              {!isYouTube && (
                <button
                  onClick={() => {
                    setVisualMode((m) => (m === "cover" ? "sphere" : "cover"));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="absolute top-4 left-4 md:top-8 md:left-8 z-50 px-4 py-2 rounded-full bg-white/10 border border-white/30 text-xs md:text-sm hover:bg-white/20 transition"
                >
                  {visualMode === "cover"
                    ? "Sphere Visualizer"
                    : "Show Album Cover"}
                </button>
              )}

              <div className="relative w-full flex items-center justify-center h-[260px] md:h-[340px] lg:h-[400px] overflow-hidden">
                {/* Canvas host is ALWAYS here; visibility controlled by showCanvas */}
                <div
                  className={`absolute inset-0 -z-10 transition-opacity duration-500 ${
                    isYouTube && showCanvas
                      ? "opacity-60"
                      : "opacity-0 pointer-events-none"
                  }`}
                >
                  <div id="yt-canvas-player" className="w-full h-full" />
                  {/* dark overlay so controls stay readable */}
                  <div className="absolute inset-0 bg-black/40" />
                </div>

                {isYouTube || visualMode === "cover" ? (
                  <img
                    src={currentTrack.image_url}
                    alt={currentTrack.title}
                    className={`w-56 h-56 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full object-cover ${
                      isPlaying ? "animate-[spin_18s_linear_infinite]" : ""
                    }`}
                    style={{
                      boxShadow: `0 0 30px ${theme.secondary}, 0 0 10px ${theme.primary}`,
                      border: "3px solid rgba(255,255,255,0.25)",
                    }}
                  />
                ) : (
                  // 🌌 Sphere visualizer (only for non-YT + visualMode === "sphere")
                  <div className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80 lg:w-[26rem] lg:h-[26rem]">
                    {!isMobile && (
                      <Particles
                        init={particlesInit}
                        className="absolute inset-0"
                        options={{
                          fullScreen: { enable: false },
                          background: { color: "transparent" },
                          fpsLimit: 60,
                          particles: {
                            number: {
                              value: 260,
                              density: { enable: true, area: 800 },
                            },
                            color: { value: [theme.primary, theme.secondary] },
                            size: { value: { min: 0.5, max: 2 } },
                            opacity: {
                              value: 0.9,
                              animation: {
                                enable: true,
                                speed: 2,
                                minimumValue: 0.2,
                              },
                            },
                            move: {
                              enable: true,
                              speed: isPlaying ? 2.3 : 0.5,
                              direction: "none",
                              outModes: { default: "bounce" },
                              random: true,
                            },
                          },
                        }}
                      />
                    )}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        boxShadow: `0 0 40px ${theme.primary}`,
                        border: `2px solid ${theme.primary}`,
                        animation: isPlaying
                          ? "beat 1.1s ease-in-out infinite"
                          : "none",
                      }}
                    />
                    <div
                      className="absolute inset-6 rounded-full"
                      style={{ border: `1px solid ${theme.secondary}` }}
                    />
                    <div
                      className="relative w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center text-center px-4"
                      style={{
                        background: `
    radial-gradient(
      circle,
      rgba(0,0,0,0.92) 0%,
      rgba(0,0,0,0.75) 50%,
      transparent 100%
    )
  `,
                        border: `2px solid ${theme.primary}`,
                        boxShadow: `
    0 0 35px ${theme.secondary},
    0 0 20px ${theme.primary},
    inset 0 0 18px rgba(255,255,255,0.05)
  `,
                      }}
                    >
                      <p className="text-[10px] md:text-xs uppercase tracking-[0.25em] mb-1 text-gray-300">
                        Now Playing
                      </p>
                      <p className="text-xs md:text-sm font-semibold line-clamp-2">
                        {currentTrack.title}
                      </p>
                      <p className="text-[10px] md:text-xs text-gray-300 line-clamp-2 mt-1">
                        {currentTrack.singers}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col items-center justify-center text-center h-[90px] md:h-[120px]">
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black leading-tight line-clamp-2 px-4">
                  {currentTrack.title}
                </h1>
                <p className="text-lg md:text-xl text-gray-300 line-clamp-1 px-4 mt-1">
                  {currentTrack.singers}
                </p>
              </div>

              {/* Seek bar */}
              <div
                className="w-64 md:w-80 h-2 bg-white/20 rounded-full mt-6 overflow-hidden cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                  }}
                />
              </div>
              {/* 🎧 Premium visualizer (works for Saavn + YT) */}
              <canvas
                ref={visualizerCanvasRef}
                className="mt-5 w-64 md:w-80 h-28 rounded-3xl bg-black/60 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.9)]"
              />

              {/* CONTROLS FIRST */}
              <div
                className={`sticky top-0 pt-6 pb-4 flex flex-col items-center ${
                  isYouTube && showCanvas
                    ? "bg-transparent" // 👈 no big black rectangle on canvas
                    : "bg-black/80 backdrop-blur-lg" // 👈 old style for normal mode
                }`}
              >
                {/* Main transport controls */}
                <div className="flex items-center justify-center gap-6 text-2xl md:text-3xl">
                  {/* ⏮ PREV */}
                  <button
                    onClick={
                      canControlRoomPlayback ? handleSmoothPrev : undefined
                    }
                    disabled={!canControlRoomPlayback}
                    className={
                      "transition-transform " +
                      (!canControlRoomPlayback
                        ? "text-gray-500 opacity-40 cursor-not-allowed"
                        : "text-gray-200 hover:scale-110")
                    }
                  >
                    <SkipBack />
                  </button>

                  {/* ▶ / ⏸ – room uses handleRoomPlayPause, local uses handlePlayPause */}
                  <button
                    onClick={inRoom ? handleRoomPlayPause : handlePlayPause}
                    disabled={inRoom && !isRoomOwner}
                    className={
                      "w-14 md:w-16 h-14 md:h-16 rounded-full flex items-center justify-center shadow-xl transition " +
                      (inRoom && !isRoomOwner
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:opacity-90")
                    }
                    style={{
                      background: `radial-gradient(circle at top, ${theme.primary}, transparent)`,
                      boxShadow: `0 0 40px ${theme.primary}`,
                    }}
                  >
                    {isPlaying ? <Pause size={30} /> : <Play size={30} />}
                  </button>

                  {/* ⏭ NEXT */}
                  <button
                    onClick={
                      canControlRoomPlayback ? handleSmoothNext : undefined
                    }
                    disabled={!canControlRoomPlayback}
                    className={
                      "transition-transform " +
                      (!canControlRoomPlayback
                        ? "text-gray-500 opacity-40 cursor-not-allowed"
                        : "text-gray-200 hover:scale-110")
                    }
                  >
                    <SkipForward />
                  </button>
                </div>

                {/* 🔔 Tap-to-join button for non-host room members */}
                {inRoom && !isRoomOwner && needsRoomTap && (
                  <button
                    onClick={() => {
                      const audio = audioRef.current;
                      if (!audio) return;
                      audio
                        .play()
                        .then(() => {
                          setIsPlaying(true);
                          setNeedsRoomTap(false);
                        })
                        .catch(() => {
                          // still blocked, do nothing
                        });
                    }}
                    className="mt-3 mx-auto block px-4 py-2 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-xs font-semibold"
                  >
                    Tap once to join room audio 🔊
                  </button>
                )}

                {/* Secondary controls (heart, shuffle, download, repeat) */}
                <div className="flex items-center justify-center gap-8 text-xl md:text-2xl">
                  <button
                    onClick={handleHeartClick}
                    className={`transition ${
                      isLiked(currentTrack)
                        ? "text-rose-400"
                        : "text-gray-300 hover:text-rose-300"
                    }`}
                  >
                    <Heart
                      size={24}
                      fill={isLiked(currentTrack) ? "#fb7185" : "none"}
                    />
                  </button>

                  <button
                    onClick={() => setShuffle((s) => !s)}
                    className={`transition ${
                      shuffle ? "text-green-400" : "text-gray-300"
                    }`}
                  >
                    <Shuffle />
                  </button>

                  <button
                    onClick={handleDownloadCurrent}
                    className={`transition ${
                      isDownloaded(currentTrack)
                        ? "text-green-400"
                        : "text-gray-300 hover:text-cyan-400"
                    }`}
                  >
                    <Download size={24} />
                  </button>

                  <button
                    onClick={() => setRepeat((r) => !r)}
                    className={`transition ${
                      repeat ? "text-green-400" : "text-gray-300"
                    }`}
                  >
                    <Repeat />
                  </button>
                </div>
              </div>

              {/* Lyrics / Karaoke */}
              <div className="mt-5 w-full max-w-md h-52 md:h-60 bg-white/5 border border-white/10 rounded-2xl p-4 text-center flex flex-col">
                {/* Header row */}
                <div className="flex items-center justify-between mb-2 text-left">
                  <p className="text-xs font-semibold text-gray-300">Lyrics</p>
                  <button
                    onClick={() => setFollowLyrics((v) => !v)}
                    className={`text-[10px] px-2 py-1 rounded-full border ${
                      followLyrics
                        ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                        : "border-gray-500 text-gray-400 bg-black/30"
                    }`}
                  >
                    {followLyrics ? "Auto-scroll: On" : "Auto-scroll: Off"}
                  </button>
                </div>

                {/* Scrollable area */}
                <div className="flex-1 overflow-y-auto">
                  {lyricsLoading ? (
                    <div className="flex items-center justify-center h-full gap-2">
                      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-gray-400 text-sm">
                        Searching lyrics...
                      </span>
                    </div>
                  ) : syncedLyrics && syncedLyrics.length > 0 ? (
                    syncedLyrics.map((line, i) => (
                      <p
                        key={i}
                        ref={i === currentLyricIndex ? activeLyricRef : null}
                        className={`my-2 transition-all duration-300 ${
                          i === currentLyricIndex
                            ? "text-cyan-300 font-bold text-lg"
                            : i === currentLyricIndex - 1 ||
                              i === currentLyricIndex + 1
                            ? "text-gray-300"
                            : "text-gray-500 text-sm"
                        }`}
                      >
                        {line.text || "♪ ♪ ♪"}
                      </p>
                    ))
                  ) : lyrics ? (
                    lyrics.split("\n").map((l, i) => (
                      <p key={i} className="my-1 text-gray-300">
                        {l || "♪"}
                      </p>
                    ))
                  ) : (
                    <p className="text-gray-500">
                      No lyrics found for this track
                    </p>
                  )}
                </div>
              </div>

              {/* Mini social / comments */}

              <div className="mt-8 w-full max-w-md bg-gradient-to-br from-[#0a0a0f] to-[#0b0c12] border border-white/10 rounded-3xl p-5 pb-6 backdrop-blur-2xl shadow-[0_0_40px_#00000060]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-blue-300 to-purple-500 bg-clip-text text-transparent">
                      Community Vibes
                    </h3>
                    <span className="relative flex">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400"></span>
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-cyan-300 bg-white/10 px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    {(comments[trackKey(currentTrack)] || []).length}{" "}
                    {(comments[trackKey(currentTrack)] || []).length === 1
                      ? "vibe"
                      : "vibes"}
                  </span>
                </div>

                {/* Comments */}
                <div className="space-y-3 mb-4 pr-1">
                  {(comments[trackKey(currentTrack)] || []).length === 0 ? (
                    <div className="text-center py-10 animate-[fadeIn_0.4s_ease-out]">
                      <p className="text-gray-400 text-sm">No vibes yet</p>
                      <p className="text-gray-500 text-xs mt-1">
                        Be the first one ✨
                      </p>
                    </div>
                  ) : (
                    comments[trackKey(currentTrack)].map((c) => (
                      <div
                        key={c.id}
                        className="flex gap-3 animate-[fadeInUp_0.25s_ease-out] [animation-fill-mode:backwards]"
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full overflow-hidden shadow-md bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 flex items-center justify-center">
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt={c.name || "User"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-sm">
                              {(c.name?.charAt(0) || "?").toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Bubble */}
                        <div className="flex-1 bg-black/40 rounded-2xl px-4 py-3 border border-white/5 hover:bg-black/60 hover:border-cyan-400/30 transition-all duration-150">
                          <div className="flex justify-between items-center">
                            <p className="text-cyan-300 font-semibold text-sm">
                              {c.name || "Guest"}
                            </p>
                            <span className="text-[10px] text-gray-500">
                              {new Date(c.created_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-gray-200 text-sm mt-1 leading-snug">
                            {c.text}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 🔥 Input INSIDE the card */}
                <div className="flex items-center gap-3 w-full">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendComment();
                      }
                    }}
                    placeholder="This song hits different when..."
                    className="flex-1 bg-black/30 rounded-2xl px-4 py-3 text-sm border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                  <button
                    onClick={sendComment}
                    disabled={!newComment.trim()}
                    className="px-6 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-600 shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: QUEUE LIST (UP NEXT) */}
            <div className="w-full md:w-72 lg:w-80 bg-black/60 border border-white/10 rounded-3xl p-4 md:p-5 backdrop-blur-xl mt-6 md:mt-0 max-h-[60vh] md:max-h-[70vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-3">Up Next</h2>
              {upNext.length === 0 && (
                <p className="text-sm text-gray-400">
                  No songs in queue. Use shuffle or go back to search.
                </p>
              )}
              <div className="space-y-2">
                {upNext.map((track) => (
                  <button
                    key={track.id + track.title}
                    onClick={
                      inRoom
                        ? isRoomOwner
                          ? () => playQueueTrackNow(track)
                          : undefined
                        : () => openPlayer(track)
                    }
                    className={
                      "w-full flex items-center gap-3 rounded-2xl p-2 text-left " +
                      (inRoom
                        ? isRoomOwner
                          ? "bg-white/5 hover:bg-white/10"
                          : "bg-white/5 opacity-70 cursor-not-allowed"
                        : "bg-white/5 hover:bg-white/10")
                    }
                  >
                    <img
                      src={track.image_url}
                      alt={track.title}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold truncate">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-gray-300 truncate">
                        {track.singers}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Hidden YouTube player – audio only, works for mini player too */}
      {isYouTube && (
        <div className="fixed -z-50 opacity-0 pointer-events-none">
          <div id="yt-player" />
        </div>
      )}

      {/* 🔔 Global in-app toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] max-w-xs bg-black/90 border border-cyan-400/40 rounded-2xl px-4 py-3 shadow-lg">
          <p className="text-xs text-cyan-300 font-semibold mb-1">
            {toast.title || "Notification"}
          </p>
          <p className="text-xs text-gray-200">{toast.body}</p>
        </div>
      )}
    </>
  );
}

// ---------- ROOT APP ----------
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("loading"); // loading | landing | auth | app
  const [authMode, setAuthMode] = useState("signup");

  useEffect(() => {
    let authSub;

    const initAuth = async () => {
      if (typeof window === "undefined") return;

      // 1️⃣ Check existing Supabase session
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user || null;

      if (sessionUser) {
        // 🔹 Fetch profile row for this user (may or may not exist yet)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sessionUser.id)
          .maybeSingle();

        const appUser = {
          id: sessionUser.id,
          email: sessionUser.email,
          name:
            profileData?.name ||
            sessionUser.user_metadata?.name ||
            "Music Lover",
          avatar: profileData?.avatar_url || null,
        };

        // Cache for quick display on reload if you want
        window.localStorage.setItem(
          "saavnify_user_profile",
          JSON.stringify(appUser)
        );

        setUser(appUser);
        setView("app");
      } else {
        setView("landing");
      }

      // 2️⃣ Listen for future login/logout
      const { data: subData } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          const u = session?.user || null;

          if (!u) {
            setUser(null);
            setView("auth");
            return;
          }

          // Fetch profile again whenever auth changes
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", u.id)
            .maybeSingle();

          const loggedUser = {
            id: u.id,
            email: u.email,
            name: profileRow?.name || u.user_metadata?.name || "Music Lover",
            avatar: profileRow?.avatar_url || null,
          };

          window.localStorage.setItem(
            "saavnify_user_profile",
            JSON.stringify(loggedUser)
          );

          setUser(loggedUser);
          setView("app");
        }
      );

      authSub = subData.subscription;
    };

    initAuth();

    return () => {
      if (authSub) authSub.unsubscribe();
    };
  }, []);

  // LOADING SCREEN WHILE WE ASK SUPABASE
  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-sm text-gray-300">Warming up Saavnify ULTRA…</p>
      </div>
    );
  }

  if (view === "landing") {
    return <LandingScreen onGetStarted={() => setView("auth")} />;
  }

  if (view === "auth") {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        onAuthComplete={(u) => {
          setUser(u);
          setView("app");
        }}
      />
    );
  }

  // view === "app"
  return (
    <MusicApp
      user={user}
      onLogout={() => {
        setUser(null);
        setView("auth");
      }}
    />
  );
}
