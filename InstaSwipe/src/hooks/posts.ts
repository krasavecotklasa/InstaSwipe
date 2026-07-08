import { useEffect, useState } from 'react';
import type { Post } from '@/components/post-card';
import { getAccessToken } from '@/hooks/auth';
import { API_BASE_URL, API_PREFIX, POSTS_BASE_PATH } from '@/hooks/api';
import { normalizeMediaUrl } from '@/hooks/media';

interface BackendPostPayload {
  id: string;
  userId: string;
  caption?: string;
  likeCount?: number;
  media?: {
    type?: string;
    url?: string;
    filename?: string;
    size?: number;
  };
  displayName: string;
  profilePictureUrl?: string;
  createdAt: string;
  user?: {
    id?: string;
    username?: string;
    name?: string;
  };
  likedByMe: boolean;
}

const FALLBACK_POSTS: Post[] = [];

export const formatPost = (rawPost: BackendPostPayload | Post): Post => {
  const backendPost = rawPost as BackendPostPayload;

  return {
    id: rawPost.id,
    userId: backendPost.userId ?? 'unknown-user',
    username: backendPost.displayName,
    profilePictureUrl: normalizeMediaUrl(backendPost.profilePictureUrl ?? undefined) ?? undefined,
    caption: backendPost.caption ?? '',
    likes: typeof backendPost.likeCount === 'number' ? backendPost.likeCount : 0,
    media: {
      type: backendPost.media?.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      url: normalizeMediaUrl(backendPost.media?.url ?? undefined) ?? '',
      filename: backendPost.media?.filename ?? 'post-media',
      size: backendPost.media?.size ?? 0,
    },
    likedByMe: backendPost.likedByMe,
    createdAt: new Date(backendPost.createdAt).toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
};

const _likeFunction = async (postId: string, method: string): Promise<Response | null> => {
  try {
    const accessToken = await getAccessToken();
    const response = fetch(`${API_BASE_URL}${POSTS_BASE_PATH}/${postId}/${method}`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
    });

    return response;
  } catch (error) {
    console.warn(`[Posts] Failed to ${method} post`, error);
    return null;
  }
}

export const likePost = async (postId: string) => {
  const res = _likeFunction(postId, "like");
  if (!res) {
     console.warn('[Posts] Failed to like post');
  }
}

export const unlikePost = async (postId: string) => {
  const res = _likeFunction(postId, "unlike");
  if (!res) {
    console.warn('[Posts] Failed to unlike post');
  }
}

const normalizePostsPayload = (payload: unknown): BackendPostPayload[] => {
  if (Array.isArray(payload)) {
    return payload as BackendPostPayload[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.posts)) {
      return record.posts as BackendPostPayload[];
    }

    if (Array.isArray(record.content)) {
      return record.content as BackendPostPayload[];
    }
  }

  return [];
};

export const fetchPosts = async (): Promise<Post[]> => {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/posts`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Posts request failed with status ${response.status}`);
    }

    const data = await response.json();
    const normalized = normalizePostsPayload(data);

    return normalized.map((post) => formatPost(post)).filter((post) => Boolean(post.id));
  } catch (error) {
    console.warn('[Posts] Falling back to mock posts', error);
    return FALLBACK_POSTS;
  }
};

export const fetchPostsByUserId = async (userId: string): Promise<Post[]> => {
  if (!userId) {
    return [];
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/posts/user/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    if (!response.ok) {
      const allPosts = await fetchPosts();
      return allPosts.filter((post) => post.userId === userId);
    }

    const data = await response.json();
    const normalized = normalizePostsPayload(data);

    return normalized.map((post) => formatPost(post)).filter((post) => Boolean(post.id));
  } catch (error) {
    console.warn('[Posts] Unable to fetch posts for user', userId, error);
    return FALLBACK_POSTS.filter((post) => post.userId === userId);
  }
};

export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadPosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextPosts = await fetchPosts();
        if (isActive) {
          setPosts(nextPosts);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Unable to load posts');
          setPosts(FALLBACK_POSTS);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    posts,
    isLoading,
    error,
  };
};
