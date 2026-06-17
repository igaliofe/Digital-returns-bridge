package com.drb.driver.api;

import com.drb.driver.model.AssignBarcodeRequest;
import com.drb.driver.model.LogRequest;
import com.drb.driver.model.DriverModel;
import com.drb.driver.model.LoginRequest;
import com.drb.driver.model.LoginResponse;
import com.drb.driver.model.PickupConfirmationRequest;
import com.drb.driver.model.PickupUpdateModel;
import com.drb.driver.model.ReturnImageModel;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.model.StatusUpdateRequest;
import com.drb.driver.model.TimelineEntry;
import com.drb.driver.model.UserModel;
import com.drb.driver.model.WarehouseInspectionModel;
import com.drb.driver.model.WarehouseInspectionRequest;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Multipart;
import retrofit2.http.PATCH;
import retrofit2.http.POST;
import retrofit2.http.Part;
import retrofit2.http.Path;
import retrofit2.http.Query;

import java.util.List;

public interface DrbApi {

    @POST("auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @GET("auth/me")
    Call<UserModel> me();

    @POST("auth/logout")
    Call<Void> logout();

    @GET("drivers")
    Call<List<DriverModel>> listDrivers();

    @GET("drivers/{driverId}/pickups")
    Call<List<ReturnRequestModel>> myPickups(@Path("driverId") Long driverId);

    @GET("returns/{returnId}")
    Call<ReturnRequestModel> returnDetails(@Path("returnId") Long returnId);

    @GET("returns/{returnId}/timeline")
    Call<List<TimelineEntry>> getTimeline(@Path("returnId") Long returnId);

    @PATCH("returns/{returnId}/assign-barcode")
    Call<ReturnRequestModel> assignBarcode(
        @Path("returnId") Long returnId,
        @Body AssignBarcodeRequest request);

    @POST("returns/{returnId}/pickup-confirmation")
    Call<ReturnRequestModel> pickupConfirmation(
        @Path("returnId") Long returnId,
        @Body PickupConfirmationRequest request);

    @Multipart
    @POST("returns/{returnId}/images")
    Call<ReturnImageModel> uploadImage(
        @Path("returnId") Long returnId,
        @Part MultipartBody.Part file,
        @Part("imageType") RequestBody imageType);

    // ──────────────────────── Storekeeper (WAREHOUSE) ────────────────────────

    @GET("warehouse/returns/{barcode}")
    Call<ReturnRequestModel> warehouseReturnByBarcode(@Path("barcode") String barcode);

    @POST("warehouse/arrivals/{barcode}")
    Call<ReturnRequestModel> markArrived(@Path("barcode") String barcode);

    @POST("returns/{returnId}/warehouse-inspections")
    Call<WarehouseInspectionModel> createWarehouseInspection(
        @Path("returnId") Long returnId,
        @Body WarehouseInspectionRequest request);

    // ──────────────────────── Shared reads / transitions ────────────────────────

    @GET("returns")
    Call<List<ReturnRequestModel>> getReturnsByStatus(@Query("status") String status);

    @PATCH("returns/{returnId}/status")
    Call<ReturnRequestModel> updateStatus(
        @Path("returnId") Long returnId,
        @Body StatusUpdateRequest request);

    @GET("returns/{returnId}/images")
    Call<List<ReturnImageModel>> getImages(@Path("returnId") Long returnId);

    @GET("returns/{returnId}/pickup-updates")
    Call<List<PickupUpdateModel>> getPickupUpdates(@Path("returnId") Long returnId);

    @GET("returns/{returnId}/status-history")
    Call<List<TimelineEntry>> getStatusHistory(@Path("returnId") Long returnId);

    @POST("debug/logs")
    Call<Void> postLog(@Body LogRequest request);
}
