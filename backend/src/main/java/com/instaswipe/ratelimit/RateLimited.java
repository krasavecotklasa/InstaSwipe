package com.instaswipe.ratelimit;

import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@Repeatable(RateLimits.class)
public @interface RateLimited {
    String bucket();
    KeyStrategy keyBy();
    int limit();
    int windowSeconds();
}
