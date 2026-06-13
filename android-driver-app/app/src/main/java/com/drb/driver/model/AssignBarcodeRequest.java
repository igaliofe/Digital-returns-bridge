package com.drb.driver.model;

public class AssignBarcodeRequest {
    public String barcode;
    public Long driverId;

    public AssignBarcodeRequest() {}

    public AssignBarcodeRequest(String barcode, Long driverId) {
        this.barcode = barcode;
        this.driverId = driverId;
    }
}
