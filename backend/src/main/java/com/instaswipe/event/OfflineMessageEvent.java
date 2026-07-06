package com.instaswipe.event;

/** Published to RabbitMQ when a message is persisted for a recipient who is currently offline, to trigger an FCM push. */
public record OfflineMessageEvent(
        String messageId,
        String chatRoomId,
        String senderId,
        String recipientId,
        String content) {
}
