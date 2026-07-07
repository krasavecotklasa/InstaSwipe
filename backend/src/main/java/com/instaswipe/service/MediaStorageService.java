package com.instaswipe.service;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.ObjectCannedACL;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.time.Duration;

@Service
public class MediaStorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucket;
    private final String publicEndpoint;

    public MediaStorageService(S3Client s3Client,
                          S3Presigner s3Presigner,
                          @Value("${s3.bucket:media}") String bucket,
                          @Value("${s3.public-endpoint:${s3.endpoint}}") String publicEndpoint) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucket = bucket;
        this.publicEndpoint = normalizeEndpoint(publicEndpoint);
    }

    /**
     * Stores bytes under {@code <userId>/<folder>/<uuid><extension>} and returns the
     * stored object key. The folder segment keeps each user's raw uploads, posts, and
     * profile pictures in separate prefixes (e.g. {@code tmp}, {@code posts}, {@code profile}).
     */
    public String upload(byte[] data, String contentType, String extension, String userId, String folder) {
        String key = userId + "/" + folder + "/" + UUID.randomUUID() + extension;

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .acl(ObjectCannedACL.PUBLIC_READ)
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromBytes(data));
        } catch (NoSuchBucketException e) {
            s3Client.createBucket(b -> b.bucket(bucket));
            s3Client.putObject(request, RequestBody.fromBytes(data));
        }

        return key;
    }

    /** Downloads the raw bytes for the given object key. */
    public byte[] download(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();
        return s3Client.getObjectAsBytes(request).asByteArray();
    }

    /** Deletes the given object key. No-op for a null key; S3 delete is idempotent for missing keys. */
    public void delete(String key) {
        if (key == null) {
            return;
        }
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();
        s3Client.deleteObject(request);
    }

    /** Public URL for an already-stored object key. */
    public String publicUrl(String key) {
        return buildPublicUrl(key);
    }

    /**
     * Generates a presigned URL for the given key with a default expiration of 1 hour.
     * The presigned URL points to the original media location and can be used without authentication.
     */
    public String getPresignedUrl(String key) {
        return getPresignedUrl(key, Duration.ofMinutes(5));
    }

    /**
     * Generates a presigned URL for the given key with a custom expiration duration.
     */
    public String getPresignedUrl(String key, Duration expiration) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(expiration)
                .getObjectRequest(getObjectRequest)
                .build();

        PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(presignRequest);
        return presignedRequest.url().toString();
    }

    /**
     * Extracts the object key from a public URL.
     * Converts URLs like "http://localhost:9000/media/userId/uuid.ext" to "userId/uuid.ext"
     * Handles presigned URLs by stripping query parameters first.
     */
    public String extractKeyFromUrl(String publicUrl) {
        if (publicUrl == null || !publicUrl.contains(bucket)) {
            return null;
        }
        // Strip query parameters if present
        String urlWithoutParams = publicUrl.split("\\?")[0];
        
        int bucketIndex = urlWithoutParams.indexOf(bucket);
        int keyStart = bucketIndex + bucket.length() + 1; // +1 for the trailing slash
        if (keyStart < urlWithoutParams.length()) {
            return urlWithoutParams.substring(keyStart);
        }
        return null;
    }

    /**
     * Converts a public URL to a presigned URL.
     * Extracts the key and generates a presigned URL for it.
     */
    public String convertToPresignedUrl(String publicUrl) {
        String key = extractKeyFromUrl(publicUrl);
        if (key != null) {
            return getPresignedUrl(key);
        }
        return publicUrl; // Return original if conversion fails
    }

    /**
     * Safely converts any URL to a presigned URL.
     * If the URL is null or cannot be converted, returns the original URL.
     * Detects already-presigned URLs and skips re-conversion (idempotent).
     */
    public String ensurePresignedUrl(String url) {
        if (url == null) {
            return null;
        }
        // Check if already presigned (has AWS signature parameters)
        if (url.contains("X-Amz-Signature") || url.contains("X-Amz-Algorithm")) {
            return url; // Already presigned, return as-is
        }
        // Only convert if it looks like a public URL pointing to our bucket
        if (url.contains(publicEndpoint) && url.contains(bucket)) {
            return convertToPresignedUrl(url);
        }
        // If it's from a different source, return as-is
        return url;
    }

    private String buildPublicUrl(String key) {
        return String.format("%s/%s/%s", publicEndpoint, bucket, key);
    }

    private static String normalizeEndpoint(String endpoint) {
        if (endpoint.endsWith("/")) {
            return endpoint.substring(0, endpoint.length() - 1);
        }
        return endpoint;
    }
}
