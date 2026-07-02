package com.instaswipe.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * JWT configuration bound from the {@code app.jwt.*} properties. Defaults are
 * provided so the app and tests run without the (gitignored) application.yaml;
 * production MUST override {@code app.jwt.secret} via environment/config.
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        @DefaultValue("dev-only-insecure-secret-change-me-please-32bytes-minimum-key!!") String secret,
        @DefaultValue("15m") Duration accessExpiration,
        @DefaultValue("30d") Duration refreshExpiration) {
}
