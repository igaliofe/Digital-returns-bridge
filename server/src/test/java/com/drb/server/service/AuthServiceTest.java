package com.drb.server.service;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import com.drb.server.repository.UserRepository;
import com.drb.server.rest.security.TokenStore;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private TokenStore tokenStore;
    @InjectMocks private AuthService authService;

    private User activeUser;

    @BeforeEach
    void setUp() {
        activeUser = new User();
        activeUser.setId(1L);
        activeUser.setPhoneNumber("0501234567");
        activeUser.setFullName("Alice");
        activeUser.setRole(Role.DRIVER);
        activeUser.setActive(true);
    }

    @Test
    void loginHappyPathReturnsToken() {
        when(userRepository.findByPhoneNumber("0501234567")).thenReturn(Optional.of(activeUser));
        when(tokenStore.issue(activeUser)).thenReturn("mock-token");

        String token = authService.login("0501234567");

        assertThat(token).isEqualTo("mock-token");
        verify(tokenStore).issue(activeUser);
    }

    @Test
    void loginInactiveUserThrowsValidationException() {
        activeUser.setActive(false);
        when(userRepository.findByPhoneNumber("0501234567")).thenReturn(Optional.of(activeUser));

        assertThatThrownBy(() -> authService.login("0501234567"))
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining("inactive");
    }

    @Test
    void loginUnknownPhoneThrowsNotFoundException() {
        when(userRepository.findByPhoneNumber("0599999999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login("0599999999"))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void loginBlankPhoneThrowsValidationException() {
        assertThatThrownBy(() -> authService.login("  "))
            .isInstanceOf(ValidationException.class)
            .satisfies(e -> assertThat(((ValidationException) e).getCode()).isEqualTo("PHONE_REQUIRED"));
    }

    @Test
    void loginNullPhoneThrowsValidationException() {
        assertThatThrownBy(() -> authService.login(null))
            .isInstanceOf(ValidationException.class)
            .satisfies(e -> assertThat(((ValidationException) e).getCode()).isEqualTo("PHONE_REQUIRED"));
    }

    @Test
    void logoutInvalidatesToken() {
        authService.logout("some-token");
        verify(tokenStore).invalidate("some-token");
    }
}
