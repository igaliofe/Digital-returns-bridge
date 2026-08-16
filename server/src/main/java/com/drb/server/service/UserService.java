package com.drb.server.service;

import com.drb.server.domain.User;
import com.drb.server.repository.UserRepository;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;

@ApplicationScoped
public class UserService {

    @Inject
    private UserRepository userRepo;

    public List<User> findAll() {
        return userRepo.findAll();
    }

    public User findById(Long id) {
        User user = userRepo.findById(id);
        if (user == null) throw new NotFoundException("User", id);
        return user;
    }

    @Transactional
    public User create(User user) {
        return userRepo.save(user);
    }

    @Transactional
    public User save(User user) {
        return userRepo.save(user);
    }

    @Transactional
    public User update(Long id, User updates) {
        User existing = findById(id);
        existing.setFullName(updates.getFullName());
        existing.setPhoneNumber(updates.getPhoneNumber());
        existing.setRole(updates.getRole());
        return userRepo.save(existing);
    }

    @Transactional
    public User setActive(Long id, boolean active) {
        User user = findById(id);
        user.setActive(active);
        return userRepo.save(user);
    }

    @Transactional
    /**
     * Hard delete. Deactivating an account is a separate operation — see
     * {@code UserResource#setActive} / {@code PATCH /users/{id}/active}.
     */
    public void delete(Long id) {
        findById(id);
        userRepo.delete(id);
    }
}
