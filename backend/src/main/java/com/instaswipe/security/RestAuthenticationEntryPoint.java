package com.instaswipe.security;

import java.io.IOException;

import com.instaswipe.exception.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import tools.jackson.databind.ObjectMapper;

/**
 * Returns an {@link ApiError} body with the status/message for the recorded
 * {@link JwtAuthenticationFailure} reason (401 by default). Replaces Spring Security's default
 * {@code Http403ForbiddenEntryPoint} (which a stateless, form-login-disabled setup otherwise falls
 * back to), so "not logged in" is a clear 401 rather than an opaque 403.
 */
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    // ObjectProvider (not a direct ObjectMapper) so the bean is resolved lazily at request time:
    // @EnableWebSecurity forces this filter chain to be built before JacksonAutoConfiguration has
    // registered the ObjectMapper bean, so an eager injection fails at startup.
    private final ObjectProvider<ObjectMapper> objectMapperProvider;

    public RestAuthenticationEntryPoint(ObjectProvider<ObjectMapper> objectMapperProvider) {
        this.objectMapperProvider = objectMapperProvider;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        Object reason = request.getAttribute(JwtAuthenticationFailure.ATTRIBUTE);
        JwtAuthenticationFailure failure = reason instanceof JwtAuthenticationFailure resolved
                ? resolved
                : JwtAuthenticationFailure.MISSING;
        SecurityResponseWriter.write(response, objectMapperProvider.getObject(),
                failure.status().value(), failure.message());
    }
}
