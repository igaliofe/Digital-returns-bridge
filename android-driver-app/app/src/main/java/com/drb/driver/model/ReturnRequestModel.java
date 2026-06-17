package com.drb.driver.model;

import java.util.List;

public class ReturnRequestModel {
    public Long id;
    public String barcode;
    public String barcodeAssignedAt;
    public Long barcodeAssignedByDriverId;
    public String barcodeAssignedByDriverName;
    public Long customerId;
    public String customerName;
    public String customerAddress;
    public String customerPhone;
    public Long productId;
    public String productName;
    public String productSku;
    public String productDescription;
    public Long driverId;
    public String driverName;
    public String orderNumber;
    public String reason;
    public String defectDescription;
    public String priority;
    public String status;
    public String createdAt;
    public String updatedAt;
    public List<ReturnImageModel> images;

    // Catalog / pricing info (from the linked product)
    public Double productPrice;
    public String productImageUrl;

    // Checklist fields (SHARED CONTRACT)
    public String originalDeliveryDate;
    public Integer quantity;
    public Boolean underWarranty;
    public Boolean wasUsed;
    public String returnReason;
    public String defectType;
    public String defectStage;
    public String defectLocationText;

    public boolean isBarcodeAssigned() {
        return barcode != null && !barcode.isEmpty();
    }

    public boolean isStatusBarcodeAssigned() {
        return "BARCODE_ASSIGNED".equals(status);
    }

    /**
     * True when the driver has captured at least one pickup photo
     * (product / distant / defect). The driver signature is excluded — it is
     * captured later, at pickup confirmation.
     */
    public boolean hasDriverPhoto() {
        if (images == null) return false;
        for (ReturnImageModel img : images) {
            if (img.imageType != null
                && img.imageType.startsWith("DRIVER_")
                && !"DRIVER_SIGNATURE".equals(img.imageType)) {
                return true;
            }
        }
        return false;
    }
}
