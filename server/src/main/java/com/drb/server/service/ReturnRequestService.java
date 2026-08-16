package com.drb.server.service;

import com.drb.server.domain.*;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.repository.CustomerPurchaseRepository;
import com.drb.server.repository.CustomerRepository;
import com.drb.server.repository.DriverRepository;
import com.drb.server.repository.PickupUpdateRepository;
import com.drb.server.repository.ProductRepository;
import com.drb.server.repository.ReturnImageRepository;
import com.drb.server.repository.ReturnRequestRepository;
import com.drb.server.repository.StatusHistoryRepository;
import com.drb.server.repository.WarehouseInspectionRepository;
import com.drb.server.rest.dto.CreateReturnRequest;
import com.drb.server.rest.dto.PickupConfirmationRequest;
import com.drb.server.rest.dto.WarehouseInspectionRequest;
import com.drb.server.service.exception.ConcurrentModificationConflictException;
import com.drb.server.service.exception.IllegalStatusTransitionException;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Supplier;

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

    /**
     * Hibernate is not on the compile classpath (only jakarta.jakartaee-api is, as "provided"),
     * so its stale-state exceptions are recognised by class name rather than by import.
     */
    private static final Set<String> STALE_STATE_EXCEPTIONS = Set.of(
        "org.hibernate.StaleStateException",
        "org.hibernate.StaleObjectStateException");

    @Inject
    private ReturnRequestRepository returnRepo;

    @Inject
    private CustomerRepository customerRepo;

    @Inject
    private ProductRepository productRepo;

    @Inject
    private CustomerPurchaseRepository purchaseRepo;

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
            return returnRepo.findByStatusWithRefs(
                EnumParser.parse(ReturnStatus.class, status, "status"));
        }
        if (driverId != null) {
            return returnRepo.findByDriverIdWithRefs(driverId);
        }
        if (customerId != null) {
            return returnRepo.findByCustomerIdWithRefs(customerId);
        }
        return returnRepo.findAllWithRefs();
    }

    public List<ReturnRequest> findByStatus(ReturnStatus status) {
        return returnRepo.findByStatusWithRefs(status);
    }

    public List<ReturnRequest> findByDriverId(Long driverId) {
        return returnRepo.findByDriverIdWithRefs(driverId);
    }

    public ReturnRequest findByBarcode(String barcode) {
        return returnRepo.findByBarcodeWithRefs(barcode)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", "barcode=" + barcode));
    }

    public ReturnRequest findById(Long id) {
        return returnRepo.findByIdWithRefs(id)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", id));
    }

    private ReturnRequest reload(ReturnRequest saved) {
        if (saved.getId() == null) {
            return saved;
        }
        return returnRepo.findByIdWithRefs(saved.getId()).orElse(saved);
    }

    public ReturnRequest getById(Long id) {
        return findById(id);
    }

    public ReturnRequest createReturnRequest(ReturnRequest rr) {
        return createReturnRequest(rr, null, null);
    }

    @Transactional
    public ReturnRequest createReturnRequest(ReturnRequest rr, CreateReturnRequest req, User openedByUser) {
        rr.setBarcode(null);
        rr.setBarcodeAssignedAt(null);
        rr.setBarcodeAssignedByDriver(null);
        rr.setStatus(ReturnStatus.OPEN);

        if (req != null) {
            if (req.customerId != null) {
                Customer customer = customerRepo.findById(req.customerId);
                if (customer == null) {
                    throw new NotFoundException("Customer", req.customerId);
                }
                rr.setCustomer(customer);
            }
            if (req.productId != null) {
                Product product = productRepo.findById(req.productId);
                if (product == null) {
                    throw new NotFoundException("Product", req.productId);
                }
                rr.setProduct(product);
            }
            if (req.driverId != null) {
                Driver driver = driverRepo.findById(req.driverId)
                    .orElseThrow(() -> new NotFoundException("Driver", req.driverId));
                rr.setDriver(driver);
            }
        }

        if (openedByUser != null) {
            rr.setOpenedByUser(openedByUser);
        }

        if (req != null && req.purchaseId != null) {
            CustomerPurchase purchase = purchaseRepo.findByIdWithRefs(req.purchaseId)
                .orElseThrow(() -> new NotFoundException("CustomerPurchase", req.purchaseId));
            if (rr.getCustomer() != null && !purchase.getCustomer().getId().equals(rr.getCustomer().getId())) {
                throw new ValidationException("PURCHASE_CUSTOMER_MISMATCH",
                    "Purchase does not belong to the specified customer");
            }
            if (rr.getProduct() != null && !purchase.getProduct().getId().equals(rr.getProduct().getId())) {
                throw new ValidationException("PURCHASE_PRODUCT_MISMATCH",
                    "Purchase does not belong to the specified product");
            }
            if (rr.getCustomer() == null) {
                rr.setCustomer(purchase.getCustomer());
            }
            if (rr.getProduct() == null) {
                rr.setProduct(purchase.getProduct());
            }
            rr.setPurchase(purchase);
            if (rr.getOrderNumber() == null || rr.getOrderNumber().isBlank()) {
                rr.setOrderNumber(purchase.getOrderNumber());
            }
            if (rr.getOriginalDeliveryDate() == null) {
                rr.setOriginalDeliveryDate(purchase.getOriginalDeliveryDate());
            }
            if (rr.getQuantity() == null) {
                rr.setQuantity(purchase.getQuantity());
            }
            if (rr.getUnderWarranty() == null) {
                rr.setUnderWarranty(purchase.getUnderWarranty());
            }
            purchase.setHandled(true);
            purchaseRepo.save(purchase);
        }

        ReturnRequest saved = returnRepo.save(rr);
        return reload(saved);
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
        return reload(returnRepo.save(existing));
    }

    @Transactional
    public ReturnRequest assignDriver(Long returnId, Long driverId) {
        return withConflictDetection(returnId, () -> doAssignDriver(returnId, driverId));
    }

    private ReturnRequest doAssignDriver(Long returnId, Long driverId) {
        ReturnRequest rr = returnRepo.findByIdForUpdate(returnId)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", returnId));
        Driver driver = driverRepo.findById(driverId)
            .orElseThrow(() -> new NotFoundException("Driver", driverId));
        rr.setDriver(driver);
        ReturnRequest saved = returnRepo.save(rr);
        if (saved.getStatus() == ReturnStatus.OPEN) {
            return doTransitionStatus(returnId, ReturnStatus.WAITING_FOR_PICKUP, null, "Driver assigned");
        }
        return reload(saved);
    }

    @Transactional
    public ReturnRequest assignBarcode(Long returnId, String barcode, Long driverId) {
        return withConflictDetection(returnId, () -> doAssignBarcode(returnId, barcode, driverId));
    }

    private ReturnRequest doAssignBarcode(Long returnId, String barcode, Long driverId) {
        ReturnRequest rr = returnRepo.findByIdForUpdate(returnId)
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

        ReturnRequest saved;
        try {
            // saveAndFlush, not save: the row lock above only serialises writers to *this* return,
            // so two drivers claiming the same barcode for two different returns still race. The
            // UNIQUE index on return_requests.barcode is what actually decides that race, and the
            // flush is what makes it surface here instead of at transaction commit.
            saved = returnRepo.saveAndFlush(rr);
        } catch (OptimisticLockException e) {
            // let the boundary turn this into a 409 CONCURRENT_MODIFICATION
            throw e;
        } catch (PersistenceException e) {
            if (!isIntegrityViolation(e)) {
                throw e;
            }
            throw new ValidationException("BARCODE_ALREADY_ASSIGNED",
                "Barcode '" + barcode + "' is already assigned to another return request");
        }

        StatusHistory history = new StatusHistory();
        history.setReturnRequest(saved);
        history.setOldStatus(oldStatus);
        history.setNewStatus(ReturnStatus.BARCODE_ASSIGNED);
        history.setChangedByUser(driver.getUser());
        statusHistoryRepo.save(history);

        return reload(saved);
    }

    @Transactional
    public ReturnRequest changeStatus(Long returnId, String status, String comment, User user) {
        ReturnStatus newStatus = EnumParser.parse(ReturnStatus.class, status, "status");
        if (newStatus == null) {
            throw new ValidationException("STATUS_BLANK", "Status cannot be blank");
        }
        return transitionStatus(returnId, newStatus, user, comment);
    }

    @Transactional
    public ReturnRequest transitionStatus(Long returnId, ReturnStatus newStatus, User user, String comment) {
        return withConflictDetection(returnId, () -> doTransitionStatus(returnId, newStatus, user, comment));
    }

    private ReturnRequest doTransitionStatus(Long returnId, ReturnStatus newStatus, User user, String comment) {
        ReturnRequest rr = returnRepo.findByIdForUpdate(returnId)
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

        return reload(saved);
    }

    @Transactional
    public ReturnRequest changePriority(Long returnId, String priority) {
        return withConflictDetection(returnId, () -> doChangePriority(returnId, priority));
    }

    private ReturnRequest doChangePriority(Long returnId, String priority) {
        ReturnRequest rr = returnRepo.findByIdForUpdate(returnId)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", returnId));
        rr.setPriority(priority);
        return reload(returnRepo.save(rr));
    }

    /**
     * Runs a mutating action and translates a lost optimistic-lock race into a
     * conflict the caller can show to the user, instead of a 500.
     */
    private <T> T withConflictDetection(Long returnId, Supplier<T> action) {
        try {
            return action.get();
        } catch (OptimisticLockException e) {
            throw new ConcurrentModificationConflictException("ReturnRequest", returnId, e);
        } catch (RuntimeException e) {
            if (isStaleState(e)) {
                throw new ConcurrentModificationConflictException("ReturnRequest", returnId, e);
            }
            throw e;
        }
    }

    /**
     * True when the failure is a database integrity-constraint violation (SQLState class 23),
     * as opposed to a connection or mapping problem that happens to share the same JPA
     * exception type. Checked by SQLState so no Hibernate-specific type is needed here.
     */
    private static boolean isIntegrityViolation(Throwable t) {
        for (Throwable cause = t; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sqlException) {
                String state = sqlException.getSQLState();
                if (state != null && state.startsWith("23")) {
                    return true;
                }
            }
            if (cause.getCause() == cause) {
                break;
            }
        }
        return false;
    }

    private static boolean isStaleState(Throwable t) {
        for (Throwable cause = t; cause != null; cause = cause.getCause()) {
            if (STALE_STATE_EXCEPTIONS.contains(cause.getClass().getName())) {
                return true;
            }
            if (cause.getCause() == cause) {
                break;
            }
        }
        return false;
    }

    // Fetch-joins the changedByUser association: callers (REST DTO mapping, JSF views) read the
    // user's name after the persistence context is gone, which would otherwise fail on a lazy proxy.
    public List<StatusHistory> getStatusHistory(Long returnId) {
        return statusHistoryRepo.findByReturnRequestIdWithUser(returnId);
    }

    public List<ReturnImage> getImages(Long returnId) {
        return imageRepo.findByReturnRequestId(returnId);
    }

    public List<PickupUpdate> getPickupUpdates(Long returnId) {
        return pickupUpdateRepo.findByReturnRequestId(returnId);
    }

    @Transactional
    public PickupUpdate createPickupUpdate(Long returnId, PickupConfirmationRequest req, User user) {
        ReturnRequest rr = findById(returnId);
        PickupUpdate pu = new PickupUpdate();
        pu.setReturnRequest(rr);
        pu.setDriver(rr.getDriver());
        if (req.itemCondition != null && !req.itemCondition.isBlank()) {
            pu.setItemCondition(EnumParser.parse(
                com.drb.server.domain.enums.ItemCondition.class, req.itemCondition, "itemCondition"));
        }
        if (req.defectType != null && !req.defectType.isBlank()) {
            pu.setDefectType(EnumParser.parse(
                com.drb.server.domain.enums.DefectType.class, req.defectType, "defectType"));
        }
        if (req.defectLocation != null && !req.defectLocation.isBlank()) {
            pu.setDefectLocation(EnumParser.parse(
                com.drb.server.domain.enums.DefectLocation.class, req.defectLocation, "defectLocation"));
        }
        pu.setDefectLocationOther(req.defectLocationOther);
        pu.setItemCollected(req.itemCollected);
        pu.setDriverNotes(req.driverNotes);
        return pickupUpdateRepo.save(pu);
    }

    @Transactional
    public ReturnRequest confirmPickup(Long returnId, PickupConfirmationRequest req, User user) {
        ReturnRequest rr = findById(returnId);
        createPickupUpdate(returnId, req, user);
        return transitionStatus(returnId, ReturnStatus.PICKED_UP, user, "Pickup confirmed");
    }

    public StatusHistory addStatusHistory(Long returnId, String newStatus, String comment, User user) {
        StatusHistory history = new StatusHistory();
        ReturnRequest rr = findById(returnId);
        history.setReturnRequest(rr);
        ReturnStatus parsedStatus = EnumParser.parse(ReturnStatus.class, newStatus, "newStatus");
        if (parsedStatus == null) {
            throw new ValidationException("STATUS_BLANK", "Status cannot be blank");
        }
        history.setNewStatus(parsedStatus);
        history.setChangedByUser(user);
        history.setComment(comment);
        return statusHistoryRepo.save(history);
    }

    public List<WarehouseInspection> getWarehouseInspections(Long returnId) {
        return inspectionRepo.findByReturnRequestId(returnId);
    }

    @Transactional
    public WarehouseInspection createWarehouseInspection(Long returnId, WarehouseInspectionRequest req, User user) {
        ReturnRequest rr = findById(returnId);
        WarehouseInspection inspection = new WarehouseInspection();
        inspection.setReturnRequest(rr);
        inspection.setInspectedByUser(user);
        if (req.warehouseDecision != null && !req.warehouseDecision.isBlank()) {
            inspection.setWarehouseDecision(EnumParser.parse(
                com.drb.server.domain.enums.WarehouseDecision.class, req.warehouseDecision, "warehouseDecision"));
        }
        if (req.itemCondition != null && !req.itemCondition.isBlank()) {
            inspection.setItemCondition(EnumParser.parse(
                com.drb.server.domain.enums.ItemCondition.class, req.itemCondition, "itemCondition"));
        }
        inspection.setCallFullyHandled(req.callFullyHandled);
        inspection.setWarehouseNotes(req.warehouseNotes);
        WarehouseInspection saved = inspectionRepo.save(inspection);
        transitionStatus(returnId, ReturnStatus.INSPECTED, user, "Warehouse inspection completed");
        return saved;
    }
}
