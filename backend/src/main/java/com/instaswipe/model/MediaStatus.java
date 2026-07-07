package com.instaswipe.model;

/** Lifecycle of an uploaded media object as it moves through the processing queue. */
public enum MediaStatus {
    /** Raw bytes accepted and stored; awaiting resize/re-encode by the worker. */
    PROCESSING,
    /** Final, compressed object written and live. */
    READY,
    /** Processing failed (e.g. the upload was not a decodable image). */
    FAILED
}
