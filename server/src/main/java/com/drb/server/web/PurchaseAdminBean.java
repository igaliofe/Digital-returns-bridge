package com.drb.server.web;

import com.drb.server.domain.Customer;
import com.drb.server.domain.CustomerPurchase;
import com.drb.server.domain.Product;
import com.drb.server.service.CustomerPurchaseService;
import com.drb.server.service.CustomerService;
import com.drb.server.service.ProductService;
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
public class PurchaseAdminBean implements Serializable {

    @Inject private CustomerPurchaseService purchaseService;
    @Inject private CustomerService customerService;
    @Inject private ProductService productService;

    private List<CustomerPurchase> purchases;
    private List<Customer> customers;
    private List<Product> products;

    private CustomerPurchase newPurchase;
    // Same reason as DriverAdminBean: a selectOneMenu over entities needs a Converter, and
    // without one JSF fails the submit with "null Converter" before saveNew() ever runs.
    private Long newCustomerId;
    private Long newProductId;

    @PostConstruct
    public void init() {
        loadPurchases();
        customers = customerService.findAll();
        products = productService.findAll();
        newPurchase = new CustomerPurchase();
    }

    private void loadPurchases() {
        purchases = purchaseService.findAll();
    }

    public void prepareCreate() {
        newPurchase = new CustomerPurchase();
        newPurchase.setQuantity(1);
        newCustomerId = null;
        newProductId = null;
    }

    public void saveNew() {
        try {
            purchaseService.create(newCustomerId, newProductId, newPurchase);
            loadPurchases();
            prepareCreate();
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Purchase created", ""));
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public List<CustomerPurchase> getPurchases() { return purchases; }
    public List<Customer> getCustomers() { return customers; }
    public List<Product> getProducts() { return products; }
    public CustomerPurchase getNewPurchase() { return newPurchase; }
    public Long getNewCustomerId() { return newCustomerId; }
    public void setNewCustomerId(Long newCustomerId) { this.newCustomerId = newCustomerId; }
    public Long getNewProductId() { return newProductId; }
    public void setNewProductId(Long newProductId) { this.newProductId = newProductId; }
}
