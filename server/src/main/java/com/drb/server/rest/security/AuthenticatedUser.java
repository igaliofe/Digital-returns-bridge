package com.drb.server.rest.security;

import com.drb.server.domain.User;
import jakarta.enterprise.context.RequestScoped;

/** Holds the authenticated user for the current HTTP request. */
@RequestScoped
public class AuthenticatedUser {

    private User user;

    public User get() {
        return user;
    }

    public void set(User user) {
        this.user = user;
    }
}
