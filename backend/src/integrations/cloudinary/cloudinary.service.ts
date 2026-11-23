import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";
import { env } from "../../config/env.js";
import { BadRequestError } from "../../common/errors/api-error.js";

export type AllowedFolder = "menu" | "restaurants" | "avatars" | "documents";

export interface UploadPolicy {
  folder: AllowedFolder;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedFormats: string[];
  resourceType: "image" | "auto" | "raw";
}

export const UPLOAD_POLICIES: Record<AllowedFolder, UploadPolicy> = {
  avatars: {
    folder: "avatars",
    maxSizeBytes: 5 * 1024 * 1024, // 5MB (accommodates high-res profile photos)
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    resourceType: "image",
  },
  menu: {
    folder: "menu",
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    resourceType: "image",
  },
  restaurants: {
    folder: "restaurants",
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    resourceType: "image",
  },
  documents: {
    folder: "documents",
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    allowedFormats: ["jpg", "jpeg", "png", "pdf"],
    resourceType: "auto",
  },
};

export interface UploadSignatureResult {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  allowedFormats: string[];
  maxFileSize: number;
  resourceType: string;
  publicId?: string;
}

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  resourceType?: string;
}

export function inspectFileMagicBytes(buffer: Buffer): { format: string; mimeType: string } | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: "jpg", mimeType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { format: "png", mimeType: "image/png" };
  }

  // WEBP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { format: "webp", mimeType: "image/webp" };
  }

  // PDF: %PDF
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { format: "pdf", mimeType: "application/pdf" };
  }

  return null;
}

const ALLOWED_FOLDERS: readonly AllowedFolder[] = [
  "menu",
  "restaurants",
  "avatars",
  "documents",
] as const;

export class CloudinaryService {
  private isConfigured: boolean;
  private isMock: boolean;

