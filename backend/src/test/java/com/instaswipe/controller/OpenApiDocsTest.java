package com.instaswipe.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/** The security-layer 401/403 responses are added by an OperationCustomizer, so verify they and the
 *  shared ApiError schema actually surface in the generated OpenAPI document. */
class OpenApiDocsTest extends AbstractWebIntegrationTest {

    @Test
    void documentsSecurityErrorResponsesWithApiErrorSchema() {
        User user = userRepository.save(User.builder()
                .email("docs@example.com")
                .passwordHash("x")
                .build());

        ResponseEntity<String> response = client(tokenFor(user)).get().uri("/v3/api-docs")
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        String body = response.getBody();
        assertThat(body).contains("\"401\"");
        assertThat(body).contains("\"403\"");
        assertThat(body).contains("#/components/schemas/ApiError");
        assertThat(body).contains("\"ApiError\"");
    }
}
