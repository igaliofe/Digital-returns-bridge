package com.drb.server.web;

import com.drb.server.domain.Driver;
import com.drb.server.domain.User;
import com.drb.server.service.DriverService;
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
public class DriverAdminBean implements Serializable {

    @Inject private DriverService driverService;
    @Inject private UserService userService;

    private List<Driver> drivers;
    private List<User> users;
    private Driver selected;
    private Driver newDriver;
    // The create dialog binds the user picker to an id, not to a User entity: a
    // selectOneMenu over entities needs a Converter, and without one JSF fails the
    // submit with "null Converter" before saveNew() ever runs.
    private Long newUserId;
    private boolean showCreateDialog;

    @PostConstruct
    public void init() {
        loadDrivers();
        users = userService.findAll();
        newDriver = new Driver();
    }

    private void loadDrivers() {
        drivers = driverService.findAll();
    }

    public void prepareCreate() {
        newDriver = new Driver();
        newUserId = null;
        showCreateDialog = true;
    }

    public void saveNew() {
        try {
            newDriver.setUser(userService.findById(newUserId));
            driverService.save(newDriver);
            loadDrivers();
            newUserId = null;
            showCreateDialog = false;
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Driver created", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void saveSelected() {
        try {
            driverService.save(selected);
            loadDrivers();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Driver updated", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void deleteDriver(Long id) {
        try {
            driverService.delete(id);
            loadDrivers();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Driver deleted", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public List<Driver> getDrivers() { return drivers; }
    public List<User> getUsers() { return users; }
    public Driver getSelected() { return selected; }
    public void setSelected(Driver selected) { this.selected = selected; }
    public Driver getNewDriver() { return newDriver; }
    public Long getNewUserId() { return newUserId; }
    public void setNewUserId(Long newUserId) { this.newUserId = newUserId; }
    public boolean isShowCreateDialog() { return showCreateDialog; }
    public void setShowCreateDialog(boolean showCreateDialog) { this.showCreateDialog = showCreateDialog; }
}
