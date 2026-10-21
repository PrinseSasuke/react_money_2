// «Из галереи» (ТЗ): pick a photo or a screenshot, look for the QR on the phone itself.
import * as ImagePicker from "expo-image-picker";
import { loadImage } from "react-native-nitro-image";
import { createBarcodeScanner } from "react-native-vision-camera-barcode-scanner";
import { parseFnsQr } from "@react-money/shared";

export type GalleryResult =
  | { kind: "cancelled" }
  | { kind: "qr"; qr: string }
  /** no FNS QR on the picture: the photo itself can be sent to receipts-api */
  | { kind: "photo"; uri: string; mimeType: string };

export async function pickReceiptImage(): Promise<GalleryResult> {
  // the system photo picker: no storage permission needed on Android 13+
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, exif: false });
  if (res.canceled || !res.assets[0]) return { kind: "cancelled" };
  const asset = res.assets[0];

  const image = await loadImage({ filePath: asset.uri.replace(/^file:\/\//, "") });
  const scanner = createBarcodeScanner({ barcodeFormats: ["qr-code"] });
  try {
    const codes = await scanner.scanCodesInImageAsync(image);
    for (const c of codes) {
      if (c.rawValue && parseFnsQr(c.rawValue).ok) return { kind: "qr", qr: c.rawValue };
    }
  } finally {
    image.dispose();
    scanner.dispose();
  }
  return { kind: "photo", uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}
