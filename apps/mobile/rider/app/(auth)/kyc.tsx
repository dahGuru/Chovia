import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { CheckIcon, PhoneIcon, UserIcon } from "../../components/Icons";
import { InputField } from "../../components/InputField";
import { RiderHeader } from "../../components/RiderHeader";
import { EmptyState } from "../../components/StateViews";
import { useRiderKycApplication, useSubmitRiderKyc } from "../../hooks/useRiderQueries";
import { ApiClientError } from "../../services/api";
import {
  riderDeliveryService,
  type GovernmentIdType,
  type RiderDocumentType,
  type RiderVehicleType,
} from "../../services/riderDeliveryService";
import { useAuthStore } from "../../store/useAuthStore";
import { useRiderStore } from "../../store/useRiderStore";
import { COLORS } from "../../utils/theme";
import { normalizeNigerianPhone } from "../../utils/validation";

type SupportedUploadMime = "image/jpeg" | "image/png" | "application/pdf";

interface UploadedDocState {
  documentType: RiderDocumentType;
  publicId: string;
  fileName: string;
}

const VEHICLE_OPTIONS: ReadonlyArray<{ value: RiderVehicleType; label: string }> = [
  { value: "MOTORCYCLE", label: "Motorcycle" },
  { value: "BICYCLE", label: "Bicycle" },
  { value: "CAR", label: "Car" },
];

const ID_TYPE_OPTIONS: ReadonlyArray<{ value: GovernmentIdType; label: string }> = [
  { value: "NIN", label: "NIN" },
  { value: "DRIVERS_LICENSE", label: "Driver's License" },
  { value: "VOTERS_CARD", label: "Voter's Card" },
  { value: "INTERNATIONAL_PASSPORT", label: "Passport" },
];

