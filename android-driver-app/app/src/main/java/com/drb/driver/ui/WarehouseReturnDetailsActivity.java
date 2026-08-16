package com.drb.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.bumptech.glide.Glide;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.api.ApiErrors;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.model.TimelineEntry;
import com.drb.driver.session.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.List;
import java.util.Locale;

public class WarehouseReturnDetailsActivity extends AppCompatActivity {

    public static final String EXTRA_BARCODE = "barcode";
    public static final String EXTRA_RETURN_ID = "return_id";

    private static final String STATUS_PICKED_UP = "PICKED_UP";
    private static final String STATUS_ARRIVED = "ARRIVED_TO_WAREHOUSE";
    private static final String STATUS_NEEDS_MORE_INFO = "NEEDS_MORE_INFO";

    private TextView tvCustomer, tvProduct, tvSku, tvPrice, tvOrderNumber, tvReturnDate, tvReason, tvBarcode, tvStatus;
    private ImageView ivProductImage;
    private Button btnMarkArrived, btnInspect, btnViewHistory;

    private SessionManager sessionManager;
    private String barcode;
    private Long returnId;
    private ReturnRequestModel cachedReturn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_warehouse_return_details);
        HeaderHelper.setupSubScreen(this, R.string.wh_details_title);

        sessionManager = new SessionManager(this);
        barcode = getIntent().getStringExtra(EXTRA_BARCODE);
        returnId = getIntent().getLongExtra(EXTRA_RETURN_ID, -1L);

        tvCustomer = findViewById(R.id.tvCustomer);
        tvProduct = findViewById(R.id.tvProduct);
        tvSku = findViewById(R.id.tvSku);
        tvPrice = findViewById(R.id.tvPrice);
        tvOrderNumber = findViewById(R.id.tvOrderNumber);
        tvReturnDate = findViewById(R.id.tvReturnDate);
        tvReason = findViewById(R.id.tvReason);
        tvBarcode = findViewById(R.id.tvBarcode);
        tvStatus = findViewById(R.id.tvStatus);
        ivProductImage = findViewById(R.id.ivProductImage);
        btnMarkArrived = findViewById(R.id.btnMarkArrived);
        btnInspect = findViewById(R.id.btnInspect);
        btnViewHistory = findViewById(R.id.btnViewHistory);

        btnMarkArrived.setOnClickListener(v -> markArrived());
        btnInspect.setOnClickListener(v -> openInspection());
        btnViewHistory.setOnClickListener(v -> loadAndShowHistory());

        loadReturn();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadReturn();
    }

    private void loadReturn() {
        Callback<ReturnRequestModel> cb = new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                if (response.isSuccessful() && response.body() != null) {
                    cachedReturn = response.body();
                    if (cachedReturn.id != null) returnId = cachedReturn.id;
                    if (cachedReturn.barcode != null) barcode = cachedReturn.barcode;
                    bindUI(cachedReturn);
                } else {
                    Toast.makeText(WarehouseReturnDetailsActivity.this, "Failed to load return details", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                Toast.makeText(WarehouseReturnDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        };

        if (barcode != null && !barcode.isEmpty()) {
            ApiClient.get(sessionManager).warehouseReturnByBarcode(barcode).enqueue(cb);
        } else if (returnId != null && returnId != -1L) {
            ApiClient.get(sessionManager).returnDetails(returnId).enqueue(cb);
        } else {
            Toast.makeText(this, "No barcode or return id provided", Toast.LENGTH_LONG).show();
        }
    }

    private void bindUI(ReturnRequestModel r) {
        tvCustomer.setText("Customer: " + safe(r.customerName));
        tvProduct.setText("Item: " + safe(r.productName));
        tvSku.setText("SKU: " + safe(r.productSku));
        tvPrice.setText("Price: " + (r.productPrice != null ? String.format(Locale.US, "%.2f", r.productPrice) : "—"));
        tvOrderNumber.setText("Order: " + safe(r.orderNumber));
        tvReturnDate.setText("Return date: " + safe(r.createdAt));
        tvReason.setText("Reason: " + safe(r.returnReason != null ? r.returnReason : r.reason));
        tvBarcode.setText("Barcode: " + safe(r.barcode));
        ReturnCardBinder.applyStatusChip(tvStatus, r.status);

        if (r.productImageUrl != null && !r.productImageUrl.isEmpty()) {
            ivProductImage.setVisibility(View.VISIBLE);
            Glide.with(this).load(r.productImageUrl).into(ivProductImage);
        } else {
            ivProductImage.setVisibility(View.GONE);
        }

        boolean canMarkArrived = STATUS_PICKED_UP.equals(r.status);
        boolean canInspect = STATUS_ARRIVED.equals(r.status) || STATUS_NEEDS_MORE_INFO.equals(r.status);
        btnMarkArrived.setEnabled(canMarkArrived);
        btnInspect.setEnabled(canInspect);
    }

    private void markArrived() {
        if (barcode == null || barcode.isEmpty()) {
            Toast.makeText(this, "No barcode to mark arrived", Toast.LENGTH_LONG).show();
            return;
        }
        btnMarkArrived.setEnabled(false);
        ApiClient.get(sessionManager).markArrived(barcode).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Toast.makeText(WarehouseReturnDetailsActivity.this, "Marked as arrived to warehouse", Toast.LENGTH_SHORT).show();
                    cachedReturn = response.body();
                    bindUI(cachedReturn);
                } else {
                    btnMarkArrived.setEnabled(true);
                    handleError(response);
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                btnMarkArrived.setEnabled(true);
                Toast.makeText(WarehouseReturnDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void openInspection() {
        if (returnId == null || returnId == -1L) {
            Toast.makeText(this, "Return id unavailable", Toast.LENGTH_LONG).show();
            return;
        }
        Intent intent = new Intent(this, WarehouseInspectionActivity.class);
        intent.putExtra(WarehouseInspectionActivity.EXTRA_RETURN_ID, returnId);
        startActivity(intent);
    }

    private void loadAndShowHistory() {
        if (returnId == null || returnId == -1L) {
            return;
        }
        ApiClient.get(sessionManager).getStatusHistory(returnId).enqueue(new Callback<List<TimelineEntry>>() {
            @Override
            public void onResponse(Call<List<TimelineEntry>> call, Response<List<TimelineEntry>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    showHistoryDialog(response.body());
                } else {
                    Toast.makeText(WarehouseReturnDetailsActivity.this, "Failed to load history", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<List<TimelineEntry>> call, Throwable t) {
                Toast.makeText(WarehouseReturnDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showHistoryDialog(List<TimelineEntry> entries) {
        StringBuilder sb = new StringBuilder();
        if (entries.isEmpty()) {
            sb.append("No history yet.");
        } else {
            for (TimelineEntry e : entries) {
                sb.append(safe(e.changedAt)).append("\n");
                sb.append(safe(e.oldStatus)).append(" → ").append(safe(e.newStatus));
                if (e.comment != null && !e.comment.isEmpty()) {
                    sb.append("\n").append(e.comment);
                }
                sb.append("\n\n");
            }
        }
        new AlertDialog.Builder(this)
            .setTitle("Status History")
            .setMessage(sb.toString().trim())
            .setPositiveButton("Close", null)
            .show();
    }

    private void handleError(Response<?> response) {
        if (ApiErrors.isConcurrentModification(response)) {
            Toast.makeText(this, ApiErrors.CONCURRENT_MODIFICATION_MESSAGE, Toast.LENGTH_LONG).show();
            return;
        }
        int code = response.code();
        String msg;
        switch (code) {
            case 403: msg = "Not permitted for your role"; break;
            case 404: msg = "Return not found"; break;
            case 409: msg = "Invalid status transition"; break;
            default:  msg = "Error " + code; break;
        }
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private String safe(String s) {
        return s != null ? s : "—";
    }
}
