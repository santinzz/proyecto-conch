import { describe, expect, test } from "vitest";
import { detectFileType, sha256Hex } from "./file";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("tipo de archivo", () => {
  test("reconoce JPG, PNG, WebP y PDF por su contenido", () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectFileType(ascii("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectFileType(ascii("%PDF-1.7\n"))).toBe("application/pdf");
  });

  test("rechaza lo demás aunque diga ser imagen", () => {
    expect(detectFileType(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(ascii("GIF89a"))).toBeNull();
    expect(detectFileType(bytes())).toBeNull();
  });
});

test("huella SHA-256 en hexadecimal", () => {
  expect(sha256Hex(ascii("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
