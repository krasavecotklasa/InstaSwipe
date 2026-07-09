package com.instaswipe.dto;

public record EmailResponse (
    
    String messageId,
    String status,
    String email,
    String error,
    boolean success
) {}
