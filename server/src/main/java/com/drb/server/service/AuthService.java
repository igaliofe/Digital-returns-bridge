package com.drb.server.service;

import com.drb.server.domain.User;
import com.drb.server.repository.UserRepository;
import com.drb.server.rest.security.TokenStore;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class AuthService {

    @Inject
    private UserRepository userRepository;

    @Inject
    private TokenStore tokenStore;

    public String login(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new ValidationException("PHONE_REQUIRED", "Phone number is required");
        }
        User user = userRepository.findByPhoneNumber(phoneNumber)
            .orElseThrow(() -> new NotFoundException("User", phoneNumber));
        if (!user.isActive()) {
            throw new ValidationException("USER_INACTIVE", "User account is inactive");
        }
        return tokenStore.issue(user);
    }

    public User getByToken(String token) {
        return tokenStore.lookup(token)
            .orElseThrow(() -> new NotFoundException("Session", token));
    }

    public void logout(String token) {
        tokenStore.invalidate(token);
    }
}