  constructor() {
    this.isConfigured = Boolean(
      env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
    );
    const isStrict = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
    if (isStrict) {
      if (!this.isConfigured) {
        throw new Error(
          `Cloudinary credentials are missing in ${env.NODE_ENV}. Mock mode is forbidden.`
        );
      }
      this.isMock = false;
    } else {
      this.isMock = Boolean(env.MOCK_INTEGRATIONS) || !this.isConfigured;
    }

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  validateUploadMetadata(folder: string, mimeType?: string, fileSizeBytes?: number): void {
    const policy = UPLOAD_POLICIES[folder as AllowedFolder];
    if (!policy) {
      throw new BadRequestError(
        `Invalid upload folder "${folder}". Allowed folders: ${ALLOWED_FOLDERS.join(", ")}`
      );
    }

    if (mimeType && !policy.allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new BadRequestError(
        `Invalid file type "${mimeType}". Allowed types for ${folder}: ${policy.allowedMimeTypes.join(", ")}`
      );
    }

    if (fileSizeBytes !== undefined && fileSizeBytes > policy.maxSizeBytes) {
      throw new BadRequestError(
        `File exceeds maximum permitted size of ${policy.maxSizeBytes / (1024 * 1024)}MB for ${folder}`
      );
    }
  }

  generateUploadSignature(
    folder: AllowedFolder,
    customPublicId?: string,
    tags?: string[]
  ): UploadSignatureResult {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(
        `Invalid upload folder "${folder}". Allowed folders: ${ALLOWED_FOLDERS.join(", ")}`
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const allowedFormatsStr = policy.allowedFormats.join(",");

    // Include security-sensitive provider-level restrictions in the signed parameters
    const paramsToSign: Record<string, unknown> = {
      allowed_formats: allowedFormatsStr,
      folder: `chovia/${folder}`,
      timestamp,
    };

    if (customPublicId) {
      paramsToSign["public_id"] = customPublicId;
    }
    if (tags && tags.length > 0) {
      paramsToSign["tags"] = tags.join(",");
    }

    if (this.isMock) {
      return {
        signature: `mock_signature_${timestamp}`,
        timestamp,
        cloudName: env.CLOUDINARY_CLOUD_NAME || "chovia-mock",
        apiKey: env.CLOUDINARY_API_KEY || "mock_api_key",
        folder: `chovia/${folder}`,
        allowedFormats: policy.allowedFormats,
        maxFileSize: policy.maxSizeBytes,
        resourceType: policy.resourceType,
        ...(customPublicId ? { publicId: customPublicId } : {}),
      };
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign as Record<string, string | number>,
      env.CLOUDINARY_API_SECRET
    );

    return {
      signature,
      timestamp,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      folder: `chovia/${folder}`,
      allowedFormats: policy.allowedFormats,
      maxFileSize: policy.maxSizeBytes,
      resourceType: policy.resourceType,
      ...(customPublicId ? { publicId: customPublicId } : {}),
    };
  }

  verifyUploadResponse(
    folder: AllowedFolder,
    response: {
      publicId: string;
      format?: string | undefined;
      bytes?: number | undefined;
      resourceType?: string | undefined;
    }
  ): void {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(`Invalid upload category "${folder}".`);
    }

    if (!response.publicId.startsWith(`chovia/${folder}/`)) {
      throw new BadRequestError(
        `Upload publicId does not belong to expected folder "chovia/${folder}". Received: ${response.publicId}`
      );
    }

    if (response.format && !policy.allowedFormats.includes(response.format.toLowerCase())) {
      throw new BadRequestError(
        `Upload format "${response.format}" is not permitted for category "${folder}". Permitted: ${policy.allowedFormats.join(", ")}`
      );
    }

    if (response.bytes && response.bytes > policy.maxSizeBytes) {
      throw new BadRequestError(
        `Upload size (${response.bytes} bytes) exceeds limit of ${policy.maxSizeBytes} bytes for category "${folder}".`
      );
    }
  }

  async uploadImage(
    fileInput: string,
    folder: AllowedFolder,
    publicId?: string
  ): Promise<CloudinaryUploadResult> {
    const policy = UPLOAD_POLICIES[folder];
    if (!policy) {
      throw new BadRequestError(`Invalid upload folder "${folder}".`);
    }

    // Inspect actual byte payload for base64 uploads
    if (fileInput.startsWith("data:") || !fileInput.startsWith("http")) {
      const base64Data = fileInput.includes(",") ? fileInput.split(",")[1] : fileInput;
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");

        if (buffer.length > policy.maxSizeBytes) {
          throw new BadRequestError(
            `File exceeds maximum permitted size of ${policy.maxSizeBytes / (1024 * 1024)}MB for ${folder}`
          );
        }

        const detected = inspectFileMagicBytes(buffer);
        if (!detected) {
          throw new BadRequestError(
            `Unable to verify file signature. File is corrupted or unpermitted format for ${folder}.`
          );
        }

        if (!policy.allowedFormats.includes(detected.format)) {
          throw new BadRequestError(
            `File format "${detected.format}" is not allowed for category "${folder}". Allowed: ${policy.allowedFormats.join(", ")}`
          );
        }
      }
    }

    if (this.isMock) {
      const generatedId = publicId || `mock_${Date.now()}`;
      const mockResult: CloudinaryUploadResult = {
        publicId: `chovia/${folder}/${generatedId}`,
        secureUrl: `https://res.cloudinary.com/chovia/${policy.resourceType}/upload/v1/chovia/${folder}/${generatedId}.webp`,
        format: "webp",
        width: 800,
        height: 600,
        bytes: 102400,
        resourceType: policy.resourceType,
      };
      this.verifyUploadResponse(folder, mockResult);
      return mockResult;
    }

    try {
      const uploadOptions: UploadApiOptions = {
        folder: `chovia/${folder}`,
        resource_type: policy.resourceType,
        allowed_formats: policy.allowedFormats,
        overwrite: false,
      };
      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      const result = await cloudinary.uploader.upload(fileInput, uploadOptions);

      const uploadResult: CloudinaryUploadResult = {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type,
      };

      this.verifyUploadResponse(folder, uploadResult);
      return uploadResult;
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const message = error instanceof Error ? error.message : "Cloudinary upload failed";
      throw new BadRequestError(`Media upload failed: ${message}`);
    }
  }

  async deleteImage(publicId: string): Promise<{ result: string }> {
    if (this.isMock) {
      return { result: "ok" };
    }

    try {
      const response = (await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      })) as { result: string };
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloudinary delete failed";
      throw new BadRequestError(`Media deletion failed: ${message}`);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
