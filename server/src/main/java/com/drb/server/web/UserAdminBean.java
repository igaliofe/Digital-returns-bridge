package com.drb.server.web;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import com.drb.server.service.UserService;
import jakarta.annotation.PostConstruct;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import java.io.Serializable;
import java.util.List;

@Named
@ViewScoped
public class UserAdminBean implements Serializable {

    @Inject
    private UserService userService;

    private List<User> users;
    private User selected;
    private User newUser;
    private boolean showCreateDialog;

    @PostConstruct
    public void init() {
        loadUsers();
        newUser = new User();
    }

    private void loadUsers() {
        users = userService.findAll();
    }

    public void prepareCreate() {
        newUser = new User();
        showCreateDialog = true;
    }

    public void saveNew() {
        try {
            userService.save(newUser);
            loadUsers();
            showCreateDialog = false;
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "User created", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void saveSelected() {
        try {
            userService.save(selected);
            loadUsers();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "User updated", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void deleteUser(Long id) {
        try {
            userService.delete(id);
            loadUsers();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "User deleted", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public List<User> getUsers() { return users; }
    public User getSelected() { return selected; }
    public void setSelected(User selected) { this.selected = selected; }
    public User getNewUser() { return newUser; }
    public boolean isShowCreateDialog() { return showCreateDialog; }
    public void setShowCreateDialog(boolean showCreateDialog) { this.showCreateDialog = showCreateDialog; }
    public Role[] getRoles() { return Role.values(); }
}
