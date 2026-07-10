package com.instaswipe.ratelimit;

import org.springframework.stereotype.Component;

@Component
public class RateLimitedTestTarget {

    @RateLimited(bucket = "test-ip", keyBy = KeyStrategy.IP, limit = 2, windowSeconds = 5)
    public String byIp() {
        return "ok";
    }

    @RateLimited(bucket = "test-user", keyBy = KeyStrategy.USER, limit = 2, windowSeconds = 5)
    public String byUser() {
        return "ok";
    }

    @RateLimited(bucket = "test-email", keyBy = KeyStrategy.EMAIL, limit = 2, windowSeconds = 5)
    public String byEmail(TestEmailRequest request) {
        return "ok";
    }

    @RateLimited(bucket = "test-both-ip", keyBy = KeyStrategy.IP, limit = 5, windowSeconds = 5)
    @RateLimited(bucket = "test-both-email", keyBy = KeyStrategy.EMAIL, limit = 2, windowSeconds = 5)
    public String byIpAndEmail(TestEmailRequest request) {
        return "ok";
    }

    public record TestEmailRequest(String email) implements EmailKeyed {
    }
}
