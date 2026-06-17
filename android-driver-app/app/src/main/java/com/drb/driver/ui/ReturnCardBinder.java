package com.drb.driver.ui;

import android.content.Context;
import android.view.View;
import android.widget.TextView;
import com.drb.driver.R;
import com.drb.driver.model.ReturnRequestModel;

public final class ReturnCardBinder {

    private ReturnCardBinder() { }

    public static void bind(View itemView, ReturnRequestModel item, boolean showBarcode) {
        TextView tvCustomerName = itemView.findViewById(R.id.tvCustomerName);
        TextView tvAddress = itemView.findViewById(R.id.tvAddress);
        TextView tvProduct = itemView.findViewById(R.id.tvProduct);
        TextView tvBarcode = itemView.findViewById(R.id.tvBarcode);
        TextView tvStatus = itemView.findViewById(R.id.tvStatus);

        tvCustomerName.setText(item.customerName != null ? item.customerName : "—");
        tvAddress.setText(item.customerAddress != null ? item.customerAddress : "—");
        tvProduct.setText(formatProductQty(item));
        tvStatus.setText(formatStatusLabel(item.status));
        applyStatusStyle(itemView.getContext(), tvStatus, item.status);

        if (showBarcode) {
            tvBarcode.setVisibility(View.VISIBLE);
            tvBarcode.setText(item.isBarcodeAssigned() ? item.barcode : "Barcode: Not assigned");
        } else {
            tvBarcode.setVisibility(View.GONE);
        }
    }

    /**
     * Render a status as the same colored chip used in pickup/queue cards.
     * Reused by detail screens so the status reads as a chip, not plain text.
     */
    public static void applyStatusChip(TextView tvStatus, String status) {
        tvStatus.setText(formatStatusLabel(status));
        applyStatusStyle(tvStatus.getContext(), tvStatus, status);
    }

    public static String formatProductQty(ReturnRequestModel item) {
        String name = item.productName != null ? item.productName : "—";
        if (item.quantity != null && item.quantity > 0) {
            return name + " × " + item.quantity;
        }
        return name;
    }

    private static String formatStatusLabel(String status) {
        if (status == null) {
            return "—";
        }
        switch (status) {
            case "WAITING_FOR_PICKUP":
                return "Waiting for pickup";
            case "BARCODE_ASSIGNED":
                return "Barcode assigned";
            case "PICKED_UP":
                return "Picked up";
            case "ARRIVED_TO_WAREHOUSE":
                return "In warehouse";
            case "INSPECTED":
                return "Inspected";
            case "CLOSED":
                return "Closed";
            case "OPEN":
                return "Open";
            case "NEEDS_MORE_INFO":
                return "Needs more info";
            default:
                return status.replace('_', ' ').toLowerCase();
        }
    }

    private static void applyStatusStyle(Context context, TextView tvStatus, String status) {
        int bgRes = R.drawable.bg_chip_warehouse;
        int colorRes = R.color.drb_text_secondary;

        if (status != null) {
            switch (status) {
                case "WAITING_FOR_PICKUP":
                    bgRes = R.drawable.bg_chip_waiting;
                    colorRes = R.color.drb_status_waiting_text;
                    break;
                case "BARCODE_ASSIGNED":
                    bgRes = R.drawable.bg_chip_barcode;
                    colorRes = R.color.drb_status_barcode_text;
                    break;
                case "PICKED_UP":
                    bgRes = R.drawable.bg_chip_picked;
                    colorRes = R.color.drb_status_picked_text;
                    break;
                case "OPEN":
                    bgRes = R.drawable.bg_chip_open;
                    colorRes = R.color.drb_status_open_text;
                    break;
                case "ARRIVED_TO_WAREHOUSE":
                case "INSPECTED":
                    bgRes = R.drawable.bg_chip_warehouse;
                    colorRes = R.color.drb_status_warehouse_text;
                    break;
                case "CLOSED":
                    bgRes = R.drawable.bg_chip_closed;
                    colorRes = R.color.drb_status_closed_text;
                    break;
                default:
                    break;
            }
        }

        tvStatus.setBackgroundResource(bgRes);
        tvStatus.setTextColor(context.getColor(colorRes));
    }
}
