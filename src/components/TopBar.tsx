import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchPosts, fetchUnreadCount, markNotificationsRead } from "../services/posts";
import type { Post } from "../types/posts";
import { Bell } from "lucide-react";

const POLL_MS = 90 * 1000;

interface Props {
  onNavigate: (view: string) => void;
}

const TopBar: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<Post[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback((opts?: { silent?: boolean }) => {
    if (!user) return;
    fetchUnreadCount(user.email)
      .then(setUnread)
      .catch(() => {
        if (!opts?.silent) setUnread(0);
      });
  }, [user]);

  useEffect(() => {
    loadCount();
    const t = setInterval(() => loadCount({ silent: true }), POLL_MS);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open && user) {
      fetchPosts(user.email)
        .then((posts) => setRecent(posts.slice(0, 5)))
        .catch(() => {});
    }
  };

  const handleGoToFeed = () => {
    if (user) markNotificationsRead(user.email).catch(() => {});
    setUnread(0);
    setOpen(false);
    onNavigate("inicio");
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}
    >
      <button
        onClick={handleOpen}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: "none",
          cursor: "pointer",
          color: "#fff",
        }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: "#00AA85",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 320,
            background: "#1e2d3d",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "Alexandria, sans-serif" }}>
              Notificaciones
            </span>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {recent.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, padding: "16px 14px" }}>
                Sin publicaciones todavía.
              </p>
            )}
            {recent.map((post) => (
              <button
                key={post.id}
                onClick={handleGoToFeed}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, margin: 0 }}>
                  {post.authorName}
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    margin: "2px 0 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {post.body}
                </p>
              </button>
            ))}
          </div>
          <button
            onClick={handleGoToFeed}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              color: "#00AA85",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ver todo en Inicio
          </button>
        </div>
      )}
    </div>
  );
};

export default TopBar;
