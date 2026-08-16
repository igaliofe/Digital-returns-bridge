package com.drb.server.web;

import com.drb.server.domain.Driver;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.service.DriverService;
import com.drb.server.service.EnumParser;
import com.drb.server.service.ReturnRequestService;
import jakarta.annotation.PostConstruct;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import java.io.Serializable;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Named
@ViewScoped
public class ReturnListBean implements Serializable {

    @Inject
    private ReturnRequestService returnService;

    @Inject
    private DriverService driverService;

    private List<ReturnRequest> returns;
    private List<Driver> drivers;
    private String filterStatus;
    private Long filterDriverId;
    private String filterCustomerQuery;
    private String filterBarcode;
    private boolean filterHasNoBarcode;

    @PostConstruct
    public void init() {
        drivers = driverService.findActive();
        load();
    }

    public void load() {
        if (filterStatus != null && !filterStatus.isBlank()) {
            returns = returnService.findByStatus(
                EnumParser.parse(ReturnStatus.class, filterStatus, "filterStatus"));
        } else if (filterDriverId != null) {
            returns = returnService.findByDriverId(filterDriverId);
        } else {
            returns = returnService.findAll();
        }

        if (filterHasNoBarcode) {
            returns = returns.stream()
                .filter(r -> r.getBarcode() == null)
                .collect(Collectors.toList());
        }

        if (filterCustomerQuery != null && !filterCustomerQuery.isBlank()) {
            String q = filterCustomerQuery.toLowerCase(Locale.ROOT);
            returns = returns.stream()
                .filter(r -> r.getCustomer() != null
                    && (containsIgnoreCase(r.getCustomer().getFullName(), q)
                        || containsIgnoreCase(r.getCustomer().getPhone(), q)))
                .collect(Collectors.toList());
        }

        if (filterBarcode != null && !filterBarcode.isBlank()) {
            String b = filterBarcode.trim();
            returns = returns.stream()
                .filter(r -> r.getBarcode() != null && r.getBarcode().contains(b))
                .collect(Collectors.toList());
        }
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    public List<ReturnRequest> getReturns() { return returns; }
    public List<Driver> getDrivers() { return drivers; }

    public String getFilterStatus() { return filterStatus; }
    public void setFilterStatus(String s) { this.filterStatus = s; }

    public Long getFilterDriverId() { return filterDriverId; }
    public void setFilterDriverId(Long filterDriverId) { this.filterDriverId = filterDriverId; }

    public String getFilterCustomerQuery() { return filterCustomerQuery; }
    public void setFilterCustomerQuery(String filterCustomerQuery) { this.filterCustomerQuery = filterCustomerQuery; }

    public String getFilterBarcode() { return filterBarcode; }
    public void setFilterBarcode(String filterBarcode) { this.filterBarcode = filterBarcode; }

    public boolean isFilterHasNoBarcode() { return filterHasNoBarcode; }
    public void setFilterHasNoBarcode(boolean b) { this.filterHasNoBarcode = b; }

    public ReturnStatus[] getStatuses() { return ReturnStatus.values(); }
}
