import { create } from "zustand";

interface LocationState {
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  selectedAddressId: null,
  setSelectedAddressId: (selectedAddressId) => set({ selectedAddressId }),
}));
