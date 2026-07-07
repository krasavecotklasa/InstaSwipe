package com.instaswipe.dto;

import com.instaswipe.model.MediaStatus;

/**
 * @param url    raw preview URL while PROCESSING; the final compressed URL once READY
 * @param status where the upload is in the processing pipeline
 */
public record ProfilePictureResponse(String url, MediaStatus status) {
}
