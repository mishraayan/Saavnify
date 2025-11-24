import { useState, useRef, useEffect } from "react";
import axios from "axios";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { supabase } from "./lib/supabase";
import {
  Download,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  Shuffle,
  Repeat,
  Search,
  Home as HomeIcon,
  Library as LibraryIcon,
  User2,
  Heart,
  Share2,
  Trash2,
} from "lucide-react";

// Your deployed JioSaavnAPI on Render
const API = "https://rythm-1s3u.onrender.com";

// ---------- THEME UTILS ----------
function getThemeForTrack(track) {
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
      return {
        primary: "#38bdf8",
        secondary: "#a855f7",
        accent: "#22c55e",
      };
    case 1:
      return {
        primary: "#f97316",
        secondary: "#ec4899",
        accent: "#facc15",
      };
    case 2:
      return {
        primary: "#4ade80",
        secondary: "#22d3ee",
        accent: "#22c55e",
      };
    case 3:
    default:
      return {
        primary: "#6366f1",
        secondary: "#0ea5e9",
        accent: "#22c55e",
      };
  }
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
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-900 via-black to-purple-900 flex items-center justify-center">
      <Particles
        init={async (e) => await loadFull(e)}
        options={{
          fullScreen: { enable: false },
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = {
      name: name || "Music Lover",
      email: email || "user@example.com",
    };
    localStorage.setItem("saavnify_user", JSON.stringify(user));
    onAuthComplete(user);
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-cyan-400"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full font-semibold hover:opacity-90 transition"
          >
            {mode === "signup" ? "Sign Up" : "Login"}
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
}) {
  return (
    <div className="px-4 md:px-8 pt-4 md:pt-6 text-white">
      {/* Header */}
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Search</h2>

      {/* Input */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchSongs()}
          className="flex-1 px-6 py-3 md:py-4 rounded-full bg-white/10 border border-white/20
               focus:outline-none focus:border-cyan-400 text-white"
          placeholder="What do you want to listen to?"
        />

        <button
          onClick={() => searchSongs()}
          className="px-6 py-3 md:px-8 bg-gradient-to-r from-green-500 to-cyan-500
              rounded-full font-semibold hover:scale-105 flex items-center gap-2"
        >
          <Search size={20} />
          <span className="hidden sm:block">Search</span>
        </button>
      </div>

      {/* Spotify-style categories */}
      <h3 className="text-lg font-semibold mb-3">Trending</h3>
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          "Arijit Singh",
          "Bollywood Hits",
          "LoFi",
          "KK",
          "Sidhu Moose Wala",
          "EDM",
          "Workout",
          "Sad",
        ].map((tag) => (
          <button
            key={tag}
            onClick={() => {
              setSearchQuery(tag);
              searchSongs();
            }}
            className="px-4 py-2 rounded-full bg-white/10 border border-white/15 hover:bg-white/20"
          >
            {tag}
          </button>
        ))}
      </div>
      {/* 🔥 LOADING INDICATOR GOES HERE */}
      {loading && (
        <div className="flex items-center justify-center mt-2 mb-4">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mr-3" />
          <p className="text-sm text-gray-200">Finding fresh tracks for you…</p>
        </div>
      )}
      {/* Results grid */}
      <h3 className="text-lg font-semibold mb-3">Results</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-5 pb-24">
        {tracks.map((track) => (
          <div
            key={track.id}
            onClick={() => openPlayer(track)}
            className="cursor-pointer bg-white/10 rounded-2xl overflow-hidden hover:bg-white/20 transition"
          >
            <img
              src={track.image_url}
              alt={track.title}
              className="aspect-square object-cover"
            />
            <p className="px-3 pt-2 font-semibold truncate">{track.title}</p>
            <p className="px-3 pb-3 text-xs text-gray-300 truncate">
              {track.singers}
            </p>
          </div>
        ))}
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
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
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

  const audioRef = useRef(new Audio());
  // Restore playback state on load
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

        const audio = audioRef.current;
        audio.src = state.currentTrack.url;
        audio.currentTime = state.currentTime || 0;

        // Do NOT auto-play (browsers block without user gesture)
        setIsPlaying(false);
      }
    } catch (e) {
      console.log("Failed to restore playback:", e);
    }
  }, []);
  // helper to uniquely identify a track (for comments/downloads)
  const trackKey = (track) =>
    track
      ? `${(track.title || "").toLowerCase().trim()}|${(track.singers || "")
          .toLowerCase()
          .trim()}`
      : "";

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
  }, [currentTrack]);

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel("comments-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        (payload) => {
          const newMsg = payload.new;
          setComments((prev) => ({
            ...prev,
            [newMsg.track_key]: [newMsg, ...(prev[newMsg.track_key] || [])],
          }));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [supabase]);

  // Send comment
  const sendComment = async () => {
    const text = newComment.trim();
    if (!text || !currentTrack) return;

    const { error } = await supabase.from("comments").insert({
      track_key: trackKey(currentTrack),
      text,
      name: user?.name || "Guest", // 👈 use signup name here
    });

    if (error) {
      console.error("Comment failed:", error);
    } else {
      setNewComment("");
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
  useEffect(() => {
    if (!currentTrack) {
      setLyrics(null);
      setSyncedLyrics(null);
      setLyricsLoading(false);
      return;
    }

    setLyricsLoading(true);

    const fetchLyrics = async () => {
      const title = currentTrack.title?.trim();
      const artist = currentTrack.singers?.trim();

      // Some tracks have no duration → don’t send duration=0
      const durationSec =
        currentTrack.duration > 0
          ? Math.floor(currentTrack.duration / 1000)
          : undefined;

      if (!title || !artist) {
        setLyrics("Lyrics not available");
        setSyncedLyrics(null);
        return;
      }

      // ─── 1. lrclib – best synced + plain lyrics (free, fast, works for Bollywood)
      try {
        const params = { track_name: title, artist_name: artist };
        if (durationSec) params.duration = durationSec; // ← only add if we have a real value

        const res = await axios.get("https://lrclib.net/api/get", {
          params,
          timeout: 8000,
        });

        if (res.data?.id) {
          const plain = res.data.plainLyrics?.trim();
          const synced = res.data.syncedLyrics?.trim();
          setLyrics(plain || synced || "No lyrics found");
          setSyncedLyrics(synced ? parseLrc(synced) : null);
          return;
        }
      } catch {
        // ignore – just try next source
      }

      // ─── 2. lyrics.ovh – plain lyrics, very reliable fallback
      try {
        const res = await axios.get(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(
            artist
          )}/${encodeURIComponent(title)}`
        );
        setLyrics(res.data.lyrics || "No lyrics found");
        setSyncedLyrics(null);
        return;
      } catch {
        // ignore
      }

      // ─── 3. If everything failed
      setLyrics("Lyrics not available");
      setSyncedLyrics(null);
    };

    fetchLyrics().finally(() => setLyricsLoading(false));
  }, [currentTrack]);

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
    // ✅ Always convert to a safe string before .trim()
    const raw = typeof qOverride === "string" ? qOverride : searchQuery || "";
    const q = raw.trim();
    if (!q) return;
    setLoading(true);

    try {
      const res = await axios.get(
        `${API}/result/?query=${encodeURIComponent(q)}`
      );
      let results = adaptSongs(res.data);

      // Add some extra songs
      if (results.length < 18) {
        try {
          const res2 = await axios.get(
            `${API}/result/?query=${encodeURIComponent("bollywood hits")}`
          );
          const extra = adaptSongs(res2.data);
          results = results.concat(extra);
        } catch (e) {
          console.error("Extra songs fetch error:", e);
        }
      }

      // Deduplicate by title + singers
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
      console.error("API error:", err);
      const fallback = [
        {
          id: "1",
          title: "Kesariya",
          singers: "Arijit Singh",
          image_url:
            "https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg",
          url: "https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_320.mp4",
        },
        {
          id: "2",
          title: "Tum Hi Ho",
          singers: "Arijit Singh",
          image_url: "https://c.saavncdn.com/871/Aashiqui-2-2013-500x500.jpg",
          url: "https://aac.saavncdn.com/871/EToxUyFpcwQ_320.mp4",
        },
      ];
      setTracks(fallback);
      setQueue(fallback);
    } finally {
      setLoading(false); // 👈 stop spinner
    }
  };
  const activeLyricRef = useRef(null);

  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentLyricIndex]);

  useEffect(() => {
    searchSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- PLAYER CONTROL ----------
  const openPlayer = (track) => {
    if (!track || !track.url) return;

    setCurrentTrack(track);
    setShowPlayer(true);

    const audio = audioRef.current;
    audio.src = track.url;
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => console.log("Click play to start"));

    setQueue((prev) => {
      const base = prev.length ? prev : tracks;
      const others = base.filter((t) => t.id !== track.id);
      return [track, ...others];
    });
  };

  const playNext = () => {
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
  };

  const playPrev = () => {
    if (!queue.length) return;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const prev = queue[prevIndex];
    if (prev) openPlayer(prev);
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log("Play blocked:", e));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };
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

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.min(Math.max(clickX / rect.width, 0), 1); // clamp 0–1

    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
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
    const onTimeUpdate = () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100 || 0;
      setProgress(pct);

      // 🔹 karaoke sync if we have timestamps
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

      // Save compact playback state
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
        } catch (e) {
          console.log("Failed to save playback:", e);
        }
      }
    };

    const onEnded = () => {
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
  }, [repeat, queue, currentTrack, shuffle]);

  const particlesInit = async (engine) => {
    await loadFull(engine);
  };

  const theme = getThemeForTrack(currentTrack);

  // ---------- QUEUE (UP NEXT) ----------
  const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
  const upNext =
    currentIndex >= 0 ? queue.slice(currentIndex + 1, currentIndex + 8) : [];

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
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchSongs()}
                placeholder="Search songs, artists..."
                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white w-56
              focus:outline-none focus:border-cyan-500 transition"
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
              <button
                onClick={() => {
                  const audio = audioRef.current;
                  audio.pause();
                  audio.currentTime = 0;
                  setIsPlaying(false);
                  localStorage.removeItem("saavnify_user");
                  onLogout();
                }}
                className="px-3 py-1 rounded-full bg-red-500/80 hover:bg-red-500 text-sm"
              >
                Logout
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

          {/* SEARCH BAR (only in Search tab) */}
          {activeTab === "search" && (
            <SearchScreen
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchSongs={searchSongs}
              tracks={tracks}
              openPlayer={openPlayer}
              loading={loading}
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
          <div className="px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-5 md:gap-7 max-w-7xl mx-auto pb-24">
              {displayedTracks.map((track) => (
                <div
                  key={track.id + track.title}
                  onClick={() => openPlayer(track)}
                  className="cursor-pointer group relative rounded-3xl overflow-hidden shadow-2xl bg-black/40 border border-white/10 hover:-translate-y-1 hover:scale-[1.02] transition"
                >
                  <div className="relative">
                    <img
                      src={track.image_url}
                      alt={track.title}
                      className="w-full aspect-square object-cover group-hover:scale-110 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Play size={40} className="text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <p className="mt-3 font-bold text-center truncate px-2 text-sm md:text-base">
                    {track.title}
                  </p>
                  <p className="text-xs md:text-sm text-gray-400 text-center truncate px-2">
                    {track.singers}
                  </p>

                  {activeTab === "library" && selectedPlaylistId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // don't open player
                        removeTrackFromPlaylist(selectedPlaylistId, track);
                      }}
                      className="mb-3 mt-1 mx-auto text-[11px] flex items-center gap-1 text-rose-300 hover:text-rose-200"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* MINI PLAYER (BOTTOM) */}
          {currentTrack && (
            <div className="fixed bottom-14 md:bottom-4 left-1/2 -translate-x-1/2 w-[96%] md:w-[70%] lg:w-[55%] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
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
                <button
                  onClick={playPrev}
                  className="text-gray-200 hover:scale-110 transition-transform"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-90 transition"
                  style={{
                    background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                  }}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={playNext}
                  className="text-gray-200 hover:scale-110 transition-transform"
                >
                  <SkipForward size={18} />
                </button>
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
              <Search size={20} />
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

          {/* Simple mobile account sheet */}
          {activeTab === "account" && (
            <div className="md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 w-[92%] bg-black/90 border border-white/15 rounded-3xl p-4 text-sm">
              <p className="font-semibold mb-1">
                {user?.name || "Saavnify User"}
              </p>
              <p className="text-gray-300 mb-3">{user?.email}</p>
              <button
                onClick={() => {
                  const audio = audioRef.current;
                  audio.pause();
                  audio.currentTime = 0;
                  setIsPlaying(false);
                  localStorage.removeItem("saavnify_user");
                  onLogout();
                }}
                className="w-full px-3 py-2 rounded-full bg-red-500/90 hover:bg-red-500 text-xs font-semibold"
              >
                Logout
              </button>
              <button
                onClick={subscribeToPush}
                className="w-full px-3 py-2 rounded-full bg-cyan-500/90 hover:bg-cyan-500 text-xs font-semibold mt-2"
              >
                Enable Notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* FULL PLAYER */}
      {showPlayer && currentTrack && (
        <div className="fixed inset-0 bg-black text-white overflow-y-auto">
          {/* Background particles */}
          <Particles
            init={particlesInit}
            options={{
              fullScreen: { enable: true, zIndex: -1 },
              particles: {
                number: { value: 130 },
                color: {
                  value: [theme.primary, theme.secondary, theme.accent],
                },
                size: { value: { min: 1, max: 3 } },
                move: { speed: 2, direction: "none" },
                opacity: { value: 0.35 },
              },
            }}
          />
          {offline && (
            <div className="absolute left-1/2 -translate-x-1/2 top-16 md:top-6 bg-yellow-500/20 border border-yellow-400/60 text-yellow-100 rounded-full px-4 py-1 text-[11px] z-40 ">
              Offline — streaming may fail, but your downloads are safe.
            </div>
          )}

          <div className="relative min-h-screen flex flex-col md:flex-row items-start md:items-start justify-center md:justify-between px-4 md:px-10 py-6 md:py-10 gap-8 md:gap-12">
            <button
              onClick={() => setShowPlayer(false)}
              className="absolute top-4 right-4 md:top-8 md:right-8 z-50 hover:scale-110 transition-transform"
            >
              <X size={34} />
            </button>

            {/* LEFT: Visualizer */}
            <div className="flex-1 flex flex-col items-center justify-start pb-10  ">
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

              {visualMode === "cover" ? (
                <img
                  src={currentTrack.image_url}
                  alt={currentTrack.title}
                  className={`w-56 h-56 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-3xl shadow-4xl border-8 border-white/20 object-cover ${
                    isPlaying ? "animate-[spin_18s_linear_infinite]" : ""
                  }`}
                  style={{ boxShadow: `0 0 90px ${theme.primary}aa` }}
                />
              ) : (
                <div className="mt-[-40px] md:mt-[-56px] lg:mt-[-72px] relative w-64 h-64 md:w-80 md:h-80 lg:w-[26rem] lg:h-[26rem] flex items-center justify-center">
                  <Particles
                    init={particlesInit}
                    className="absolute inset-0"
                    options={{
                      fullScreen: { enable: true},
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
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      boxShadow: `0 0 140px ${theme.primary}aa`,
                      border: `2px solid ${theme.primary}55`,
                      animation: isPlaying
                        ? "beat 1.1s ease-in-out infinite"
                        : "none",
                    }}
                  />
                  <div
                    className="absolute inset-6 rounded-full"
                    style={{ border: `1px solid ${theme.secondary}99` }}
                  />
                  <div
                    className="relative w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center text-center px-4"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)",
                      border: `1px solid ${theme.primary}cc`,
                      boxShadow: `0 0 60px ${theme.secondary}aa`,
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

              <h1 className="text-2xl md:text-4xl lg:text-5xl font-black mt-6 text-center">
                {currentTrack.title}
              </h1>
              <p className="text-lg md:text-xl text-gray-300 text-center">
                {currentTrack.singers}
              </p>

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

              {/* CONTROLS FIRST */}
              <div className="sticky top-0 bg-black/80 backdrop-blur-lg pt-6 pb-4">
                {/* Main transport controls */}
                <div className="flex items-center justify-center gap-6 text-2xl md:text-3xl">
                  <button
                    onClick={playPrev}
                    className="hover:scale-110 transition-transform text-gray-200"
                  >
                    <SkipBack />
                  </button>

                  <button
                    onClick={handlePlayPause}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-xl hover:opacity-90 transition"
                    style={{
                      background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                      boxShadow: `0 0 80px ${theme.primary}aa`,
                    }}
                  >
                    {isPlaying ? <Pause size={30} /> : <Play size={30} />}
                  </button>

                  <button
                    onClick={playNext}
                    className="hover:scale-110 transition-transform text-gray-200"
                  >
                    <SkipForward />
                  </button>
                </div>

                {/* Secondary controls */}
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
              <div className="mt-5 w-full max-w-md h-52 md:h-60 bg-white/5 border border-white/10 rounded-2xl p-4 overflow-y-auto text-center">
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
                      {line.text || "♪"}
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
                <div className="max-h-60 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar">
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 flex items-center justify-center font-bold shadow-md">
                          {(c.name?.charAt(0) || "?").toUpperCase()}
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
                    onClick={() => openPlayer(track)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-white/5 hover:bg-white/10 p-2 text-left"
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
    </>
  );
}

// ---------- ROOT APP ----------
export default function App() {
  // Read localStorage once, BEFORE hooks, to use for initial state
  const savedUserString =
    typeof window !== "undefined"
      ? window.localStorage.getItem("saavnify_user")
      : null;
  const savedUser = savedUserString ? JSON.parse(savedUserString) : null;

  const [user, setUser] = useState(savedUser);
  const [view, setView] = useState(savedUser ? "app" : "landing"); // landing | auth | app
  const [authMode, setAuthMode] = useState("signup");

  // ⛔️ remove the old useEffect completely

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

async function subscribeToPush() {
  if (!("serviceWorker" in navigator)) {
    alert("Browser doesn't support notifications");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Notifications permission denied ❌");
    return;
  }

  const reg = await navigator.serviceWorker.ready;

  // 👇 Replace with your real public VAPID from backend
  const vapidPublicKey = "YOUR_PUBLIC_VAPID_KEY";

  const converted = urlBase64ToUint8Array(vapidPublicKey);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: converted,
  });

  await fetch("/api/save-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });

  alert("🔥 Notifications Enabled!");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
} 
