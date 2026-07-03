package com.instaswipe.service;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class MediaStorageService {

    private final S3Client s3Client;
    private final String bucket;

    public MediaStorageService(S3Client s3Client,
                          @Value("${s3.bucket:media}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    /**
     * Stores already-processed bytes and returns the public URL. The key is
     * {@code <userId>/<uuid><extension>} so it stays a valid, flat object key.
     */
    public String upload(byte[] data, String contentType, String extension, String userId) {
        String key = userId + "/" + UUID.randomUUID() + extension;

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(data));

        return s3Client.utilities()
                .getUrl(b -> b.bucket(bucket).key(key))
                .toExternalForm();
    }
}
