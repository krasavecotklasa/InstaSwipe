package com.instaswipe.exception;

import com.instaswipe.security.JwtAuthenticationFailure;

public class EmailNotVerifiedException extends RuntimeException {

    public EmailNotVerifiedException() {
        super(JwtAuthenticationFailure.EMAIL_NOT_VERIFIED.message());
    }
}
