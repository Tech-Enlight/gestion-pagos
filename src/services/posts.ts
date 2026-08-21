import type { Post } from "../types/posts";

const BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE;

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

export async function fetchPosts(email: string): Promise<Post[]> {
  const res = await fetch(`${BASE}/posts?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error("Error al cargar las publicaciones");
  const data = await safeJson(res);
  return data ?? [];
}

export async function createPost(data: {
  authorEmail: string;
  authorName: string;
  authorRole: string;
  body: string;
  link?: string;
}): Promise<Post> {
  const res = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al publicar");
  return res.json();
}

export async function toggleLike(postId: string, email: string): Promise<void> {
  const res = await fetch(`${BASE}/posts/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, email }),
  });
  if (!res.ok) throw new Error("Error al reaccionar");
}

export async function fetchUnreadCount(email: string): Promise<number> {
  const res = await fetch(`${BASE}/notifications/unread-count?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error("Error al cargar notificaciones");
  const data = await safeJson(res);
  return data?.count ?? 0;
}

export async function markNotificationsRead(email: string, postId?: string): Promise<void> {
  const res = await fetch(`${BASE}/notifications/mark-read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, postId }),
  });
  if (!res.ok) throw new Error("Error al marcar como leído");
}
