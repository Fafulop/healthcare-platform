import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const imgData = await readFile(join(process.cwd(), "public", "apple-icon-source.png"));
  const base64 = imgData.toString("base64");
  const src = `data:image/jpeg;base64,${base64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <img
          src={src}
          width={180}
          height={180}
        />
      </div>
    ),
    { ...size }
  );
}
