package com.instaswipe.dto;

public record ChatMessageRequest(
        String chatRoomId,
        String senderId,
        String recipientId,
        String content
) {
}
