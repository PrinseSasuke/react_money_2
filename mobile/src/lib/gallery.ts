// «Из галереи» (ТЗ): pick a photo or a screenshot, look for the QR on the phone itself.
import * as ImagePicker from "expo-image-picker";
import { loadImage, type Image } from "react-native-nitro-image";
import { createBarcodeScanner, type BarcodeScanner } from "react-native-vision-camera-barcode-scanner";
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
    const qr = await findFnsQr(scanner, image);
    if (qr) return { kind: "qr", qr };
  } finally {
    image.dispose();
    scanner.dispose();
  }
  return { kind: "photo", uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}

const SCALED_SIDE = 1600;

/**
 * A photo of a receipt lying on a table: the QR is a small part of a 12-50 MP picture and the detector
 * misses it. Passes from cheap to expensive, stop at the first FNS QR:
 * the whole picture → a copy scaled to 1600 px → 2×2 and 3×3 overlapping tiles (the QR grows in each tile).
 */
async function findFnsQr(scanner: BarcodeScanner, image: Image): Promise<string | null> {
  const tryOne = async (img: Image, pass: string) => {
    const codes = await scanner.scanCodesInImageAsync(img);
    if (__DEV__) console.log(`[gallery] ${pass} ${img.width}x${img.height}: ${codes.length} code(s)`);
    return codes.map((c) => c.rawValue).find((v): v is string => !!v && parseFnsQr(v).ok) ?? null;
  };
  const owned: Image[] = [];
  try {
    let found = await tryOne(image, "full");
    if (found) return found;

    const long = Math.max(image.width, image.height);
    if (long > SCALED_SIDE) {
      const k = SCALED_SIDE / long;
      const scaled = await image.resizeAsync(Math.round(image.width * k), Math.round(image.height * k));
      owned.push(scaled);
      found = await tryOne(scaled, "scaled");
      if (found) return found;
    }

    for (const n of [2, 3]) {
      const w = image.width / n;
      const h = image.height / n;
      // each tile is 1.5 cells wide/high, so a QR on a border is whole in some tile
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const x0 = Math.max(0, Math.round(col * w - w / 4));
          const y0 = Math.max(0, Math.round(row * h - h / 4));
          const x1 = Math.min(image.width, Math.round((col + 1) * w + w / 4));
          const y1 = Math.min(image.height, Math.round((row + 1) * h + h / 4));
          const tile = await image.cropAsync(x0, y0, x1, y1);
          owned.push(tile);
          found = await tryOne(tile, `tile ${n}x${n} ${row},${col}`);
          if (found) return found;
        }
      }
    }
    return null;
  } finally {
    owned.forEach((i) => i.dispose());
  }
}
