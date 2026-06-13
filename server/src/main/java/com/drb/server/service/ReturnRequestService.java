package com.drb.server.service;

import com.drb.server.domain.*;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.repository.DriverRepository;
import com.drb.server.repository.PickupUpdateRepository;
import com.drb.server.repository.ReturnImageRepository;
import com.drb.server.repository.ReturnRequestRepository;
import com.drb.server.repository.StatusHistoryRepository;
import com.drb.server.repository.WarehouseInspectionRepository;
import com.drb.server.rest.dto.PickupConfirmationRequest;
import com.drb.server.rest.dto.WarehouseInspectionRequest;
import com.drb.server.service.exception.IllegalStatusTransitionException;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDateTime;
import java.util.*;

@ApplicationScoped
public class ReturnRequestService {

    private static final Map<ReturnStatus, Set<ReturnStatus>> ALLOWED_TRANSITIONS;

    static {
        Map<ReturnStatus, Set<ReturnStatus>> m = new EnumMap<>(ReturnStatus.class);
        m.put(ReturnStatus.OPEN, EnumSet.of(ReturnStatus.WAITING_FOR_PICKUP, ReturnStatus.NEEDS_MORE_INFO));
        m.put(ReturnStatus.WAITING_FOR_PICKUP, EnumSet.of(ReturnStatus.BARCODE_ASSIGNED));
        m.put(ReturnStatus.BARCODE_ASSIGNED, EnumSet.of(ReturnStatus.PICKED_UP));
        m.put(ReturnStatus.PICKED_UP, EnumSet.of(ReturnStatus.ARRIVED_TO_WAREHOUSE));
        m.put(ReturnStatus.ARRIVED_TO_WAREHOUSE, EnumSet.of(ReturnStatus.INSPECTED, ReturnStatus.NEEDS_MORE_INFO));
        m.put(ReturnStatus.INSPECTED, EnumSet.of(ReturnStatus.CLOSED));
        m.put(ReturnStatus.NEEDS_MORE_INFO, EnumSet.of(ReturnStatus.WAITING_FOR_PICKUP));
        m.put(ReturnStatus.CLOSED, Collections.emptySet());
        ALLOWED_TRANSITIONS = Collections.unmodifiableMap(m);
    }

    @Inject
    private ReturnRequestRepository returnRepo;

    @Inject
    private DriverRepository driverRepo;

    @Inject
    private StatusHistoryRepository statusHistoryRepo;

    @Inject
    private ReturnImageRepository imageRepo;

    @Inject
    private PickupUpdateRepository pickupUpdateRepo;

    @Inject
    private WarehouseInspectionRepository inspectionRepo;

    public List<ReturnRequest> findAll() {
        return returnRepo.findAllWithRefs();
    }

    public List<ReturnRequest> findAll(String status, Long driverId, Long customerId) {
        if (status != null && !status.isBlank()) {
            return returnRepo.findByStatus(ReturnStatus.valueOf(status));
        }
        if (driverId != null) {
            return returnRepo.findByDriverId(driverId);
        }
        if (customerId != null) {
            return returnRepo.findByCustomerId(customerId);
        }
        return returnRepo.findAll();
    }

    public List<ReturnRequest> findByStatus(ReturnStatus status) {
        return returnRepo.findByStatusWithRefs(status);
    }

    public List<ReturnRequest> findByDriverId(Long driverId) {
        return returnRepo.findByDriverId(driverId);
    }

    public ReturnRequest findByBarcode(String barcode) {
        return returnRepo.findByBarcode(barcode)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", "barcode=" + barcode));
    }

    public ReturnRequest findById(Long id) {
        return returnRepo.findByIdWithRefs(id)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", id));
    }

    public ReturnRequest getById(Long id) {
        return findById(id);
    }

    public ReturnRequest create(ReturnRequest rr) {
        return createReturnRequest(rr);
    }

    public ReturnRequest createReturnRequest(ReturnRequest rr) {
        rr.setBarcode(null);
        rr.setBarcodeAssignedAt(null);
        rr.setBarcodeAssignedByDriver(null);
        rr.setStatus(ReturnStatus.OPEN);
        return returnRepo.save(rr);
    }

    public ReturnRequest update(Long id, ReturnRequest rr) {
        ReturnRequest existing = findById(id);
        existing.setOrderNumber(rr.getOrderNumber());
        existing.setReason(rr.getReason());
        existing.setDefectDescription(rr.getDefectDescription());
        existing.setPriority(rr.getPriority());
        existing.setOriginalDeliveryDate(rr.getOriginalDeliveryDate());
        existing.setQuantity(rr.getQuantity());
        existing.setUnderWarranty(rr.getUnderWarranty());
        existing.setWasUsed(rr.getWasUsed());
        existing.setReturnReason(rr.getReturnReason());
        existing.setDefectType(rr.getDefectType());
        existing.setDefectStage(rr.getDefectStage());
        existing.setDefectLocationText(rr.getDefectLocationText());
        return returnRepo.save(existing);
    }

    public ReturnRequest assignDriver(Long returnId, Long driverId) {
        ReturnRequest rr = findById(returnId);
        Driver driver = driverRepo.findById(driverId)
            .orElseThrow(() -> new NotFoundException("Driver", driverId));
        rr.setDriver(driver);
        return returnRepo.save(rr);
    }

    public ReturnRequest assignDriver(Long returnId, Long driverId, Long assignedByUserId) {
        return assignDriver(returnId, driverId);
    }

