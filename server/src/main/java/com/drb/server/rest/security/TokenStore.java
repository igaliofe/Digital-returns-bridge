package com.drb.server.rest.security;

import com.drb.server.domain.User;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class TokenStore {

    private final Map<String, User> store = new ConcurrentHashMap<>();

    public String issue(User user) {
        String token = UUID.randomUUID().toString();
        store.put(token, user);
        return token;
    }

    public Optional<User> lookup(String token) {
        if (token == null) return Optional.empty();
        return Optional.ofNullable(store.get(token));
    }

    public void invalidate(String token) {
        if (token != null) store.remove(token);
    }

    public void revoke(String token) {
        invalidate(token);
    }
}
