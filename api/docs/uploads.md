# CHOVIA — Media Uploads & Cloudinary

> **Specification:** Cloudinary Image Management, Signed Direct Uploads, and Server-Mediated Uploads

## 1. Provider
**Cloudinary** is the approved and implemented media provider for CHOVIA.

## 2. Direct Signed Uploads (Recommended for Mobile/Web)
To prevent streaming large binary image files through the API server:
1. Client calls `POST /api/v1/users/upload-signature` with the desired folder:
   - Allowed folders: `avatars`, `restaurants`, `menu`, `documents`.
2. Backend validates permissions and returns:
   - `signature`
   - `timestamp`
   - `apiKey`
   - `cloudName`
   - `folder`
3. Client posts image directly to Cloudinary: `https://api.cloudinary.com/v1_1/<cloudName>/image/upload`.
4. Client saves the resulting Cloudinary `secure_url` on the target profile or menu item.

## 3. Server-Mediated Uploads
For automated processes or small base64 uploads:
- `POST /api/v1/users/upload-image` accepts `{ file, folder, customPublicId }`.
- Validates file type (`image/jpeg`, `image/png`, `image/webp`) and size (max 5MB).
- Uploads directly via the official Cloudinary Node.js SDK and returns `{ publicId, secureUrl, width, height }`.
