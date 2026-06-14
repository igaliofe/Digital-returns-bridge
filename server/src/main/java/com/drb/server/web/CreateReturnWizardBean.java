package com.drb.server.web;

import com.drb.server.domain.*;
import com.drb.server.domain.enums.DefectStage;
import com.drb.server.domain.enums.DefectType;
import com.drb.server.domain.enums.ReturnReason;
import com.drb.server.rest.dto.CreateReturnRequest;
import com.drb.server.service.*;
import com.drb.server.service.exception.NotFoundException;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.SessionScoped;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.Part;
import java.io.InputStream;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Named
@SessionScoped
public class CreateReturnWizardBean implements Serializable {

    @Inject private transient ReturnRequestService returnService;
    @Inject private transient CustomerService customerService;
    @Inject private transient CustomerPurchaseService purchaseService;
    @Inject private transient DriverService driverService;
    @Inject private transient ImageService imageService;

    private int currentStep = 1;
    private String phoneNumber;
    private Customer customer;
    private List<CustomerPurchase> purchases = new ArrayList<>();
    private Long purchaseId;

    private List<Driver> drivers;

    private Long customerId;
    private Long productId;
    private Long driverId;
    private String orderNumber;
    private String reason;
    private String defectDescription;
    private String priority = "NORMAL";

    private LocalDate originalDeliveryDate;
    private Integer quantity = 1;
    private Boolean underWarranty;
    private Boolean wasUsed;
    private String returnReason;
    private String defectStage;
    private String defectType;
    private String defectLocationText;

    private List<Part> generalImages = new ArrayList<>();
    private List<Part> defectImages = new ArrayList<>();
    private boolean clearPhotosReceived;
    private boolean generalPhotoExists;
    private boolean focusedDefectPhotoExists;
    private String signatureData;

    @PostConstruct
    public void init() {
        drivers = driverService.findActive();
    }

    public String redirectToStep1() {
        return "/returns/create/identify-customer.xhtml?faces-redirect=true";
    }

    public String ensureStep1() {
        currentStep = 1;
        return null;
    }

    public String ensureStep2() {
        if (customer == null) {
            return redirectToStep1();
        }
        purchases = purchaseService.findByCustomerId(customer.getId());
        currentStep = 2;
        return null;
    }

    public String ensureStep3() {
        if (customer == null || purchaseId == null) {
            return customer == null ? redirectToStep1()
                : "/returns/create/select-item.xhtml?faces-redirect=true";
        }
        currentStep = 3;
        return null;
    }

    public String lookupCustomer() {
        try {
            if (phoneNumber == null || phoneNumber.isBlank()) {
                addError("Please enter a phone number");
                return null;
            }
            customer = customerService.findByPhone(phoneNumber.trim());
            customerId = customer.getId();
            purchases = purchaseService.findByCustomerId(customerId);
            purchaseId = null;
            currentStep = 2;
            return "/returns/create/select-item.xhtml?faces-redirect=true";
        } catch (NotFoundException e) {
            addError("Customer not found for phone: " + phoneNumber.trim());
            return null;
        }
    }

    public String selectPurchase(Long id) {
        CustomerPurchase purchase = purchases.stream()
            .filter(p -> p.getId().equals(id))
            .findFirst()
            .orElse(null);
        if (purchase == null) {
            addError("Please select a purchase row");
            return null;
        }
        if (purchase.isHandled()) {
            addError("This purchase has already been handled");
            return null;
        }
        applyPurchase(purchase);
        currentStep = 3;
        return "/returns/create/new-return.xhtml?faces-redirect=true";
    }

    public String backToStep1() {
        currentStep = 1;
        return "/returns/create/identify-customer.xhtml?faces-redirect=true";
    }

    public String backToStep2() {
        if (customer != null) {
            purchases = purchaseService.findByCustomerId(customer.getId());
        }
        currentStep = 2;
        return "/returns/create/select-item.xhtml?faces-redirect=true";
    }

