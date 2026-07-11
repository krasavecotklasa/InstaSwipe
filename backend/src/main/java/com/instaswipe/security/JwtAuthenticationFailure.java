package com.instaswipe.security;

import org.springframework.http.HttpStatus;

/**
 * Why JWT authentication did not succeed for a request. {@link JwtBearerAuthenticationFilter} and
 * {@link EmailVerifiedAuthenticationFilter} stash the reason as a request attribute so
 * {@link RestAuthenticationEntryPoint} can return a matching status and message. Absence of the
 * attribute means no credentials were presented at all.
 */
public enum JwtAuthenticationFailure {

    MISSING(HttpStatus.UNAUTHORIZED, "Authentication is required to access this resource"),
    EXPIRED(HttpStatus.UNAUTHORIZED, "The access token has expired"),
    INVALID(HttpStatus.UNAUTHORIZED, "The access token is invalid"),
    // FORBIDDEN (not UNAUTHORIZED): the caller IS authenticated, just not allowed to proceed yet.
    // Matches the status GlobalExceptionHandler uses for the same condition on login/refresh.
    EMAIL_NOT_VERIFIED(HttpStatus.FORBIDDEN, "Please verify your email before using the app");

    /** Request attribute key under which the active reason is stored. */
    public static final String ATTRIBUTE = JwtAuthenticationFailure.class.getName();

    private final HttpStatus status;
    private final String message;

    JwtAuthenticationFailure(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus status() {
        return status;
    }

    public String message() {
        return message;
    }
}
