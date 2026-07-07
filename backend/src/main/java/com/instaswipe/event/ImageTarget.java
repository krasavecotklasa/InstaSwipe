package com.instaswipe.event;

/** Which owning entity a queued image belongs to, so the worker knows what to update. */
public enum ImageTarget {
    /** The uploader's profile picture (embedded in the User document). */
    PROFILE,
    /** A post's image (a Post document identified by entityId). */
    POST
}
