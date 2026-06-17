# Figma UI Fidelity — Gaps & Resolution Log

> Source of truth: [Figma — Digital Returns Bridge Screen Designs](https://www.figma.com/design/QLMlsSFt51XHxZAyUNeI2U/Digital-Returns-Bridge-%E2%80%94-Screen-Designs).
> This file tracks where the implemented Android UI diverged from the Figma frames and how each gap was closed. (An earlier version of the docs claimed "pixel-perfect, no gaps" and linked a file that did not exist — that claim was inaccurate and is replaced by this living log.)

## Android — gaps found & fixed

| Screen | Gap vs Figma | Resolution |
|---|---|---|
| All sub-screens | No top app bar / back arrow (theme is `NoActionBar`, so `setTitle()` was invisible) | Added a back arrow to `include_drb_header`; `HeaderHelper.setupSubScreen()` sets title + back on every sub-screen |
| Pickup Details | "Assign Barcode" was a small unstyled `<Button>`, hidden once a barcode existed | Full-width `DrbButton.Gold` entry inside the barcode card; barcode/assigned-at/driver lines always shown |
| Pickup Details | Status rendered as plain `"Status: …"` text | Rendered as a colored chip via `ReturnCardBinder.applyStatusChip()` |
| Pickup Details | Action buttons wrong order/colors | Order Capture Image → Confirm Pickup → View History; Capture Image navy (`Primary`), View History `Outlined` |
| Pickup Details / Pickup Confirmation | Confirm Pickup enabled on barcode only | Gated on barcode **and** a driver photo (`ReturnRequestModel.hasDriverPhoto()`); disabled-reason hint shown |
| Assign Barcode | Field hint generic ("Barcode") | "Scan or type barcode" |
| Image Capture / Pickup Confirmation | Bare unstyled buttons | `DrbButton.Primary` / `DrbButton.Outlined` |
| Scan Barcode (warehouse) | No viewfinder; buttons "Scan Barcode"/"Look up" | Dashed viewfinder placeholder; **Search** (`Primary`) + **Open Scanner** (`Outlined`); instruction reworded |
| Return File (warehouse) | Bare buttons | **Mark as Arrived** (`DrbButton.Gold`), **Start Inspection** (`Primary`), View History (`Outlined`); status chip |
| Inspection (warehouse) | Bare submit button | **Save Inspection** (`Primary`); Request More Info (`Outlined`) |

## Known remaining gaps

- **Scan Barcode** uses a *decorative* viewfinder + full-screen ZXing scanner rather than an embedded live camera preview.
- Pixel-exact spacing/typography was matched against Figma thumbnails + brand tokens (`colors.xml`, `dimens.xml`), not a frame-by-frame measurement. Re-verify against the Figma file if exact metrics are required.
