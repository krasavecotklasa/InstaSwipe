package com.instaswipe.service;

import java.io.IOException;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class MediaStorageService {

    private final S3Client s3Client;
    private final String bucket;

    public MediaStorageService(S3Client s3Client,
                          @Value("${s3.bucket}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    public String upload(MultipartFile file, String usedId) {
        try {
            String contentType = file.getContentType();
            String key = usedId + "/" + contentType + UUID.randomUUID();
            long size = file.getSize();

            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(
                request, 
                RequestBody.fromInputStream(file.getInputStream(), size));
            
            return s3Client.utilities()
                .getUrl(b -> b.bucket(bucket).key(key))
                .toExternalForm();
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload file", e);
        }
    }
}
