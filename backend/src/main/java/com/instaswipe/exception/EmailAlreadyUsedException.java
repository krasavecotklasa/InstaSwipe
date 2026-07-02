package com.instaswipe.exception;

public class EmailAlreadyUsedException extends RuntimeException {

    public EmailAlreadyUsedException() {
        // Deliberately generic: does not echo the submitted email back to the caller.
        super("Email is already in use");
    }
}
