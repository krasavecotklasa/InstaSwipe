package com.instaswipe.security;

/**
 * Why JWT authentication did not succeed for a request. {@link JwtBearerAuthenticationFilter}
 * stashes the reason as a request attribute so {@link RestAuthenticationEntryPoint} can return a
 * specific 401 message. Absence of the attribute means no credentials were presented at all.
 */
public enum JwtAuthenticationFailure {

    MISSING("Authentication is required to access this resource"),
    EXPIRED("The access token has expired"),
    INVALID("The access token is invalid");

    /** Request attribute key under which the active reason is stored. */
    public static final String ATTRIBUTE = JwtAuthenticationFailure.class.getName();

    private final String message;

    JwtAuthenticationFailure(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
