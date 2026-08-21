import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchPosts, createPost, toggleLike, markNotificationsRead } from "../services/posts";
import type { Post } from "../types/posts";
import { Zap, Send } from "lucide-react";

const CAN_POST_ROLES = ["analista_contable", "admin", "superadmin"];

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
};

const Feed: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [publishing, setPublishing] = useState(false);

  const canPost = !!user && CAN_POST_ROLES.includes(user.role);

  useEffect(() => {
    if (!user) return;
    fetchPosts(user.email)
      .then(setPosts)
      .catch(() => setError("No se pudieron cargar las publicaciones."))
      .finally(() => setLoading(false));
    markNotificationsRead(user.email).catch(() => {});
  }, [user]);

  const handlePublish = async () => {
    if (!user || !body.trim()) return;
    setPublishing(true);
    try {
      const created = await createPost({
        authorEmail: user.email,
        authorName: user.name,
        authorRole: user.role,
        body: body.trim(),
        link: link.trim() || undefined,
      });
      setPosts((prev) => [created, ...prev]);
      setBody("");
      setLink("");
    } catch {
      setError("No se pudo publicar. Intenta de nuevo.");
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (post: Post) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p
      )
    );
    if (!user) return;
    try {
      await toggleLike(post.id, user.email);
    } catch {
      // revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }
            : p
        )
      );
    }
  };

  return (
    <div className="space-y-4" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div>
        <h2 className="text-white text-2xl font-bold mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
          Inicio
        </h2>
        <p className="text-gray-400 text-sm">
          Anuncios y avisos de Finanzas para todo el equipo.
        </p>
      </div>

      {canPost && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "#1e2d3d", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Comparte un aviso con todo el equipo…"
            rows={3}
            className="w-full rounded-lg p-3 text-sm text-white resize-none"
            style={{
              backgroundColor: "#121926",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "Albert Sans, sans-serif",
            }}
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (opcional)"
            className="w-full rounded-lg p-2 mt-2 text-sm text-white"
            style={{
              backgroundColor: "#121926",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "Albert Sans, sans-serif",
            }}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handlePublish}
              disabled={!body.trim() || publishing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: !body.trim() || publishing ? "rgba(0,170,133,0.3)" : "#00AA85",
                color: "#fff",
                fontFamily: "Alexandria, sans-serif",
                cursor: !body.trim() || publishing ? "default" : "pointer",
              }}
            >
              <Send size={14} />
              Publicar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      {loading && <p className="text-gray-400 text-sm">Cargando…</p>}
      {!loading && posts.length === 0 && (
        <p className="text-gray-500 text-sm">Todavía no hay publicaciones.</p>
      )}

      {posts.map((post) => (
        <div
          key={post.id}
          className="rounded-xl border p-4"
          style={{ backgroundColor: "#1e2d3d", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-semibold" style={{ fontFamily: "Alexandria, sans-serif" }}>
              {post.authorName}
            </span>
            <span className="text-gray-500 text-xs">{timeAgo(post.createdAt)}</span>
          </div>
          <p className="text-gray-200 text-sm whitespace-pre-wrap" style={{ fontFamily: "Albert Sans, sans-serif" }}>
            {post.body}
          </p>
          {post.link && (
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm mt-2 inline-block break-all"
              style={{ color: "#00AA85" }}
            >
              {post.link}
            </a>
          )}
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => handleLike(post)}
              className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: post.likedByMe ? "#00AA85" : "rgba(255,255,255,0.5)" }}
            >
              <Zap size={14} fill={post.likedByMe ? "#00AA85" : "none"} />
              {post.likeCount > 0 ? post.likeCount : ""}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Feed;
