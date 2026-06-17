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
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.model.TimelineEntry;
import com.drb.driver.session.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.List;
import java.util.Locale;

public class PickupDetailsActivity extends AppCompatActivity {

    public static final String EXTRA_RETURN_ID = "return_id";

    private TextView tvCustomer, tvProduct, tvPrice, tvOrderNumber, tvOriginalDeliveryDate, tvReason, tvDefect, tvStatus;
    private TextView tvBarcode, tvBarcodeAssignedAt, tvBarcodeDriver, tvConfirmHint;
    private ImageView ivProductImage;
    private Button btnAssignBarcode, btnCaptureImage, btnConfirmPickup, btnViewHistory;
    private View barcodeAssignBlock;

    private SessionManager sessionManager;
    private Long returnId;
    private ReturnRequestModel cachedReturn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pickup_details);

        sessionManager = new SessionManager(this);
        returnId = getIntent().getLongExtra(EXTRA_RETURN_ID, -1L);

        HeaderHelper.setupSubScreen(this, R.string.pickup_details_title);

        tvCustomer = findViewById(R.id.tvCustomer);
        tvProduct = findViewById(R.id.tvProduct);
        tvPrice = findViewById(R.id.tvPrice);
        ivProductImage = findViewById(R.id.ivProductImage);
        tvOrderNumber = findViewById(R.id.tvOrderNumber);
        tvOriginalDeliveryDate = findViewById(R.id.tvOriginalDeliveryDate);
        tvReason = findViewById(R.id.tvReason);
        tvDefect = findViewById(R.id.tvDefect);
        tvStatus = findViewById(R.id.tvStatus);
        tvBarcode = findViewById(R.id.tvBarcode);
        tvBarcodeAssignedAt = findViewById(R.id.tvBarcodeAssignedAt);
        tvBarcodeDriver = findViewById(R.id.tvBarcodeDriver);
        barcodeAssignBlock = findViewById(R.id.barcodeAssignBlock);
        btnAssignBarcode = findViewById(R.id.btnAssignBarcode);
        btnCaptureImage = findViewById(R.id.btnCaptureImage);
        btnConfirmPickup = findViewById(R.id.btnConfirmPickup);
        btnViewHistory = findViewById(R.id.btnViewHistory);
        tvConfirmHint = findViewById(R.id.tvConfirmHint);

        btnAssignBarcode.setOnClickListener(v -> {
            Intent intent = new Intent(this, BarcodeAssignmentActivity.class);
            intent.putExtra(BarcodeAssignmentActivity.EXTRA_RETURN_ID, returnId);
            startActivityForResult(intent, 100);
        });

        btnCaptureImage.setOnClickListener(v -> {
            Intent intent = new Intent(this, ImageCaptureActivity.class);
            intent.putExtra(ImageCaptureActivity.EXTRA_RETURN_ID, returnId);
            startActivity(intent);
        });

        btnConfirmPickup.setOnClickListener(v -> {
            Intent intent = new Intent(this, PickupConfirmationActivity.class);
            intent.putExtra(PickupConfirmationActivity.EXTRA_RETURN_ID, returnId);
            startActivity(intent);
        });

        btnViewHistory.setOnClickListener(v -> loadAndShowTimeline());

        loadReturnDetails();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadReturnDetails();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 100 && resultCode == RESULT_OK) {
            loadReturnDetails();
        }
    }

    private void loadReturnDetails() {
        ApiClient.get(sessionManager).returnDetails(returnId).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                if (response.isSuccessful() && response.body() != null) {
                    cachedReturn = response.body();
                    bindUI(cachedReturn);
                } else {
                    Toast.makeText(PickupDetailsActivity.this, "Failed to load return details", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                Toast.makeText(PickupDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void bindUI(ReturnRequestModel r) {
        tvCustomer.setText("Customer: " + safe(r.customerName));
        if (r.customerAddress != null && !r.customerAddress.isEmpty()) {
            tvCustomer.append("\nAddress: " + r.customerAddress);
        }
        if (r.customerPhone != null && !r.customerPhone.isEmpty()) {
            tvCustomer.append("\nPhone: " + r.customerPhone);
        }
        tvProduct.setText("Product: " + ReturnCardBinder.formatProductQty(r));
        tvPrice.setText("Price: " + (r.productPrice != null ? String.format(Locale.US, "%.2f", r.productPrice) : "—"));
        tvOrderNumber.setText("Order: " + safe(r.orderNumber));
        tvOriginalDeliveryDate.setText("Original delivery: " + safe(r.originalDeliveryDate));
        tvReason.setText("Reason: " + safe(r.reason));

        if (r.productImageUrl != null && !r.productImageUrl.isEmpty()) {
            ivProductImage.setVisibility(View.VISIBLE);
            Glide.with(this).load(r.productImageUrl).into(ivProductImage);
        } else {
            ivProductImage.setVisibility(View.GONE);
        }
        tvDefect.setText("Defect: " + safe(r.defectDescription));
        ReturnCardBinder.applyStatusChip(tvStatus, r.status);

        tvBarcode.setText("Barcode: " + (r.isBarcodeAssigned() ? r.barcode : "Not assigned"));
        tvBarcodeAssignedAt.setText("Assigned At: " + safe(r.barcodeAssignedAt));
        tvBarcodeDriver.setText("Driver: " + safe(r.driverName));
        barcodeAssignBlock.setVisibility(r.isBarcodeAssigned() ? View.GONE : View.VISIBLE);

        boolean canConfirm = r.isStatusBarcodeAssigned() && r.hasDriverPhoto();
        btnConfirmPickup.setEnabled(canConfirm);
        if (canConfirm) {
            tvConfirmHint.setVisibility(View.GONE);
        } else {
            tvConfirmHint.setVisibility(View.VISIBLE);
            tvConfirmHint.setText(!r.isStatusBarcodeAssigned()
                ? "Assign a barcode and capture a photo to confirm pickup."
                : "Capture a photo to confirm pickup.");
        }
    }

    private void loadAndShowTimeline() {
        ApiClient.get(sessionManager).getTimeline(returnId).enqueue(new Callback<List<TimelineEntry>>() {
            @Override
            public void onResponse(Call<List<TimelineEntry>> call, Response<List<TimelineEntry>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    showTimelineDialog(response.body());
                } else {
                    Toast.makeText(PickupDetailsActivity.this, "Failed to load timeline", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<List<TimelineEntry>> call, Throwable t) {
                Toast.makeText(PickupDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showTimelineDialog(List<TimelineEntry> entries) {
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

    private String safe(String s) {
        return s != null ? s : "—";
    }
}
