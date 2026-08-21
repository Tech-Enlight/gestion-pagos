import type { Role } from "./auth";

export interface Post {
  id: string;
  authorEmail: string;
  authorName: string;
  authorRole: Role;
  body: string;
  link?: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}