    public ReturnRequest assignBarcode(Long returnId, String barcode, Long driverId) {
        ReturnRequest rr = returnRepo.findById(returnId)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", returnId));

        if (barcode == null || barcode.isBlank()) {
            throw new ValidationException("BARCODE_BLANK", "Barcode cannot be blank");
        }

        Driver driver = driverRepo.findById(driverId)
            .orElseThrow(() -> new NotFoundException("Driver", driverId));

        returnRepo.findByBarcode(barcode.trim()).ifPresent(existing -> {
            throw new ValidationException("BARCODE_ALREADY_ASSIGNED",
                "Barcode '" + barcode + "' is already assigned to another return request");
        });

        ReturnStatus oldStatus = rr.getStatus();
        rr.setBarcode(barcode.trim());
        rr.setBarcodeAssignedAt(LocalDateTime.now());
        rr.setBarcodeAssignedByDriver(driver);
        rr.setStatus(ReturnStatus.BARCODE_ASSIGNED);

        ReturnRequest saved = returnRepo.save(rr);

        StatusHistory history = new StatusHistory();
        history.setReturnRequest(saved);
        history.setOldStatus(oldStatus);
        history.setNewStatus(ReturnStatus.BARCODE_ASSIGNED);
        history.setChangedByUser(driver.getUser());
        statusHistoryRepo.save(history);

        return saved;
    }

    public ReturnRequest changeStatus(Long returnId, String status, String comment, User user) {
        ReturnStatus newStatus = ReturnStatus.valueOf(status);
        return transitionStatus(returnId, newStatus, user, comment);
    }

    public ReturnRequest transitionStatus(Long returnId, ReturnStatus newStatus, User user, String comment) {
        ReturnRequest rr = returnRepo.findById(returnId)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", returnId));

        Set<ReturnStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(rr.getStatus(), Collections.emptySet());
        if (!allowed.contains(newStatus)) {
            throw new IllegalStatusTransitionException(rr.getStatus(), newStatus);
        }

        ReturnStatus oldStatus = rr.getStatus();
        rr.setStatus(newStatus);
        ReturnRequest saved = returnRepo.save(rr);

        StatusHistory history = new StatusHistory();
        history.setReturnRequest(saved);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setChangedByUser(user);
        history.setComment(comment);
        statusHistoryRepo.save(history);

        return saved;
    }

    public ReturnRequest changePriority(Long returnId, String priority) {
        ReturnRequest rr = findById(returnId);
        rr.setPriority(priority);
        return returnRepo.save(rr);
    }

    public List<StatusHistory> getStatusHistory(Long returnId) {
        return statusHistoryRepo.findByReturnRequestId(returnId);
    }

    public List<ReturnImage> getImages(Long returnId) {
        return imageRepo.findByReturnRequestId(returnId);
    }

    public List<PickupUpdate> getPickupUpdates(Long returnId) {
        return pickupUpdateRepo.findByReturnRequestId(returnId);
    }

    public PickupUpdate createPickupUpdate(Long returnId, PickupConfirmationRequest req, User user) {
        ReturnRequest rr = findById(returnId);
        PickupUpdate pu = new PickupUpdate();
        pu.setReturnRequest(rr);
        pu.setDriver(rr.getDriver());
        if (req.itemCondition != null && !req.itemCondition.isBlank()) {
            pu.setItemCondition(com.drb.server.domain.enums.ItemCondition.valueOf(req.itemCondition));
        }
        if (req.defectType != null && !req.defectType.isBlank()) {
            pu.setDefectType(com.drb.server.domain.enums.DefectType.valueOf(req.defectType));
        }
        if (req.defectLocation != null && !req.defectLocation.isBlank()) {
            pu.setDefectLocation(com.drb.server.domain.enums.DefectLocation.valueOf(req.defectLocation));
        }
        pu.setDefectLocationOther(req.defectLocationOther);
        pu.setItemCollected(req.itemCollected);
        pu.setDriverNotes(req.driverNotes);
        return pickupUpdateRepo.save(pu);
    }

    public ReturnRequest confirmPickup(Long returnId, PickupConfirmationRequest req, User user) {
        ReturnRequest rr = findById(returnId);
        createPickupUpdate(returnId, req, user);
        return transitionStatus(returnId, ReturnStatus.PICKED_UP, user, "Pickup confirmed");
    }

    public StatusHistory addStatusHistory(Long returnId, String newStatus, String comment, User user) {
        StatusHistory history = new StatusHistory();
        ReturnRequest rr = findById(returnId);
        history.setReturnRequest(rr);
        history.setNewStatus(ReturnStatus.valueOf(newStatus));
        history.setChangedByUser(user);
        history.setComment(comment);
        return statusHistoryRepo.save(history);
    }

    public List<WarehouseInspection> getWarehouseInspections(Long returnId) {
        return inspectionRepo.findByReturnRequestId(returnId);
    }

    public WarehouseInspection createWarehouseInspection(Long returnId, WarehouseInspectionRequest req, User user) {
        ReturnRequest rr = findById(returnId);
        WarehouseInspection inspection = new WarehouseInspection();
        inspection.setReturnRequest(rr);
        inspection.setInspectedByUser(user);
        if (req.warehouseDecision != null && !req.warehouseDecision.isBlank()) {
            inspection.setWarehouseDecision(com.drb.server.domain.enums.WarehouseDecision.valueOf(req.warehouseDecision));
        }
        if (req.itemCondition != null && !req.itemCondition.isBlank()) {
            inspection.setItemCondition(com.drb.server.domain.enums.ItemCondition.valueOf(req.itemCondition));
        }
        inspection.setCallFullyHandled(req.callFullyHandled);
        inspection.setWarehouseNotes(req.warehouseNotes);
        return inspectionRepo.save(inspection);
    }
}
