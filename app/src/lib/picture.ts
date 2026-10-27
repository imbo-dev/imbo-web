/**
 * A picture ready to upload as an avatar (API-045): turned upright, long side at most 2048 px, as JPEG. A phone photo
 * can be past the server's 5 MB or its decoding limit; the server crops and scales it to 512 px anyway. Transparent
 * parts go white, as the server would make them. Throws when the browser can't read the file as an image.
 */
export async function shrinkPicture(file: Blob, longSide = 2048): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture couldn't be encoded."))), "image/jpeg", 0.9),
  )
}
