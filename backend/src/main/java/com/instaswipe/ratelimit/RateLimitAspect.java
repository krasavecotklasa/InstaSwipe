package com.instaswipe.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;

@Aspect
@Component
@RequiredArgsConstructor
public class RateLimitAspect {

    private final RateLimiter rateLimiter;

    @Around("@annotation(com.instaswipe.ratelimit.RateLimited) || @annotation(com.instaswipe.ratelimit.RateLimits)")
    public Object enforceRateLimit(ProceedingJoinPoint joinPoint) throws Throwable {

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();

        RateLimited[] annotations = method.getAnnotationsByType(RateLimited.class);

        for (RateLimited rateLimited : annotations) {
            String resolvedValue = resolveKeyValue(rateLimited.keyBy(), joinPoint, method);

            String redisKey = String.format("rl:%s:%s:%s",
                    rateLimited.bucket(),
                    rateLimited.keyBy().name().toLowerCase(),
                    resolvedValue
            );

            RateLimitResult result = rateLimiter.checkAndIncrement(
                    redisKey,
                    rateLimited.limit(),
                    rateLimited.windowSeconds()
            );

            if (!result.allowed()) throw new RateLimitExceededException(result.retryAfterSeconds());
        }

        return joinPoint.proceed();
    }

    private String resolveKeyValue(KeyStrategy strategy, ProceedingJoinPoint joinPoint, Method method) {
        return switch (strategy) {
            case IP -> {
                ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
                HttpServletRequest request = attributes.getRequest();
                yield request.getRemoteAddr();
            }
            case USER -> {
                var auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !auth.isAuthenticated()) {
                    throw new IllegalStateException("Rate limit strategy USER requires an authenticated session context");
                }
                yield auth.getName();
            }
            case EMAIL -> {
                for (Object arg : joinPoint.getArgs()) {
                    if (arg instanceof EmailKeyed emailKeyed) {
                        yield emailKeyed.email();
                    }
                }

                throw new IllegalStateException(String.format(
                        "Wiring Error: Method '%s' specifies EMAIL strategy but no argument implements EmailKeyed.",
                        method.getName())
                );
            }
        };
    }
}
