package com.drb.driver.ui;

import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.PickupConfirmationRequest;
import com.drb.driver.model.ReturnImageModel;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.session.SessionManager;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class PickupConfirmationActivity extends AppCompatActivity {

    public static final String EXTRA_RETURN_ID = "return_id";

    // SHARED CONTRACT enum value strings (sent to the server exactly as-is).
    private static final String[] ITEM_CONDITIONS = {
        "LIKE_NEW_ORIGINAL_PACKAGING",
        "LIKE_NEW_NO_PACKAGING",
        "USED",
        "USED_MINOR_DEFECT",
        "SIGNIFICANTLY_DEFECTIVE"
    };

    private static final String NONE_OPTION = "(none)";

    private static final String[] DEFECT_TYPES = {
        NONE_OPTION,
        "TEAR", "SCRATCH", "BREAK", "MISSING_PART", "FADED_COLOR",
        "RUST", "DENT", "REVERSED_SIDE", "ELECTRONIC_FAULT"
    };

    private static final String[] DEFECT_LOCATIONS = {
        NONE_OPTION,
        "RIGHT_SEAT", "LEFT_SEAT", "SEAT", "LEGS", "BACK", "OTHER"
    };

    private Spinner spinnerCondition, spinnerDefectType, spinnerDefectLocation;
    private EditText etDefectLocationOther;
    private CheckBox cbItemCollected;
    private EditText etNotes;
    private SignatureView signatureView;
    private Button btnClearSignature, btnConfirm;

    private SessionManager sessionManager;
    private Long returnId;
    private boolean barcodeAssigned = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pickup_confirmation);

        sessionManager = new SessionManager(this);
        returnId = getIntent().getLongExtra(EXTRA_RETURN_ID, -1L);

        spinnerCondition = findViewById(R.id.spinnerCondition);
        spinnerDefectType = findViewById(R.id.spinnerDefectType);
        spinnerDefectLocation = findViewById(R.id.spinnerDefectLocation);
        etDefectLocationOther = findViewById(R.id.etDefectLocationOther);
        cbItemCollected = findViewById(R.id.cbItemCollected);
        etNotes = findViewById(R.id.etNotes);
        signatureView = findViewById(R.id.signatureView);
        btnClearSignature = findViewById(R.id.btnClearSignature);
        btnConfirm = findViewById(R.id.btnConfirm);

        spinnerCondition.setAdapter(buildAdapter(ITEM_CONDITIONS));
        spinnerDefectType.setAdapter(buildAdapter(DEFECT_TYPES));
        spinnerDefectLocation.setAdapter(buildAdapter(DEFECT_LOCATIONS));

        etDefectLocationOther.setVisibility(View.GONE);
        spinnerDefectLocation.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                boolean isOther = "OTHER".equals(DEFECT_LOCATIONS[position]);
                etDefectLocationOther.setVisibility(isOther ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) { }
        });

        btnClearSignature.setOnClickListener(v -> signatureView.clear());

        btnConfirm.setEnabled(false);
        loadReturnAndEnableButton();

        btnConfirm.setOnClickListener(v -> onConfirmClicked());
    }

    private ArrayAdapter<String> buildAdapter(String[] values) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, values);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        return adapter;
    }

    private void loadReturnAndEnableButton() {
        ApiClient.get(sessionManager).returnDetails(returnId).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                if (response.isSuccessful() && response.body() != null) {
                    ReturnRequestModel r = response.body();
                    barcodeAssigned = r.isStatusBarcodeAssigned();
                    btnConfirm.setEnabled(barcodeAssigned);
                    if (!barcodeAssigned) {
                        Toast.makeText(PickupConfirmationActivity.this,
                            "Confirm button disabled: barcode not yet assigned", Toast.LENGTH_LONG).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                Toast.makeText(PickupConfirmationActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void onConfirmClicked() {
        String defectLocation = (String) spinnerDefectLocation.getSelectedItem();
        String defectLocationOther = etDefectLocationOther.getText() != null
            ? etDefectLocationOther.getText().toString().trim() : "";
        if ("OTHER".equals(defectLocation) && defectLocationOther.isEmpty()) {
            Toast.makeText(this, "Please describe the defect location", Toast.LENGTH_LONG).show();
            return;
        }

        if (signatureView.isEmpty()) {
            Toast.makeText(this, "A driver signature is required", Toast.LENGTH_LONG).show();
            return;
        }

        File signatureFile = saveSignatureToFile();
        if (signatureFile == null) {
            Toast.makeText(this, "Failed to capture signature", Toast.LENGTH_LONG).show();
            return;
        }

        btnConfirm.setEnabled(false);
        // Upload the drawn signature first, then submit the confirmation.
        uploadSignature(signatureFile);
    }

    private File saveSignatureToFile() {
        Bitmap bitmap = signatureView.getSignatureBitmap();
        if (bitmap == null) {
            return null;
        }
        File file = new File(getCacheDir(), "driver_signature_" + returnId + ".png");
        try (FileOutputStream fos = new FileOutputStream(file)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
            return file;
        } catch (IOException e) {
            return null;
        }
    }

    private void uploadSignature(File signatureFile) {
        RequestBody fileBody = RequestBody.create(MediaType.parse("image/png"), signatureFile);
        MultipartBody.Part filePart = MultipartBody.Part.createFormData("file", signatureFile.getName(), fileBody);
        RequestBody imageType = RequestBody.create(MediaType.parse("text/plain"), "DRIVER_SIGNATURE");

        ApiClient.get(sessionManager).uploadImage(returnId, filePart, imageType).enqueue(new Callback<ReturnImageModel>() {
            @Override
            public void onResponse(Call<ReturnImageModel> call, Response<ReturnImageModel> response) {
                if (response.isSuccessful()) {
                    submitConfirmation();
                } else {
                    btnConfirm.setEnabled(true);
                    Toast.makeText(PickupConfirmationActivity.this,
                        "Signature upload failed: " + response.code(), Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnImageModel> call, Throwable t) {
                btnConfirm.setEnabled(true);
                Toast.makeText(PickupConfirmationActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void submitConfirmation() {
        PickupConfirmationRequest req = new PickupConfirmationRequest();
        req.driverId = sessionManager.getDriverId();
        req.itemCondition = (String) spinnerCondition.getSelectedItem();
        req.itemCollected = cbItemCollected.isChecked();
        req.driverNotes = etNotes.getText() != null ? etNotes.getText().toString().trim() : "";

        String defectType = (String) spinnerDefectType.getSelectedItem();
        req.defectType = NONE_OPTION.equals(defectType) ? null : defectType;

        String defectLocation = (String) spinnerDefectLocation.getSelectedItem();
        req.defectLocation = NONE_OPTION.equals(defectLocation) ? null : defectLocation;

        if ("OTHER".equals(req.defectLocation)) {
            req.defectLocationOther = etDefectLocationOther.getText() != null
                ? etDefectLocationOther.getText().toString().trim() : null;
        } else {
            req.defectLocationOther = null;
        }

        ApiClient.get(sessionManager).pickupConfirmation(returnId, req).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                btnConfirm.setEnabled(true);
                if (response.isSuccessful()) {
                    Toast.makeText(PickupConfirmationActivity.this, "Pickup confirmed!", Toast.LENGTH_SHORT).show();
                    finish();
                } else if (response.code() == 409) {
                    Toast.makeText(PickupConfirmationActivity.this,
                        "Cannot confirm pickup — barcode not yet assigned", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(PickupConfirmationActivity.this,
                        "Error " + response.code(), Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                btnConfirm.setEnabled(true);
                Toast.makeText(PickupConfirmationActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