    public String create() {
        try {
            if (requiresVisualDocs() && !hasUploadedImages()) {
                addError("Defective or used items require at least one general or focused-defect photo.");
                return null;
            }

            User loggedIn = loggedInUser();
            ReturnRequest rr = buildReturnRequest(loggedIn);

            CreateReturnRequest req = new CreateReturnRequest();
            req.purchaseId = purchaseId;
            req.customerId = customerId;
            req.productId = productId;
            req.driverId = driverId;

            ReturnRequest saved = returnService.createReturnRequest(rr, req, loggedIn);

            if (driverId != null) {
                returnService.assignDriver(saved.getId(), driverId);
            }

            uploadParts(saved.getId(), generalImages, "SERVICE_GENERAL_IMAGE", loggedIn);
            uploadParts(saved.getId(), defectImages, "SERVICE_DEFECT_IMAGE", loggedIn);

            if (signatureData != null && !signatureData.isBlank()) {
                byte[] sig = decodeSignature(signatureData);
                if (sig != null && sig.length > 0) {
                    imageService.upload(saved.getId(), sig, "SERVICE_REP_SIGNATURE", loggedIn);
                }
            }

            resetWizard();
            return "/returns/details.xhtml?id=" + saved.getId() + "&faces-redirect=true";
        } catch (Exception e) {
            addError("Error creating return: " + e.getMessage());
            return null;
        }
    }

    private ReturnRequest buildReturnRequest(User loggedIn) {
        ReturnRequest rr = new ReturnRequest();
        if (customerId != null) {
            Customer c = new Customer();
            c.setId(customerId);
            rr.setCustomer(c);
        }
        if (productId != null) {
            Product p = new Product();
            p.setId(productId);
            rr.setProduct(p);
        }
        rr.setOrderNumber(orderNumber);
        rr.setReason(reason);
        rr.setDefectDescription(defectDescription);
        rr.setPriority(priority);
        rr.setOriginalDeliveryDate(originalDeliveryDate);
        rr.setQuantity(quantity);
        rr.setUnderWarranty(underWarranty);
        rr.setWasUsed(wasUsed);
        if (returnReason != null && !returnReason.isBlank()) {
            rr.setReturnReason(ReturnReason.valueOf(returnReason));
        }
        if (defectStage != null && !defectStage.isBlank()) {
            rr.setDefectStage(DefectStage.valueOf(defectStage));
        }
        if (defectType != null && !defectType.isBlank()) {
            rr.setDefectType(DefectType.valueOf(defectType));
        }
        rr.setDefectLocationText(defectLocationText);
        rr.setOpenedByUser(loggedIn);
        return rr;
    }

    private void applyPurchase(CustomerPurchase purchase) {
        purchaseId = purchase.getId();
        productId = purchase.getProduct().getId();
        orderNumber = purchase.getOrderNumber();
        originalDeliveryDate = purchase.getOriginalDeliveryDate();
        quantity = purchase.getQuantity();
        underWarranty = purchase.getUnderWarranty();
    }

    public void resetWizard() {
        currentStep = 1;
        phoneNumber = null;
        customer = null;
        purchases = new ArrayList<>();
        purchaseId = null;
        customerId = null;
        productId = null;
        driverId = null;
        orderNumber = null;
        reason = null;
        defectDescription = null;
        priority = "NORMAL";
        originalDeliveryDate = null;
        quantity = 1;
        underWarranty = null;
        wasUsed = null;
        returnReason = null;
        defectStage = null;
        defectType = null;
        defectLocationText = null;
        generalImages = new ArrayList<>();
        defectImages = new ArrayList<>();
        clearPhotosReceived = false;
        generalPhotoExists = false;
        focusedDefectPhotoExists = false;
        signatureData = null;
    }

    public CustomerPurchase getSelectedPurchase() {
        if (purchaseId == null || purchases == null) return null;
        return purchases.stream()
            .filter(p -> purchaseId.equals(p.getId()))
            .findFirst()
            .orElse(null);
    }

    public String getSelectedProductName() {
        CustomerPurchase p = getSelectedPurchase();
        if (p != null && p.getProduct() != null) return p.getProduct().getName();
        return "";
    }

    public String getSelectedProductSku() {
        CustomerPurchase p = getSelectedPurchase();
        if (p != null && p.getProduct() != null) return p.getProduct().getSku();
        return "";
    }

    private boolean requiresVisualDocs() {
        return Boolean.TRUE.equals(wasUsed)
            || (defectType != null && !defectType.isBlank())
            || "PRODUCT_DEFECT".equals(returnReason);
    }

