package com.instaswipe.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * JWT configuration bound from the {@code app.jwt.*} properties. The signing
 * secret is REQUIRED and has no default: the app fails to start without it, so
 * no signing key ever ships in code. Set {@code app.jwt.secret} (env var
 * {@code APP_JWT_SECRET}) to a random 32+ byte value in every environment.
 * Only the (non-secret) token lifetimes have defaults.
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        String secret,
        @DefaultValue("15m") Duration accessExpiration,
        @DefaultValue("30d") Duration refreshExpiration) {
}