function maskForPreview(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "*".repeat(trimmed.length);
  return `${"*".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

async function readAssetAsDataUri(
  asset: DocumentPicker.DocumentPickerAsset,
  mimeType: SupportedUploadMime
): Promise<string> {
  if (Platform.OS === "web" && asset.file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Could not read selected file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read selected file"));
      reader.readAsDataURL(asset.file as Blob);
    });
  }

  const base64 = await new ExpoFile(asset.uri).base64();
  return `data:${mimeType};base64,${base64}`;
}

function normalizeMimeType(rawMime?: string | null): SupportedUploadMime | null {
  if (!rawMime) return null;
  const lower = rawMime.toLowerCase();
  if (lower === "image/jpg" || lower === "image/jpeg") return "image/jpeg";
  if (lower === "image/png") return "image/png";
  if (lower === "application/pdf") return "application/pdf";
  return null;
}

export default function RiderKycScreen() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const kycDraft = useRiderStore((s) => s.kycDraft);
  const updateKycDraft = useRiderStore((s) => s.updateKycDraft);

  const { data: existingApp } = useRiderKycApplication();
  const submitKyc = useSubmitRiderKyc();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<RiderDocumentType | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Partial<Record<RiderDocumentType, UploadedDocState>>>({});

  // Pre-fill authenticated rider profile / previous application details safely
  useEffect(() => {
    if (existingApp) {
      updateKycDraft({
        firstName: existingApp.firstName,
        lastName: existingApp.lastName,
        phone: existingApp.phone,
        operatingCity: existingApp.operatingCity,
        homeAddress: existingApp.homeAddress ?? "",
        vehicleType:
          existingApp.vehicleType === "BICYCLE" || existingApp.vehicleType === "CAR"
            ? existingApp.vehicleType
            : "MOTORCYCLE",
        vehiclePlateNumber: existingApp.vehiclePlateNumber ?? "",
        bankName: existingApp.bankName,
        accountHolderName: existingApp.accountHolderName,
      });

      const hydratedDocs: Partial<Record<RiderDocumentType, UploadedDocState>> = {};
      for (const doc of existingApp.documents) {
        hydratedDocs[doc.documentType] = {
          documentType: doc.documentType,
          publicId: doc.publicId,
          fileName: `${doc.documentType.replace("_", " ")} (previously uploaded)`,
        };
      }
      setUploadedDocs((prev) => (Object.keys(prev).length === 0 ? hydratedDocs : prev));
      return;
    }

    if (user && !kycDraft.firstName && !kycDraft.phone) {
      updateKycDraft({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        phone: user.phone ?? "",
        accountHolderName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
      });
    }
  }, [existingApp, user, kycDraft.firstName, kycDraft.phone, updateKycDraft]);

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
        <RiderHeader title="Rider KYC Verification" />
        <View className="flex-1 justify-center px-5">
          <EmptyState
            title="Sign in to complete KYC"
            description="Create or log into your CHOVIA Rider account first before submitting your verification documents."
            actionLabel="Log in"
            onAction={() => router.replace("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const requiredDocs: ReadonlyArray<{ type: RiderDocumentType; label: string; required: boolean }> = [
    { type: "GOVERNMENT_ID", label: "Government ID (NIN / ID Card)", required: true },
    { type: "SELFIE", label: "Clear Selfie Photo", required: true },
    {
      type: "DRIVER_LICENSE",
      label: "Driver's License",
      required: kycDraft.vehicleType !== "BICYCLE",
    },
    { type: "VEHICLE_REGISTRATION", label: "Vehicle Papers (Optional)", required: false },
  ];

  const handlePickAndUpload = async (docType: RiderDocumentType) => {
    setFormError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || !picked.assets || picked.assets.length === 0) {
        return;
      }

      const asset = picked.assets[0];
      if (!asset) return;

      const mimeType = normalizeMimeType(asset.mimeType);
      if (!mimeType) {
        Alert.alert("Unsupported file", "Please upload a JPEG, PNG, or PDF file.");
        return;
      }

      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert("File too large", "Maximum document size is 10MB.");
        return;
      }

      setUploadingDocType(docType);
      const dataUri = await readAssetAsDataUri(asset, mimeType);
      const uploaded = await riderDeliveryService.uploadKycDocument({
        fileDataUri: dataUri,
        mimeType,
        fileSizeBytes: asset.size ?? undefined,
        customPublicId: `${user.id}/${docType.toLowerCase()}_${Date.now()}`,
      });

      setUploadedDocs((prev) => ({
        ...prev,
        [docType]: {
          documentType: docType,
          publicId: uploaded.publicId,
          fileName: asset.name || `${docType} uploaded`,
        },
      }));
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not upload document. Please try again."
      );
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleNext = () => {
    setFormError(null);
    if (step === 1) {
      const normalizedPhone = normalizeNigerianPhone(kycDraft.phone);
      if (!kycDraft.firstName.trim() || !kycDraft.lastName.trim()) {
        setFormError("First and last name are required.");
        return;
      }
      if (!normalizedPhone) {
        setFormError(
          "Enter a valid Nigerian phone number (e.g. 08054093095) or E.164 format (+2348054093095)."
        );
        return;
      }
      if (kycDraft.operatingCity.trim().length < 2) {
        setFormError("Please enter your operating city.");
        return;
      }
      updateKycDraft({ phone: normalizedPhone });
      setStep(2);
      return;
    }

    if (step === 2) {
      if (kycDraft.governmentIdNumber.trim().length < 6) {
        setFormError("Enter a valid government ID number (at least 6 characters).");
        return;
      }
      if (
        kycDraft.vehicleType !== "BICYCLE" &&
        kycDraft.vehiclePlateNumber.trim().length < 3
      ) {
        setFormError("Plate number is required for motorcycles and cars.");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!kycDraft.bankName.trim() || !kycDraft.accountHolderName.trim()) {
        setFormError("Bank name and account holder name are required.");
        return;
      }
      if (!/^\d{10}$/.test(kycDraft.bankAccountNumber.trim())) {
        setFormError("Enter a valid 10-digit NUBAN bank account number.");
        return;
      }
      for (const item of requiredDocs) {
        if (item.required && !uploadedDocs[item.type]) {
          setFormError(`Please upload your ${item.label}.`);
          return;
        }
      }
      setStep(4);
    }
  };

  const handleSubmitApplication = async () => {
    setFormError(null);
    const normalizedPhone = normalizeNigerianPhone(kycDraft.phone);
    if (!normalizedPhone) {
      setFormError("Invalid phone number format.");
      setStep(1);
      return;
    }

    const documents = Object.values(uploadedDocs)
      .filter((d): d is UploadedDocState => Boolean(d))
      .map((d) => ({
        documentType: d.documentType,
        publicId: d.publicId,
      }));

    try {
      await submitKyc.mutateAsync({
        firstName: kycDraft.firstName.trim(),
        lastName: kycDraft.lastName.trim(),
        phone: normalizedPhone,
        operatingCity: kycDraft.operatingCity.trim(),
        ...(kycDraft.homeAddress.trim() ? { homeAddress: kycDraft.homeAddress.trim() } : {}),
        vehicleType: kycDraft.vehicleType,
        ...(kycDraft.vehicleType !== "BICYCLE" && kycDraft.vehiclePlateNumber.trim()
          ? { vehiclePlateNumber: kycDraft.vehiclePlateNumber.trim() }
          : {}),
        governmentIdType: kycDraft.governmentIdType,
        governmentIdNumber: kycDraft.governmentIdNumber.trim(),
        bankName: kycDraft.bankName.trim(),
        accountHolderName: kycDraft.accountHolderName.trim(),
        bankAccountNumber: kycDraft.bankAccountNumber.trim(),
        documents,
      });

      router.replace("/(auth)/application-status");
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : "Could not submit your KYC application. Please review your details and try again."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-chovia-background" edges={["top", "bottom"]}>
      <RiderHeader title={`Rider KYC • Step ${step}/4`} />

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pt-2 pb-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        {formError && (
          <View className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
            <Text className="font-manrope-medium text-[13px] text-chovia-error">{formError}</Text>
          </View>
        )}

        {step === 1 && (
          <View className="gap-4">
            <Text className="font-manrope-semibold text-[22px] text-chovia-deep">
              Personal Details
            </Text>
            <InputField
              label="First name"
              placeholder="Daniel"
              leadingIcon={<UserIcon size={20} />}
              value={kycDraft.firstName}
              onChangeText={(firstName) => updateKycDraft({ firstName })}
            />
            <InputField
              label="Last name"
              placeholder="Okafor"
              leadingIcon={<UserIcon size={20} />}
              value={kycDraft.lastName}
              onChangeText={(lastName) => updateKycDraft({ lastName })}
            />
            <InputField
              label="Phone number"
              placeholder="08054093095 or +2348054093095"
              keyboardType="phone-pad"
              leadingIcon={<PhoneIcon size={20} />}
              value={kycDraft.phone}
              onChangeText={(phone) => updateKycDraft({ phone })}
            />
            <InputField
              label="Operating city"
              placeholder="Ekpoma"
              value={kycDraft.operatingCity}
              onChangeText={(operatingCity) => updateKycDraft({ operatingCity })}
            />
            <InputField
              label="Residential address (Optional)"
              placeholder="18 Market Road, Ekpoma"
              value={kycDraft.homeAddress}
              onChangeText={(homeAddress) => updateKycDraft({ homeAddress })}
            />
          </View>
        )}

        {step === 2 && (
          <View className="gap-4">
            <Text className="font-manrope-semibold text-[22px] text-chovia-deep">
              Identity & Vehicle
            </Text>

            <View className="gap-2">
              <Text className="font-manrope-medium text-[13px] text-chovia-deep">
                Government ID Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {ID_TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => updateKycDraft({ governmentIdType: opt.value })}
                    className={`rounded-[12px] border px-3 py-2 ${
                      kycDraft.governmentIdType === opt.value
                        ? "border-chovia-green bg-emerald-50"
                        : "border-chovia-border bg-chovia-card"
                    }`}
                  >
                    <Text className="font-manrope-semibold text-[12px] text-chovia-deep">
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <InputField
              label="Government ID number (encrypted at rest)"
              placeholder="Enter ID number"
              value={kycDraft.governmentIdNumber}
              onChangeText={(governmentIdNumber) => updateKycDraft({ governmentIdNumber })}
            />

            <View className="gap-2">
              <Text className="font-manrope-medium text-[13px] text-chovia-deep">
                Vehicle Type
              </Text>
              <View className="flex-row gap-2">
                {VEHICLE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => updateKycDraft({ vehicleType: opt.value })}
                    className={`flex-1 items-center rounded-[12px] border py-2.5 ${
                      kycDraft.vehicleType === opt.value
                        ? "border-chovia-green bg-emerald-50"
                        : "border-chovia-border bg-chovia-card"
                    }`}
                  >
                    <Text className="font-manrope-semibold text-[12px] text-chovia-deep">
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {kycDraft.vehicleType !== "BICYCLE" && (
              <InputField
                label="Vehicle plate number"
                placeholder="EDO-452-AB"
                value={kycDraft.vehiclePlateNumber}
                onChangeText={(vehiclePlateNumber) => updateKycDraft({ vehiclePlateNumber })}
              />
            )}
          </View>
        )}

        {step === 3 && (
          <View className="gap-4">
            <Text className="font-manrope-semibold text-[22px] text-chovia-deep">
              Bank Payout & Documents
            </Text>

            <InputField
              label="Bank name"
              placeholder="Access Bank"
              value={kycDraft.bankName}
              onChangeText={(bankName) => updateKycDraft({ bankName })}
            />
            <InputField
              label="Account holder name"
              placeholder="Daniel Okafor"
              value={kycDraft.accountHolderName}
              onChangeText={(accountHolderName) => updateKycDraft({ accountHolderName })}
            />
            <InputField
              label="10-digit NUBAN account number (encrypted at rest)"
              placeholder="0123456789"
              keyboardType="number-pad"
              maxLength={10}
              value={kycDraft.bankAccountNumber}
              onChangeText={(bankAccountNumber) => updateKycDraft({ bankAccountNumber })}
            />

            <View className="gap-2.5 pt-2">
              <Text className="font-manrope-semibold text-[15px] text-chovia-deep">
                Supporting Documents (Private Authenticated Storage)
              </Text>
              {requiredDocs.map((doc) => {
                const uploaded = uploadedDocs[doc.type];
                const isUploading = uploadingDocType === doc.type;
                return (
                  <View
                    key={doc.type}
                    className="flex-row items-center justify-between rounded-[14px] border border-chovia-border bg-chovia-card p-3.5"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="font-manrope-semibold text-[13px] text-chovia-deep">
                        {doc.label} {doc.required ? "*" : ""}
                      </Text>
                      <Text className="mt-0.5 font-manrope text-[11px] text-chovia-muted">
                        {uploaded ? uploaded.fileName : "JPEG, PNG, or PDF (max 10MB)"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={isUploading}
                      onPress={() => void handlePickAndUpload(doc.type)}
                      className={`flex-row items-center gap-1 rounded-[10px] px-3 py-2 ${
                        uploaded ? "bg-emerald-100" : "bg-chovia-green"
                      }`}
                    >
                      {uploaded && <CheckIcon size={14} color={COLORS.primary} />}
                      <Text
                        className={`font-manrope-semibold text-[12px] ${
                          uploaded ? "text-chovia-green" : "text-white"
                        }`}
                      >
                        {isUploading ? "Uploading..." : uploaded ? "Replace" : "Upload"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {step === 4 && (
          <View className="gap-3 rounded-[16px] bg-chovia-card p-4">
            <Text className="font-manrope-semibold text-[18px] text-chovia-deep">
              Review KYC Application
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              Name: {kycDraft.firstName} {kycDraft.lastName}
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              Phone: {kycDraft.phone}
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              Operating City: {kycDraft.operatingCity}
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              ID ({kycDraft.governmentIdType}): {maskForPreview(kycDraft.governmentIdNumber)}
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              Vehicle: {kycDraft.vehicleType}
              {kycDraft.vehiclePlateNumber ? ` (${kycDraft.vehiclePlateNumber})` : ""}
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-muted">
              Bank: {kycDraft.bankName} — {kycDraft.accountHolderName} (
              {maskForPreview(kycDraft.bankAccountNumber)})
            </Text>
            <Text className="font-manrope text-[13px] text-chovia-green">
              Documents ready: {Object.keys(uploadedDocs).length} verified private upload(s)
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="gap-2 border-t border-chovia-border bg-chovia-card px-5 py-4">
        {step < 4 ? (
          <Button label="Continue" onPress={handleNext} />
        ) : (
          <Button
            label="Submit Application"
            onPress={() => void handleSubmitApplication()}
            loading={submitKyc.isPending}
          />
        )}
        {step > 1 && (
          <Button
            label="Previous Step"
            variant="secondary"
            onPress={() => setStep((s) => (s === 4 ? 3 : s === 3 ? 2 : 1))}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
