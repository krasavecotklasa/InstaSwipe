package com.instaswipe.service;

import com.instaswipe.dto.StatusResponse;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Backs the public /api/status endpoint. Checks Mongo/RabbitMQ/MinIO in parallel, each capped at
 * {@link #CHECK_TIMEOUT} so a fully-dead dependency can't make the endpoint hang, and caches the
 * result for {@link #CACHE_TTL} so frequent polling (e.g. a TV display refreshing every second)
 * doesn't turn into a real check against every dependency every second.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatusService {

    private static final Duration CHECK_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration CACHE_TTL = Duration.ofSeconds(5);

    private final MongoTemplate mongoTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final S3Client s3Client;

    @Value("${s3.bucket:media}")
    private String bucket;

    private final AtomicReference<CachedStatus> cache = new AtomicReference<>();

    public StatusResponse getStatus() {
        CachedStatus cached = cache.get();
        Instant now = Instant.now();
        if (cached != null && Duration.between(cached.checkedAt(), now).compareTo(CACHE_TTL) < 0) {
            return cached.response();
        }

        CompletableFuture<Boolean> databaseCheck = probe(() -> mongoTemplate.executeCommand(new Document("ping", 1)));
        CompletableFuture<Boolean> messagingCheck = probe(() -> rabbitTemplate.execute(Channel::isOpen));
        CompletableFuture<Boolean> mediaCheck = probe(() ->
                s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build()));

        boolean databaseUp = databaseCheck.join();
        boolean messagingUp = messagingCheck.join();
        boolean mediaUp = mediaCheck.join();

        Map<String, String> components = new LinkedHashMap<>();
        components.put("api", "up");
        components.put("database", databaseUp ? "up" : "down");
        components.put("messaging", messagingUp ? "up" : "down");
        components.put("media", mediaUp ? "up" : "down");

        long downCount = components.values().stream().filter("down"::equals).count();
        String status = downCount == 0 ? "operational" : downCount == 3 ? "major_outage" : "partial_outage";

        StatusResponse response = new StatusResponse(status, components, now);
        cache.set(new CachedStatus(response, now));
        return response;
    }

    private CompletableFuture<Boolean> probe(Runnable action) {
        return CompletableFuture.runAsync(action)
                .handle((ignored, ex) -> {
                    if (ex != null) {
                        log.debug("Status probe failed", ex);
                    }
                    return ex == null;
                })
                .completeOnTimeout(false, CHECK_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private record CachedStatus(StatusResponse response, Instant checkedAt) {}
}