    private boolean hasUploadedImages() {
        for (Part p : generalImages) {
            if (p != null && p.getSize() > 0) return true;
        }
        for (Part p : defectImages) {
            if (p != null && p.getSize() > 0) return true;
        }
        return false;
    }

    private User loggedInUser() {
        HttpSession session = (HttpSession) FacesContext.getCurrentInstance()
            .getExternalContext().getSession(false);
        return session != null ? (User) session.getAttribute("loggedInUser") : null;
    }

    private void uploadParts(Long returnId, List<Part> parts, String imageType, User user) throws Exception {
        if (parts == null) return;
        for (Part part : parts) {
            if (part != null && part.getSize() > 0) {
                try (InputStream is = part.getInputStream()) {
                    byte[] data = is.readAllBytes();
                    imageService.upload(returnId, data, imageType, user);
                }
            }
        }
    }

    private byte[] decodeSignature(String data) {
        String base64 = data;
        int comma = base64.indexOf(',');
        if (base64.startsWith("data:") && comma >= 0) {
            base64 = base64.substring(comma + 1);
        }
        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void addError(String detail) {
        FacesContext.getCurrentInstance().addMessage(null,
            new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", detail));
    }

    public ReturnReason[] getReturnReasons() { return ReturnReason.values(); }
    public DefectStage[] getDefectStages() { return DefectStage.values(); }
    public DefectType[] getDefectTypes() { return DefectType.values(); }

    public int getCurrentStep() { return currentStep; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public Customer getCustomer() { return customer; }
    public List<CustomerPurchase> getPurchases() { return purchases; }
    public List<Driver> getDrivers() { return drivers; }

    public Long getCustomerId() { return customerId; }
    public Long getProductId() { return productId; }
    public Long getDriverId() { return driverId; }
    public void setDriverId(Long driverId) { this.driverId = driverId; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getDefectDescription() { return defectDescription; }
    public void setDefectDescription(String defectDescription) { this.defectDescription = defectDescription; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public LocalDate getOriginalDeliveryDate() { return originalDeliveryDate; }
    public void setOriginalDeliveryDate(LocalDate originalDeliveryDate) { this.originalDeliveryDate = originalDeliveryDate; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Boolean getUnderWarranty() { return underWarranty; }
    public void setUnderWarranty(Boolean underWarranty) { this.underWarranty = underWarranty; }
    public Boolean getWasUsed() { return wasUsed; }
    public void setWasUsed(Boolean wasUsed) { this.wasUsed = wasUsed; }
    public String getReturnReason() { return returnReason; }
    public void setReturnReason(String returnReason) { this.returnReason = returnReason; }
    public String getDefectStage() { return defectStage; }
    public void setDefectStage(String defectStage) { this.defectStage = defectStage; }
    public String getDefectType() { return defectType; }
    public void setDefectType(String defectType) { this.defectType = defectType; }
    public String getDefectLocationText() { return defectLocationText; }
    public void setDefectLocationText(String defectLocationText) { this.defectLocationText = defectLocationText; }
    public List<Part> getGeneralImages() { return generalImages; }
    public void setGeneralImages(List<Part> generalImages) { this.generalImages = generalImages; }
    public List<Part> getDefectImages() { return defectImages; }
    public void setDefectImages(List<Part> defectImages) { this.defectImages = defectImages; }
    public boolean isClearPhotosReceived() { return clearPhotosReceived; }
    public void setClearPhotosReceived(boolean clearPhotosReceived) { this.clearPhotosReceived = clearPhotosReceived; }
    public boolean isGeneralPhotoExists() { return generalPhotoExists; }
    public void setGeneralPhotoExists(boolean generalPhotoExists) { this.generalPhotoExists = generalPhotoExists; }
    public boolean isFocusedDefectPhotoExists() { return focusedDefectPhotoExists; }
    public void setFocusedDefectPhotoExists(boolean focusedDefectPhotoExists) { this.focusedDefectPhotoExists = focusedDefectPhotoExists; }
    public String getSignatureData() { return signatureData; }
    public void setSignatureData(String signatureData) { this.signatureData = signatureData; }
}
