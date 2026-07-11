package com.instaswipe.security;

import com.instaswipe.model.Match;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.JwtService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    /** Session-attribute key under which the access token's expiry ({@link Instant}) is stored at CONNECT. */
    public static final String SESSION_TOKEN_EXPIRY = "tokenExpiry";

    private final JwtService jwtService;
    private final MatchRepository matchRepository;
    private final UserRepository userRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command) || StompCommand.STOMP.equals(command)) {
            // Authenticate once, at connect time, and remember when the token expires.
            authenticateConnect(accessor);
        } else if (command != null && !StompCommand.DISCONNECT.equals(command)) {
            // Every subsequent client frame (SEND, SUBSCRIBE, ...) re-checks that the access token
            // has not expired, giving the WebSocket session the same lifetime as a REST request.
            enforceTokenNotExpired(accessor);

            if (StompCommand.SUBSCRIBE.equals(command)) {
                authorizeSubscription(accessor);
            }
        }
        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        List<String> authorization = accessor.getNativeHeader("Authorization");
        if (authorization == null || authorization.isEmpty() || !authorization.get(0).startsWith("Bearer ")) {
            throw new AccessDeniedException("Missing or invalid Authorization header");
        }

        String token = authorization.get(0).substring(7);
        Claims claims;
        try {
            claims = jwtService.parseClaims(token);
        } catch (io.jsonwebtoken.JwtException e) {
            // Also covers ExpiredJwtException: a token already expired at connect time is rejected here.
            throw new AccessDeniedException("Invalid JWT Token");
        }

        String userId = claims.getSubject();
        if (userId == null) {
            throw new AccessDeniedException("Invalid JWT Token");
        }
        boolean verified = userRepository.findById(userId)
                .map(user -> user.isEmailVerified())
                .orElse(false);
        if (!verified) {
            throw new AccessDeniedException("Please verify your email before using the app");
        }

        accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));

        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null && claims.getExpiration() != null) {
            sessionAttributes.put(SESSION_TOKEN_EXPIRY, claims.getExpiration().toInstant());
        }
    }

    private void enforceTokenNotExpired(StompHeaderAccessor accessor) {
        if (accessor.getUser() == null) {
            throw new AccessDeniedException("Unauthenticated");
        }

        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        Object expiry = sessionAttributes == null ? null : sessionAttributes.get(SESSION_TOKEN_EXPIRY);
        if (expiry instanceof Instant expiresAt && !Instant.now().isBefore(expiresAt)) {
            log.info("WebSocket frame rejected for user {}: access token expired at {}",
                    accessor.getUser().getName(), expiresAt);
            throw new AccessDeniedException("Access token expired");
        }
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        String userId = accessor.getUser().getName();
        String destination = accessor.getDestination();
        if (destination != null && destination.contains("/queue/")) {
            String chatRoomId = extractChatRoomId(destination);
            verifyUserInMatch(userId, chatRoomId);
        }
    }

    private String extractChatRoomId(String destination) {
        String[] parts = destination.split("/");
        return parts[parts.length - 1];
    }

    private void verifyUserInMatch(String userId, String matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> {
                    log.warn("WebSocket subscribe rejected for user {}: match {} not found", userId, matchId);
                    return new AccessDeniedException("User is not a participant of this match");
                });

        if (!match.getUserOneId().equals(userId) && !match.getUserTwoId().equals(userId)) {
            log.warn("WebSocket subscribe rejected for user {}: not a participant of match {}", userId, matchId);
            throw new AccessDeniedException("User is not a participant of this match");
        }
    }
}
