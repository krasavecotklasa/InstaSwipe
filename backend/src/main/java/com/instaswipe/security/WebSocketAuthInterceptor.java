package com.instaswipe.security;

import com.instaswipe.model.Match;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.service.JwtService;
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

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final MatchRepository matchRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null) {
            if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                List<String> authorization = accessor.getNativeHeader("Authorization");
                if (authorization == null || authorization.isEmpty() || !authorization.get(0).startsWith("Bearer ")) {
                    throw new AccessDeniedException("Missing or invalid Authorization header");
                }

                String token = authorization.get(0).substring(7);
                String userId;
                try {
                    userId = jwtService.extractUserId(token);
                } catch (io.jsonwebtoken.JwtException e) {
                    throw new AccessDeniedException("Invalid JWT Token");
                }
                
                if (userId == null) {
                    throw new AccessDeniedException("Invalid JWT Token");
                }

                accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
            } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                if (accessor.getUser() == null) {
                    throw new AccessDeniedException("Unauthenticated");
                }
                String userId = accessor.getUser().getName();
                String destination = accessor.getDestination();
                
                if (destination != null && destination.contains("/queue/")) {
                    String chatRoomId = extractChatRoomId(destination);
                    verifyUserInMatch(userId, chatRoomId);
                }
            }
        }
        return message;
    }

    private String extractChatRoomId(String destination) {
        String[] parts = destination.split("/");
        return parts[parts.length - 1];
    }

    private void verifyUserInMatch(String userId, String matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> {
                    log.error("WebSocket Subscribe Error: Match '{}' not found in database", matchId);
                    return new AccessDeniedException("Match not found");
                });

        if (!match.getUserOneId().equals(userId) && !match.getUserTwoId().equals(userId)) {
            log.error("WebSocket Subscribe Error: User {} is not a participant of match {}", userId, matchId);
            throw new AccessDeniedException("User is not a participant of this match");
        }
    }
}
