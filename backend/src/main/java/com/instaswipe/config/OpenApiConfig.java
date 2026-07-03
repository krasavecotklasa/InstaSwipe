package com.instaswipe.config;

import java.util.Map;

import com.instaswipe.exception.ApiError;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_AUTH = "bearerAuth";
    private static final String API_ERROR_SCHEMA = "ApiError";
    private static final String API_ERROR_REF = "#/components/schemas/" + API_ERROR_SCHEMA;

    @Bean
    public OpenAPI instaSwipeOpenApi() {
        OpenAPI openApi = new OpenAPI()
                .info(new Info()
                        .title("InstaSwipe API")
                        .version("v1"))
                .components(new Components()
                        .addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
        registerApiErrorSchema(openApi);
        return openApi;
    }

    /**
     * Documents the 401/403 responses on every operation. They are produced by the security filter
     * chain (see {@code RestAuthenticationEntryPoint} / {@code RestAccessDeniedHandler}), never by a
     * controller signature, so springdoc cannot discover them on its own and they would otherwise be
     * undocumented despite affecting nearly every endpoint.
     */
    @Bean
    public OperationCustomizer securityErrorResponsesCustomizer() {
        return (operation, handlerMethod) -> {
            ApiResponses responses = operation.getResponses();
            responses.addApiResponse("401", apiErrorResponse(
                    "Not authenticated: the access token is missing, expired, or invalid"));
            responses.addApiResponse("403", apiErrorResponse(
                    "Authenticated but lacking permission for this resource"));
            return operation;
        };
    }

    private ApiResponse apiErrorResponse(String description) {
        return new ApiResponse()
                .description(description)
                .content(new Content().addMediaType("application/json",
                        new MediaType().schema(new Schema<>().$ref(API_ERROR_REF))));
    }

    private void registerApiErrorSchema(OpenAPI openApi) {
        Map<String, Schema> schemas = ModelConverters.getInstance().read(ApiError.class);
        schemas.forEach((name, schema) -> openApi.getComponents().addSchemas(name, schema));
    }
}
