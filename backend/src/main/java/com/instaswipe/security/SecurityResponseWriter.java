package com.instaswipe.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import com.instaswipe.exception.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;

/**
 * Writes an {@link ApiError} JSON body for rejections handled inside the security filter chain,
 * which run before the DispatcherServlet and so never reach {@code GlobalExceptionHandler}.
 */
final class SecurityResponseWriter {

    private SecurityResponseWriter() {
    }

    static void write(HttpServletResponse response, ObjectMapper objectMapper, int status, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(ApiError.of(status, message)));
    }
}
