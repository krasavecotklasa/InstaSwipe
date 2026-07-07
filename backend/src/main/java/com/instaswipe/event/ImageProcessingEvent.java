package com.instaswipe.event;

/**
 * Published to RabbitMQ after a raw image upload is accepted, to hand the
 * resize/re-encode/finalize work to a background worker.
 *
 * @param rawKey      object key of the raw upload, under {@code <userId>/tmp/...}
 * @param userId      owner of the upload
 * @param target      which entity the finished image attaches to
 * @param entityId    POST target: the postId; PROFILE target: null (owner is the user)
 * @param previousKey key of the image this upload replaces, deleted after a successful
 *                    finalize (PROFILE replacement); null when there is nothing to replace
 */
public record ImageProcessingEvent(
        String rawKey,
        String userId,
        ImageTarget target,
        String entityId,
        String previousKey) {
}
