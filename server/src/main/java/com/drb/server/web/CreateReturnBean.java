package com.drb.server.web;

import com.drb.server.domain.*;
import com.drb.server.domain.enums.DefectStage;
import com.drb.server.domain.enums.DefectType;
import com.drb.server.domain.enums.ReturnReason;
import com.drb.server.service.*;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.RequestScoped;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.Part;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Named
@RequestScoped
public class CreateReturnBean {

    @Inject private ReturnRequestService returnService;
    @Inject private CustomerService customerService;
    @Inject private ProductService productService;
    @Inject private DriverService driverService;
    @Inject private ImageService imageService;

    private List<Customer> customers;
    private List<Product> products;
    private List<Driver> drivers;

    private Long customerId;
    private Long productId;
    private Long driverId;
    private String orderNumber;
    private String reason;
    private String defectDescription;
    private String priority = "NORMAL";

    // Service-rep checklist fields
    private LocalDate originalDeliveryDate;
    private Integer quantity = 1;
    private Boolean underWarranty;
    private Boolean wasUsed;
    private String returnReason;
    private String defectStage;
    private String defectType;
    private String defectLocationText;

    // Visual documentation
    private List<Part> generalImages = new ArrayList<>();
    private List<Part> defectImages = new ArrayList<>();
    private boolean clearPhotosReceived;
    private boolean generalPhotoExists;
    private boolean focusedDefectPhotoExists;

    // Service-rep drawn signature (base64 PNG from p:signature)
    private String signatureData;

    @PostConstruct
    public void init() {
        customers = customerService.findAll();
        products = productService.findAll();
        drivers = driverService.findActive();
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

    public String create() {
        try {
            if (requiresVisualDocs() && !hasUploadedImages()) {
                FacesContext.getCurrentInstance().addMessage(null,
                    new FacesMessage(FacesMessage.SEVERITY_ERROR,
                        "Visual documentation required",
                        "Defective or used items require at least one general or focused-defect photo."));
                return null;
            }

            HttpSession session = (HttpSession) FacesContext.getCurrentInstance()
                .getExternalContext().getSession(false);
            User loggedIn = session != null ? (User) session.getAttribute("loggedInUser") : null;

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

            ReturnRequest saved = returnService.createReturnRequest(rr);

            if (driverId != null) {
                returnService.assignDriver(saved.getId(), driverId,
                    loggedIn != null ? loggedIn.getId() : null);
            }

            uploadParts(saved.getId(), generalImages, "SERVICE_GENERAL_IMAGE", loggedIn);
            uploadParts(saved.getId(), defectImages, "SERVICE_DEFECT_IMAGE", loggedIn);

            if (signatureData != null && !signatureData.isBlank()) {
                byte[] sig = decodeSignature(signatureData);
                if (sig != null && sig.length > 0) {
                    imageService.upload(saved.getId(), sig, "SERVICE_REP_SIGNATURE", loggedIn);
                }
            }

            return "/returns/details.xhtml?id=" + saved.getId() + "&faces-redirect=true";
        } catch (Exception e) {
            FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error creating return", e.getMessage()));
            return null;
        }
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

    public ReturnReason[] getReturnReasons() { return ReturnReason.values(); }
    public DefectStage[] getDefectStages() { return DefectStage.values(); }
    public DefectType[] getDefectTypes() { return DefectType.values(); }

    public List<Customer> getCustomers() { return customers; }
    public List<Product> getProducts() { return products; }
    public List<Driver> getDrivers() { return drivers; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

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
