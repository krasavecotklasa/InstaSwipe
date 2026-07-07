package com.instaswipe.security;

import java.io.IOException;

import com.instaswipe.exception.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import tools.jackson.databind.ObjectMapper;

/**
 * Returns 403 with an {@link ApiError} body when an authenticated user lacks the permission
 * required for a resource (e.g. a non-admin hitting {@code /api/admin/**}). Distinct from
 * {@link RestAuthenticationEntryPoint}, which handles the unauthenticated (401) case.
 */
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private static final String MESSAGE = "You do not have permission to access this resource";

    // ObjectProvider so the ObjectMapper is resolved lazily at request time; see the note in
    // RestAuthenticationEntryPoint for why eager injection fails at startup.
    private final ObjectProvider<ObjectMapper> objectMapperProvider;

    public RestAccessDeniedHandler(ObjectProvider<ObjectMapper> objectMapperProvider) {
        this.objectMapperProvider = objectMapperProvider;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        SecurityResponseWriter.write(response, objectMapperProvider.getObject(),
                HttpStatus.FORBIDDEN.value(), MESSAGE);
    }
}
