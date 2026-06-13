package com.drb.server.web;

import com.drb.server.domain.Customer;
import com.drb.server.service.CustomerService;
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
public class CustomerAdminBean implements Serializable {

    @Inject
    private CustomerService customerService;

    private List<Customer> customers;
    private Customer selected;
    private Customer newCustomer;
    private boolean showCreateDialog;

    @PostConstruct
    public void init() {
        loadCustomers();
        newCustomer = new Customer();
    }

    private void loadCustomers() {
        customers = customerService.findAll();
    }

    public void prepareCreate() {
        newCustomer = new Customer();
        showCreateDialog = true;
    }

    public void saveNew() {
        try {
            customerService.save(newCustomer);
            loadCustomers();
            showCreateDialog = false;
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Customer created", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void saveSelected() {
        try {
            customerService.save(selected);
            loadCustomers();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Customer updated", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void deleteCustomer(Long id) {
        try {
            customerService.delete(id);
            loadCustomers();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Customer deleted", null));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public List<Customer> getCustomers() { return customers; }
    public Customer getSelected() { return selected; }
    public void setSelected(Customer selected) { this.selected = selected; }
    public Customer getNewCustomer() { return newCustomer; }
    public boolean isShowCreateDialog() { return showCreateDialog; }
    public void setShowCreateDialog(boolean showCreateDialog) { this.showCreateDialog = showCreateDialog; }
}
