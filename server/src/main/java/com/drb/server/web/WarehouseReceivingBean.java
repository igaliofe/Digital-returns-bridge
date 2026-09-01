package com.drb.server.web;

import com.drb.server.domain.PickupUpdate;
import com.drb.server.domain.ReturnImage;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.User;
import com.drb.server.domain.WarehouseInspection;
import com.drb.server.domain.enums.ImageType;
import com.drb.server.domain.enums.ItemCondition;
import com.drb.server.domain.enums.WarehouseDecision;
import com.drb.server.repository.PickupUpdateRepository;
import com.drb.server.repository.ReturnImageRepository;
import com.drb.server.service.EnumParser;
import com.drb.server.service.WarehouseService;

import com.drb.server.service.exception.ConcurrentModificationConflictException;
import com.drb.server.service.exception.NotFoundException;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;

@Named
@ViewScoped
public class WarehouseReceivingBean implements Serializable {

    @Inject
    private WarehouseService warehouseService;

    @Inject
    private PickupUpdateRepository pickupUpdateRepository;

    @Inject
    private ReturnImageRepository returnImageRepository;

    // package-private to allow test override without static mocking
    Supplier<FacesContext> facesContextSupplier = FacesContext::getCurrentInstance;

    protected FacesContext getFacesContext() {
        return facesContextSupplier.get();
    }

    private String barcodeInput;
    private ReturnRequest foundReturn;
    private String barcodeNotFoundError;
    private List<PickupUpdate> pickupUpdates = new ArrayList<>();
    private List<ReturnImage> images = new ArrayList<>();

    private String warehouseDecision;
    private String itemCondition;
    private boolean callFullyHandled;
    private String warehouseNotes;
    private String moreInfoNotes;

    /** Shown when another warehouse user changed the same return first. */
    static final String CONCURRENT_MODIFICATION_MESSAGE =
        "This record was updated by another user. Refresh the page and try again";

    private void addConcurrentModificationMessage() {
        getFacesContext().addMessage(null,
            new FacesMessage(FacesMessage.SEVERITY_ERROR, CONCURRENT_MODIFICATION_MESSAGE, null));
    }

    public void searchByBarcode() {
        foundReturn = null;
        barcodeNotFoundError = null;
        pickupUpdates = new ArrayList<>();
        images = new ArrayList<>();
        try {
            foundReturn = warehouseService.findByBarcode(barcodeInput);
            loadDigitalFile();
        } catch (NotFoundException e) {
            barcodeNotFoundError = "Barcode not found: " + barcodeInput;
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Barcode not found",
                    "No return request found with barcode: " + barcodeInput));
        }
    }

    private void loadDigitalFile() {
        if (foundReturn == null || foundReturn.getId() == null) {
            return;
        }
        if (pickupUpdateRepository != null) {
            pickupUpdates = pickupUpdateRepository.findByReturnRequestId(foundReturn.getId());
        }
        if (returnImageRepository != null) {
            images = returnImageRepository.findByReturnRequestId(foundReturn.getId());
        }
    }

    private User getLoggedInUser() {
        HttpSession session = (HttpSession) getFacesContext()
            .getExternalContext().getSession(false);
        return session != null ? (User) session.getAttribute("loggedInUser") : null;
    }

    public void markArrived() {
        try {
            foundReturn = warehouseService.markArrived(foundReturn.getBarcode(), getLoggedInUser());
            loadDigitalFile();
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Marked as arrived", null));
        } catch (ConcurrentModificationConflictException e) {
            addConcurrentModificationMessage();
        } catch (Exception e) {
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void requestMoreInfo() {
        try {
            foundReturn = warehouseService.requestMoreInfo(foundReturn.getId(), moreInfoNotes);
            loadDigitalFile();
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "More info requested", null));
        } catch (ConcurrentModificationConflictException e) {
            addConcurrentModificationMessage();
        } catch (Exception e) {
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    public void createInspection() {
        try {
            WarehouseInspection inspection = new WarehouseInspection();
            inspection.setWarehouseDecision(
                EnumParser.parse(WarehouseDecision.class, warehouseDecision, "warehouseDecision"));
            inspection.setItemCondition(
                EnumParser.parse(ItemCondition.class, itemCondition, "itemCondition"));
            inspection.setCallFullyHandled(callFullyHandled);
            inspection.setWarehouseNotes(warehouseNotes);
            inspection.setInspectedByUser(getLoggedInUser());
            warehouseService.createInspection(foundReturn.getId(), inspection);
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Inspection saved", null));
        } catch (ConcurrentModificationConflictException e) {
            addConcurrentModificationMessage();
        } catch (Exception e) {
            getFacesContext().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_ERROR, "Error", e.getMessage()));
        }
    }

    /** Service + driver photos (excludes signature images, which render separately). */
    public List<ReturnImage> getGalleryImages() {
        List<ReturnImage> gallery = new ArrayList<>();
        for (ReturnImage img : images) {
            ImageType t = img.getImageType();
            if (t != ImageType.SERVICE_REP_SIGNATURE && t != ImageType.DRIVER_SIGNATURE) {
                gallery.add(img);
            }
        }
        return gallery;
    }

    public String getDriverSignatureUrl() {
        for (PickupUpdate pu : pickupUpdates) {
            if (pu.getSignatureImageUrl() != null && !pu.getSignatureImageUrl().isBlank()) {
                return pu.getSignatureImageUrl();
            }
        }
        for (ReturnImage img : images) {
            if (img.getImageType() == ImageType.DRIVER_SIGNATURE) {
                return img.getImageUrl();
            }
        }
        return null;
    }

    public String getServiceSignatureUrl() {
        for (ReturnImage img : images) {
            if (img.getImageType() == ImageType.SERVICE_REP_SIGNATURE) {
                return img.getImageUrl();
            }
        }
        return null;
    }

    public String getBarcodeInput() { return barcodeInput; }
    public void setBarcodeInput(String b) { this.barcodeInput = b; }

    public ReturnRequest getFoundReturn() { return foundReturn; }

    public String getBarcodeNotFoundError() { return barcodeNotFoundError; }

    public List<PickupUpdate> getPickupUpdates() {
        return pickupUpdates != null ? pickupUpdates : Collections.emptyList();
    }

    public List<ReturnImage> getImages() {
        return images != null ? images : Collections.emptyList();
    }

    public String getWarehouseDecision() { return warehouseDecision; }
    public void setWarehouseDecision(String d) { this.warehouseDecision = d; }

    public String getItemCondition() { return itemCondition; }
    public void setItemCondition(String itemCondition) { this.itemCondition = itemCondition; }

    public boolean isCallFullyHandled() { return callFullyHandled; }
    public void setCallFullyHandled(boolean callFullyHandled) { this.callFullyHandled = callFullyHandled; }

    public String getWarehouseNotes() { return warehouseNotes; }
    public void setWarehouseNotes(String n) { this.warehouseNotes = n; }

    public String getMoreInfoNotes() { return moreInfoNotes; }
    public void setMoreInfoNotes(String moreInfoNotes) { this.moreInfoNotes = moreInfoNotes; }

    public WarehouseDecision[] getDecisions() { return WarehouseDecision.values(); }
    public ItemCondition[] getItemConditions() { return ItemCondition.values(); }
}
