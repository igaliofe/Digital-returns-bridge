package com.drb.driver.ui;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import com.drb.driver.R;
import com.drb.driver.RemoteLogger;
import com.drb.driver.api.ApiClient;
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
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ImageCaptureActivity extends AppCompatActivity {

    public static final String EXTRA_RETURN_ID = "return_id";
    private static final int REQUEST_IMAGE_CAPTURE = 1;
    private static final int MAX_DIMENSION = 1600;

    // Driver image types (SHARED CONTRACT enum value strings).
    private static final String IMAGE_TYPE_DEFECT = "DRIVER_DEFECT_IMAGE";
    private static final String[] IMAGE_TYPE_LABELS = {"Product", "Distant", "Defect"};
    private static final String[] IMAGE_TYPE_VALUES = {
        "DRIVER_PRODUCT_IMAGE", "DRIVER_DISTANT_IMAGE", IMAGE_TYPE_DEFECT
    };

    private Spinner spinnerImageType;
    private TextView tvDefectRequired;
    private Button btnTakePhoto, btnUpload;
    private ImageView ivPreview;
    private ProgressBar progressBar;

    private File photoFile;
    private SessionManager sessionManager;
    private Long returnId;
    private boolean defectImagePresent = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_image_capture);
        HeaderHelper.setupSubScreen(this, R.string.capture_image_title);

        sessionManager = new SessionManager(this);
        returnId = getIntent().getLongExtra(EXTRA_RETURN_ID, -1L);

        spinnerImageType = findViewById(R.id.spinnerImageType);
        tvDefectRequired = findViewById(R.id.tvDefectRequired);
        btnTakePhoto = findViewById(R.id.btnTakePhoto);
        btnUpload = findViewById(R.id.btnUpload);
        ivPreview = findViewById(R.id.ivPreview);
        progressBar = findViewById(R.id.progressBar);

        ArrayAdapter<String> typeAdapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, IMAGE_TYPE_LABELS);
        typeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerImageType.setAdapter(typeAdapter);

        btnUpload.setEnabled(false);

        btnTakePhoto.setOnClickListener(v -> dispatchTakePictureIntent());
        btnUpload.setOnClickListener(v -> uploadPhoto());

        loadDefectImageStatus();
    }

    /** A defect photo is mandatory; check whether one already exists for this return. */
    private void loadDefectImageStatus() {
        ApiClient.get(sessionManager).returnDetails(returnId).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                defectImagePresent = false;
                if (response.isSuccessful() && response.body() != null && response.body().images != null) {
                    for (ReturnImageModel img : response.body().images) {
                        if (IMAGE_TYPE_DEFECT.equals(img.imageType)) {
                            defectImagePresent = true;
                            break;
                        }
                    }
                }
                updateDefectRequiredBanner();
                if (!defectImagePresent) {
                    // Guide the driver to capture the mandatory defect photo first.
                    spinnerImageType.setSelection(indexOf(IMAGE_TYPE_DEFECT));
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                updateDefectRequiredBanner();
            }
        });
    }

    private void updateDefectRequiredBanner() {
        if (defectImagePresent) {
            tvDefectRequired.setVisibility(View.GONE);
        } else {
            tvDefectRequired.setVisibility(View.VISIBLE);
            tvDefectRequired.setText("A defect photo (Defect) is required for this return.");
        }
    }

    private int indexOf(String value) {
        for (int i = 0; i < IMAGE_TYPE_VALUES.length; i++) {
            if (IMAGE_TYPE_VALUES[i].equals(value)) return i;
        }
        return 0;
    }

    private void dispatchTakePictureIntent() {
        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
            try {
                photoFile = createImageFile();
                Uri photoUri = FileProvider.getUriForFile(this,
                    getApplicationContext().getPackageName() + ".fileprovider", photoFile);
                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            } catch (IOException | IllegalArgumentException e) {
                RemoteLogger.e("ImageCaptureActivity", "Failed to create/resolve photo file", e);
                Toast.makeText(this, "Cannot create image file: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                return;
            }
            startActivityForResult(takePictureIntent, REQUEST_IMAGE_CAPTURE);
        } else {
            Toast.makeText(this, "No camera app available", Toast.LENGTH_SHORT).show();
        }
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        String imageFileName = "Tollmans_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_IMAGE_CAPTURE && resultCode == RESULT_OK && photoFile != null) {
            Bitmap scaled = resizeBitmap(photoFile.getAbsolutePath());
            if (scaled != null) {
                try (FileOutputStream fos = new FileOutputStream(photoFile)) {
                    scaled.compress(Bitmap.CompressFormat.JPEG, 85, fos);
                } catch (IOException e) {
                    Toast.makeText(this, "Failed to save resized image", Toast.LENGTH_SHORT).show();
                    return;
                }
                ivPreview.setImageBitmap(scaled);
                btnUpload.setEnabled(true);
            }
        }
    }

    private Bitmap resizeBitmap(String path) {
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, opts);

        int w = opts.outWidth;
        int h = opts.outHeight;
        int sampleSize = 1;
        while (w / sampleSize > MAX_DIMENSION || h / sampleSize > MAX_DIMENSION) {
            sampleSize *= 2;
        }

        opts.inJustDecodeBounds = false;
        opts.inSampleSize = sampleSize;
        Bitmap raw = BitmapFactory.decodeFile(path, opts);
        if (raw == null) return null;

        float scale = Math.min((float) MAX_DIMENSION / raw.getWidth(), (float) MAX_DIMENSION / raw.getHeight());
        if (scale < 1f) {
            int newW = Math.round(raw.getWidth() * scale);
            int newH = Math.round(raw.getHeight() * scale);
            Bitmap scaled = Bitmap.createScaledBitmap(raw, newW, newH, true);
            raw.recycle();
            raw = scaled;
        }
        return applyExifOrientation(path, raw);
    }

    /**
     * Bake the camera's EXIF Orientation into the pixels.
     *
     * A phone camera stores the frame as the sensor read it — usually landscape — and records
     * the correction as an EXIF tag rather than rotating the pixels. BitmapFactory ignores that
     * tag, and Bitmap.compress writes no EXIF at all, so re-encoding the file (which we do to
     * downscale it) would otherwise save sideways pixels with the only hint to rotate them
     * discarded. The result is unrecoverably rotated for every later viewer: the preview here,
     * Cloudinary, the web details page and the storekeeper's receiving screen.
     */
    private Bitmap applyExifOrientation(String path, Bitmap bitmap) {
        int orientation;
        try {
            orientation = new ExifInterface(path).getAttributeInt(
                ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
        } catch (IOException e) {
            RemoteLogger.e("ImageCaptureActivity", "Cannot read EXIF orientation from " + path, e);
            return bitmap;
        }

        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_ROTATE_90:
                matrix.postRotate(90f);
                break;
            case ExifInterface.ORIENTATION_ROTATE_180:
                matrix.postRotate(180f);
                break;
            case ExifInterface.ORIENTATION_ROTATE_270:
                matrix.postRotate(270f);
                break;
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:
                matrix.postScale(-1f, 1f);
                break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL:
                matrix.postScale(1f, -1f);
                break;
            case ExifInterface.ORIENTATION_TRANSPOSE:
                matrix.postRotate(90f);
                matrix.postScale(-1f, 1f);
                break;
            case ExifInterface.ORIENTATION_TRANSVERSE:
                matrix.postRotate(270f);
                matrix.postScale(-1f, 1f);
                break;
            default:
                // ORIENTATION_NORMAL or UNDEFINED — the pixels are already upright.
                return bitmap;
        }

        Bitmap oriented = Bitmap.createBitmap(
            bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
        if (oriented != bitmap) {
            bitmap.recycle();
        }
        return oriented;
    }

    private void uploadPhoto() {
        if (photoFile == null || !photoFile.exists()) {
            Toast.makeText(this, "No photo to upload", Toast.LENGTH_SHORT).show();
            return;
        }

        int selectedIndex = spinnerImageType.getSelectedItemPosition();
        if (selectedIndex < 0) selectedIndex = 0;
        final String selectedType = IMAGE_TYPE_VALUES[selectedIndex];

        // Enforce that the mandatory defect photo is captured before any other type.
        if (!defectImagePresent && !IMAGE_TYPE_DEFECT.equals(selectedType)) {
            Toast.makeText(this, "Please capture and upload the required defect photo first.",
                Toast.LENGTH_LONG).show();
            return;
        }

        btnUpload.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);

        RequestBody fileBody = RequestBody.create(MediaType.parse("image/jpeg"), photoFile);
        MultipartBody.Part filePart = MultipartBody.Part.createFormData("file", photoFile.getName(), fileBody);
        RequestBody imageType = RequestBody.create(MediaType.parse("text/plain"), selectedType);

        ApiClient.get(sessionManager).uploadImage(returnId, filePart, imageType).enqueue(new Callback<ReturnImageModel>() {
            @Override
            public void onResponse(Call<ReturnImageModel> call, Response<ReturnImageModel> response) {
                progressBar.setVisibility(View.GONE);
                btnUpload.setEnabled(true);
                if (response.isSuccessful()) {
                    if (IMAGE_TYPE_DEFECT.equals(selectedType)) {
                        defectImagePresent = true;
                        updateDefectRequiredBanner();
                    }
                    Toast.makeText(ImageCaptureActivity.this, "Image uploaded successfully!", Toast.LENGTH_SHORT).show();
                    finish();
                } else {
                    String body = "";
                    try {
                        if (response.errorBody() != null) body = " body=" + response.errorBody().string();
                    } catch (IOException ignored) {
                        // best-effort: the status code below is still logged
                    }
                    String msg = "Upload failed: HTTP " + response.code() + " for returnId=" + returnId
                        + " type=" + selectedType + body;
                    RemoteLogger.e("ImageCaptureActivity", msg);
                    Toast.makeText(ImageCaptureActivity.this, "Upload failed: " + response.code(), Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnImageModel> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnUpload.setEnabled(true);
                RemoteLogger.e("ImageCaptureActivity", "Upload network error for returnId=" + returnId, t);
                Toast.makeText(ImageCaptureActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
