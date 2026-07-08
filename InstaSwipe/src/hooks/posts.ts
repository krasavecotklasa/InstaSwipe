import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Post } from '@/components/post-card';
import { authorizedFetch, getAccessToken } from '@/hooks/auth';
import { API_BASE_URL, API_PREFIX, POSTS_BASE_PATH } from '@/hooks/api';

// The picker asset carries a local `uri` plus an optional `mimeType`; that's all
// createPost needs to build the multipart part, so we avoid importing the full
// expo-image-picker type here.
export interface NewPostImage {
  uri: string;
  mimeType?: string;
}

export interface NewPostInput {
  caption: string;
  image: NewPostImage | null;
}

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
    profilePictureUrl: backendPost.profilePictureUrl,
    caption: backendPost.caption ?? '',
    likes: typeof backendPost.likeCount === 'number' ? backendPost.likeCount : 0,
    media: {
      type: backendPost.media?.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      url: backendPost.media?.url ?? '',
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
    const response = await authorizedFetch(`${POSTS_BASE_PATH}/${postId}/${method}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
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
    const response = await authorizedFetch(`${API_PREFIX}/posts`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
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

export const fetchFeed = async (): Promise<Post[]> => {
  try {
    const response = await authorizedFetch(`${API_PREFIX}/posts/feed`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }

    const data = await response.json();
    const normalized = normalizePostsPayload(data);

    return normalized.map((post) => formatPost(post)).filter((post) => Boolean(post.id));
  } catch (error) {
    console.warn('[Posts] Unable to fetch feed', error);
    return FALLBACK_POSTS;
  }
};

// Posts authored by a specific user, via GET /api/posts/user/{userId}. Used by the
// profile screen to show the signed-in user's own posts (not the global feed).
export const fetchUserPosts = async (userId: string, page = 0, size = 20): Promise<Post[]> => {
  try {
    const response = await authorizedFetch(`${POSTS_BASE_PATH}/user/${userId}?page=${page}&size=${size}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`User posts request failed with status ${response.status}`);
    }

    const data = await response.json();
    const normalized = normalizePostsPayload(data);

    return normalized.map((post) => formatPost(post)).filter((post) => Boolean(post.id));
  } catch (error) {
    console.warn('[Posts] Unable to fetch user posts', error);
    return FALLBACK_POSTS;
  }
};

export const createPost = async ({ caption, image }: NewPostInput): Promise<Post> => {
  const trimmedCaption = caption.trim();
  if (!trimmedCaption && !image) {
    throw new Error('Add a caption or a photo to share a post.');
  }

  const accessToken = await getAccessToken();
  const url = `${API_BASE_URL}${POSTS_BASE_PATH}`;

  const filename = image ? image.uri.split('/').pop() || 'post.jpg' : '';
  const inferredType = image
    ? image.mimeType || (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
    : '';

  // Native + image: use FileSystem.uploadAsync to sidestep the React Native fetch
  // multipart bug (same workaround the onboarding profile upload relies on).
  if (Platform.OS !== 'web' && image) {
    const FileSystem = await import('expo-file-system/legacy');
    const uploadResult = await FileSystem.uploadAsync(url, image.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: inferredType,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      parameters: { caption: trimmedCaption },
    });

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return formatPost(JSON.parse(uploadResult.body));
    }

    let message = 'Could not share your post';
    try {
      message = JSON.parse(uploadResult.body).message || message;
    } catch {}
    throw new Error(message);
  }

  // Web, or native text-only post.
  const formData = new FormData();
  formData.append('caption', trimmedCaption);

  if (image) {
    if (Platform.OS === 'web') {
      const res = await fetch(image.uri);
      const blob = await res.blob();
      formData.append('file', blob, filename);
    } else {
      formData.append('file', { uri: image.uri, name: filename, type: inferredType } as any);
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Could not share your post');
  }

  return formatPost(await response.json());
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